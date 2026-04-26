"""User service — CRUD with Redis read-through caching."""
from __future__ import annotations

import logging
from typing import Optional

import redis.asyncio as aioredis
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Follow, Post, User
from app.redis_layer import cache
from app.redis_layer.keys import K
from app.schemas.user import UserCreate, UserProfile, UserPublic
from app.security import hash_password

logger = logging.getLogger(__name__)

USER_CACHE_TTL = 300  # 5 min


class UsernameTakenError(Exception):
    pass


async def create_user(db: AsyncSession, redis: aioredis.Redis, data: UserCreate) -> User:
    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
        display_name=data.display_name or data.username,
        bio=data.bio,
    )
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise UsernameTakenError("username or email already exists")
    await db.refresh(user)
    return user


async def get_by_username(db: AsyncSession, username: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_by_id(db: AsyncSession, user_id: int) -> Optional[User]:
    return await db.get(User, user_id)


async def get_cached_profile(
    db: AsyncSession, redis: aioredis.Redis, user_id: int
) -> Optional[UserProfile]:
    """
    Read-through profile with live counters from Redis.

    Profile row itself is cached (5 min TTL). Counters are served *directly*
    from Redis string counters — always fresh within the resolution of
    like/follow operations, without ever hitting Postgres.
    """
    async def loader() -> Optional[dict]:
        user = await get_by_id(db, user_id)
        if not user:
            return None
        return UserPublic.model_validate(user).model_dump(mode="json")

    base = await cache.get_or_set(
        redis, K.user_cache(user_id), loader, ttl_seconds=USER_CACHE_TTL
    )
    if not base:
        return None

    pipe = redis.pipeline()
    pipe.get(K.user_follower_count(user_id))
    pipe.get(K.user_following_count(user_id))
    pipe.zcard(K.user_posts(user_id))
    followers, following, posts = await pipe.execute()

    if followers is None or following is None:
        # Counters missing (fresh DB or cold cache) — backfill from Postgres once.
        await _backfill_counters(db, redis, user_id)
        pipe = redis.pipeline()
        pipe.get(K.user_follower_count(user_id))
        pipe.get(K.user_following_count(user_id))
        followers, following = await pipe.execute()

    return UserProfile(
        **base,
        follower_count=int(followers or 0),
        following_count=int(following or 0),
        post_count=int(posts or 0),
    )


async def _backfill_counters(
    db: AsyncSession, redis: aioredis.Redis, user_id: int
) -> None:
    """One-time sync of follow counts from Postgres into Redis string keys."""
    followers = await db.scalar(
        select(func.count()).select_from(Follow).where(Follow.followee_id == user_id)
    )
    following = await db.scalar(
        select(func.count()).select_from(Follow).where(Follow.follower_id == user_id)
    )
    post_count = await db.scalar(
        select(func.count()).select_from(Post).where(Post.author_id == user_id)
    )
    pipe = redis.pipeline()
    pipe.set(K.user_follower_count(user_id), int(followers or 0))
    pipe.set(K.user_following_count(user_id), int(following or 0))
    # feed:user is a ZSET — only backfill if empty to avoid blowing away memory.
    if int(post_count or 0) and not await redis.exists(K.user_posts(user_id)):
        rows = await db.execute(
            select(Post.id, Post.created_at).where(Post.author_id == user_id)
        )
        mapping = {str(pid): ts.timestamp() for pid, ts in rows}
        if mapping:
            pipe.zadd(K.user_posts(user_id), mapping)
    await pipe.execute()


async def invalidate_user_cache(redis: aioredis.Redis, user_id: int) -> None:
    await cache.invalidate_many(redis, K.user_cache(user_id))
