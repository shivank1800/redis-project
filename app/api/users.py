from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DBDep, RedisDep
from app.schemas.common import MessageResponse
from app.schemas.user import UserProfile
from app.services import analytics_service, follow_service, user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
async def me(db: DBDep, redis: RedisDep, user_id: CurrentUser):
    profile = await user_service.get_cached_profile(db, redis, user_id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    return profile


@router.get("/{target_id}", response_model=UserProfile)
async def get_user(target_id: int, db: DBDep, redis: RedisDep):
    profile = await user_service.get_cached_profile(db, redis, target_id)
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    return profile


@router.post("/{target_id}/follow", response_model=MessageResponse)
async def follow_user(
    target_id: int, db: DBDep, redis: RedisDep, user_id: CurrentUser
):
    if target_id == user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot follow yourself")
    ok = await follow_service.follow(db, redis, user_id, target_id)
    await user_service.invalidate_user_cache(redis, target_id)
    await user_service.invalidate_user_cache(redis, user_id)
    await analytics_service.record_activity(
        redis, user_id=user_id, kind="follow", target=f"user:{target_id}"
    )
    return MessageResponse(message="followed" if ok else "already following")


@router.delete("/{target_id}/follow", response_model=MessageResponse)
async def unfollow_user(
    target_id: int, db: DBDep, redis: RedisDep, user_id: CurrentUser
):
    ok = await follow_service.unfollow(db, redis, user_id, target_id)
    await user_service.invalidate_user_cache(redis, target_id)
    await user_service.invalidate_user_cache(redis, user_id)
    return MessageResponse(message="unfollowed" if ok else "not following")
