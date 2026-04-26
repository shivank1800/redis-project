from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import DBDep, RedisDep, CurrentUser
from app.schemas.common import MessageResponse
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserPublic
from app.security import verify_password
from app.services import session_service, user_service
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserPublic, status_code=201)
async def register(data: UserCreate, db: DBDep, redis: RedisDep):
    try:
        user = await user_service.create_user(db, redis, data)
    except user_service.UsernameTakenError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc))
    return UserPublic.model_validate(user)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, request: Request, db: DBDep, redis: RedisDep):
    user = await user_service.get_by_username(db, data.username)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")

    token = await session_service.create_session(
        redis,
        user.id,
        user_agent=request.headers.get("user-agent", ""),
        ip=request.client.host if request.client else "",
    )
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_ttl_seconds,
        user=UserPublic.model_validate(user),
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, redis: RedisDep, user_id: CurrentUser):
    auth = request.headers.get("authorization", "")
    token = auth.split(" ", 1)[1] if " " in auth else ""
    await session_service.revoke_session(redis, token)
    return MessageResponse(message="logged out")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(redis: RedisDep, user_id: CurrentUser):
    n = await session_service.revoke_all_sessions(redis, user_id)
    return MessageResponse(message=f"revoked {n} sessions")
