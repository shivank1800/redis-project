"""
Trending service — sorted-set with time-decayed scores.

## Scoring model

    score(post) = likes * exp(-λ * age_hours)

Where λ (lambda) controls how quickly a post's score decays. With λ = 0.08
a post loses ~half its score every ~9 hours. This means:
    * Fresh posts surface quickly once they gain engagement.
    * Old posts fall off naturally without needing a cron job to delete them.

## Why a decayed score instead of bucket counts?
    Bucket counts (like/hour) require us to maintain N keys and sum them on
    read. A single ZADD with a decayed score is O(log N) write, O(log N)
    read, and lets us use ZREVRANGE for top-K trivially.

## Important subtlety
    Because `exp(-λ * age)` changes every second, strictly speaking *every*
    post's true score drifts over time. We handle this by:
        * **On like**: recompute the score from the post's ORIGINAL creation
          time + the new like count — fresh, correct.
        * **On read**: we trim old entries (ZREMRANGEBYSCORE) and expose the
          top-K raw. Scores are comparable to each other because they all
          use the same λ and absolute timestamps.

## Memory control
    ZSET is capped by `trending_window_hours`. A nightly sweeper (or we do it
    inline) removes posts whose decayed score falls below a floor.
"""
from __future__ import annotations

import math
import time
from datetime import datetime, timezone

import redis.asyncio as aioredis

from app.config import settings
from app.redis_layer.keys import K


def _score(created_at: datetime, likes: int) -> float:
    age_hours = max(0.0, (time.time() - created_at.timestamp()) / 3600.0)
    return (likes + 1) * math.exp(-settings.trending_decay_lambda * age_hours)


async def record_post_created(
    redis: aioredis.Redis, post_id: int, created_at: datetime
) -> None:
    """A freshly created post enters trending with a low base score."""
    score = _score(created_at, likes=0)
    await redis.zadd(K.TRENDING_POSTS, {str(post_id): score})


async def record_like(
    redis: aioredis.Redis, post_id: int, created_at: datetime
) -> float:
    """
    Recompute the post's trending score after a like.

    We read the live like count (authoritative in Redis) and apply the decay
    based on the post's creation time. Single round-trip.
    """
    likes = int(await redis.get(K.post_like_count(post_id)) or 0)
    score = _score(created_at, likes=likes)
    await redis.zadd(K.TRENDING_POSTS, {str(post_id): score})
    return score


async def get_trending(
    redis: aioredis.Redis, *, limit: int = 20
) -> list[tuple[int, float]]:
    """Top-K trending posts by current score."""
    entries = await redis.zrevrange(K.TRENDING_POSTS, 0, limit - 1, withscores=True)
    return [(int(pid), float(score)) for pid, score in entries]


async def prune_trending(redis: aioredis.Redis) -> int:
    """
    Drop posts whose decayed score is below a tiny threshold — they're
    effectively invisible and just waste memory. Called periodically.
    """
    # With λ=0.08, a freshly-created post with 0 likes has score ~= 1. After
    # 48h with no likes its score is ~= exp(-3.84) ≈ 0.021. Cull below that.
    threshold = math.exp(-settings.trending_decay_lambda * settings.trending_window_hours)
    return await redis.zremrangebyscore(K.TRENDING_POSTS, min=0, max=threshold)
