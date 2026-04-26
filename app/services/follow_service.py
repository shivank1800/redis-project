"""
Follow / unfollow logic.

Data plane:
    * Postgres `follows` table (long-term source of truth).
    * Redis sets `social:followers:{u}` and `social:following:{u}` (hot reads).
    * Redis counters `counter:user:{u}:followers` / `...following`.

On follow we also enqueue a "backfill" job on the fan-out stream so the
follower's home feed immediately picks up a snapshot of the followee's
recent posts — no waiting for the next write.
"""
from __future__ import annotations

import logging

import orjson
import redis.asyncio as aioredis
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Follow
from app.redis_layer.keys import K
from app.redis_layer.queue import StreamQueue
from app.services.notification_service import emit_notification

logger = logging.getLogger(__name__)


async def follow(
    db: AsyncSession, redis: aioredis.Redis, follower_id: int, followee_id: int
) -> bool:
    if follower_id == followee_id:
        return False

    db.add(Follow(follower_id=follower_id, followee_id=followee_id))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        return False  # already following

    pipe = redis.pipeline()
    pipe.sadd(K.user_following(follower_id), followee_id)
    pipe.sadd(K.user_followers(followee_id), follower_id)
    pipe.incr(K.user_following_count(follower_id))
    pipe.incr(K.user_follower_count(followee_id))
    await pipe.execute()

    # Backfill recent posts into follower's feed (async via queue).
    queue = StreamQueue(redis, K.STREAM_FANOUT, group="fanout-workers")
    await queue.publish(
        {"type": "backfill_follower", "follower_id": follower_id, "followee_id": followee_id}
    )

    # Notify the followee.
    await emit_notification(
        redis,
        kind="follow",
        actor_id=follower_id,
        recipient_id=followee_id,
        object_type="user",
        object_id=followee_id,
        message=f"user {follower_id} started following you",
    )
    return True


async def unfollow(
    db: AsyncSession, redis: aioredis.Redis, follower_id: int, followee_id: int
) -> bool:
    result = await db.execute(
        delete(Follow).where(
            Follow.follower_id == follower_id, Follow.followee_id == followee_id
        )
    )
    await db.commit()
    if result.rowcount == 0:
        return False

    pipe = redis.pipeline()
    pipe.srem(K.user_following(follower_id), followee_id)
    pipe.srem(K.user_followers(followee_id), follower_id)
    pipe.decr(K.user_following_count(follower_id))
    pipe.decr(K.user_follower_count(followee_id))
    await pipe.execute()
    return True


async def get_followers(
    db: AsyncSession, redis: aioredis.Redis, user_id: int, *, limit: int = 1000
) -> list[int]:
    """
    Return follower IDs. Hot path reads directly from the Redis SET; on miss
    we hydrate from Postgres.
    """
    key = K.user_followers(user_id)
    count = await redis.scard(key)
    if count == 0:
        rows = await db.execute(
            select(Follow.follower_id).where(Follow.followee_id == user_id)
        )
        ids = [row[0] for row in rows]
        if ids:
            await redis.sadd(key, *ids)
        return ids[:limit]
    members = await redis.srandmember(key, limit)
    return [int(m) for m in members]
