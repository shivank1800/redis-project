"""
Session management in Redis.

Why Redis and not just stateless JWT?
    * We want to support server-side revocation (logout, ban, password
      rotation) without waiting for JWT expiry.
    * We record per-user session sets so "logout from all devices" is O(N)
      deletes, no DB round-trip.

Structure:
    session:{token}          HASH  -> user_id, ua, ip, created_at
    session:user:{user_id}   SET   -> {token, token, ...}

Both use TTL so abandoned sessions clean themselves up — a major advantage
over storing this in Postgres.
"""
from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis

from app.config import settings
from app.redis_layer.keys import K


def _new_token() -> str:
    return secrets.token_urlsafe(32)


async def create_session(
    redis: aioredis.Redis,
    user_id: int,
    *,
    user_agent: str = "",
    ip: str = "",
) -> str:
    token = _new_token()
    key = K.session(token)
    now = datetime.now(timezone.utc).isoformat()
    pipe = redis.pipeline()
    pipe.hset(
        key,
        mapping={
            "user_id": str(user_id),
            "ua": user_agent[:256],
            "ip": ip[:64],
            "created_at": now,
        },
    )
    pipe.expire(key, settings.access_token_ttl_seconds)
    pipe.sadd(K.user_sessions(user_id), token)
    pipe.expire(K.user_sessions(user_id), settings.access_token_ttl_seconds)
    await pipe.execute()
    return token


async def get_session(redis: aioredis.Redis, token: str) -> Optional[dict]:
    data = await redis.hgetall(K.session(token))
    if not data:
        return None
    return data


async def revoke_session(redis: aioredis.Redis, token: str) -> None:
    data = await redis.hgetall(K.session(token))
    if not data:
        return
    user_id = int(data.get("user_id", 0))
    pipe = redis.pipeline()
    pipe.delete(K.session(token))
    if user_id:
        pipe.srem(K.user_sessions(user_id), token)
    await pipe.execute()


async def revoke_all_sessions(redis: aioredis.Redis, user_id: int) -> int:
    """Nuke every session for a user — used on password change/ban."""
    tokens = await redis.smembers(K.user_sessions(user_id))
    if not tokens:
        return 0
    pipe = redis.pipeline()
    for t in tokens:
        pipe.delete(K.session(t))
    pipe.delete(K.user_sessions(user_id))
    await pipe.execute()
    return len(tokens)
