"""Trending sorted-set logic."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.redis_layer.keys import K
from app.services import trending_service


async def test_new_post_enters_trending(redis):
    now = datetime.now(timezone.utc)
    await trending_service.record_post_created(redis, 1, now)
    assert await redis.zscore(K.TRENDING_POSTS, "1") is not None


async def test_likes_increase_score(redis):
    now = datetime.now(timezone.utc)
    await trending_service.record_post_created(redis, 1, now)
    baseline = float(await redis.zscore(K.TRENDING_POSTS, "1"))

    await redis.set(K.post_like_count(1), 10)
    await trending_service.record_like(redis, 1, now)
    liked = float(await redis.zscore(K.TRENDING_POSTS, "1"))
    assert liked > baseline


async def test_old_posts_score_lower_than_new(redis):
    now = datetime.now(timezone.utc)
    old = now - timedelta(hours=24)

    await redis.set(K.post_like_count(1), 100)
    await trending_service.record_like(redis, 1, old)
    old_score = float(await redis.zscore(K.TRENDING_POSTS, "1"))

    await redis.set(K.post_like_count(2), 100)
    await trending_service.record_like(redis, 2, now)
    new_score = float(await redis.zscore(K.TRENDING_POSTS, "2"))

    assert new_score > old_score


async def test_get_trending_returns_top_k_desc(redis):
    now = datetime.now(timezone.utc)
    for pid, likes in [(1, 1), (2, 100), (3, 10)]:
        await redis.set(K.post_like_count(pid), likes)
        await trending_service.record_like(redis, pid, now)
    top = await trending_service.get_trending(redis, limit=3)
    ids = [pid for pid, _ in top]
    assert ids == [2, 3, 1]


async def test_prune_removes_low_score_posts(redis):
    # Insert a post with near-zero decayed score.
    await redis.zadd(K.TRENDING_POSTS, {"99": 0.0001})
    pruned = await trending_service.prune_trending(redis)
    assert pruned >= 1
    assert await redis.zscore(K.TRENDING_POSTS, "99") is None
