"""Common FastAPI dependencies."""
from __future__ import annotations

from typing import Annotated

import redis.asyncio as aioredis
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.redis_layer.client import get_redis
from app.security import decode_token
from app.services import session_service, analytics_service


async def redis_dep() -> aioredis.Redis:
    return await get_redis()


RedisDep = Annotated[aioredis.Redis, Depends(redis_dep)]
DBDep = Annotated[AsyncSession, Depends(get_db)]


async def current_user_id(
    request: Request,
    redis: RedisDep,
    authorization: Annotated[str | None, Header()] = None,
) -> int:
    """Resolve & validate bearer token, returning the user id."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()

    # Try server-side session first (allows instant revocation).
    session = await session_service.get_session(redis, token)
    if session:
        user_id = int(session["user_id"])
    else:
        # Fall back to JWT (stateless). Useful for read-only tokens / tests.
        try:
            payload = decode_token(token)
        except ValueError:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
        user_id = int(payload["sub"])

    await analytics_service.record_active(redis, user_id)
    request.state.user_id = user_id
    return user_id


CurrentUser = Annotated[int, Depends(current_user_id)]
