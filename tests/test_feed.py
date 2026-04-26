"""
Feed fan-out semantics (ZSET-based timeline).

These tests exercise the Redis-only parts of the feed service — follower
fan-out, pruning, celebrity backfill — without touching Postgres.
"""
from __future__ import annotations

import pytest

from app.config import settings
from app.redis_layer.keys import K
from app.services import feed_service


async def test_fanout_writes_to_each_follower_feed(redis):
    followers = [10, 20, 30]
    await feed_service.fanout_post_to_followers(
        redis, post_id=1, author_id=99, score=1000.0, follower_ids=followers
    )
    for fid in followers:
        members = await redis.zrange(K.home_feed(fid), 0, -1)
        assert members == ["1"]


async def test_fanout_prunes_to_feed_max_size(redis, monkeypatch):
    monkeypatch.setattr(settings, "feed_max_size", 3)
    # Populate follower feed with 5 posts.
    for i in range(1, 6):
        await feed_service.fanout_post_to_followers(
            redis, post_id=i, author_id=1, score=float(i), follower_ids=[42]
        )
    size = await redis.zcard(K.home_feed(42))
    assert size == 3
    # Highest-scored (most recent) should remain.
    kept = await redis.zrange(K.home_feed(42), 0, -1)
    assert kept == ["3", "4", "5"]


async def test_backfill_copies_recent_posts(redis):
    # Author 7 wrote posts 1 and 2.
    await redis.zadd(K.user_posts(7), {"1": 1_000.0, "2": 2_000.0})
    n = await feed_service.backfill_follower_feed(redis, follower_id=5, followee_id=7)
    assert n == 2
    feed = await redis.zrange(K.home_feed(5), 0, -1, withscores=True)
    assert dict(feed) == {"1": 1_000.0, "2": 2_000.0}


async def test_zset_orders_by_score_descending(redis):
    await feed_service.fanout_post_to_followers(
        redis, post_id=1, author_id=1, score=100.0, follower_ids=[1]
    )
    await feed_service.fanout_post_to_followers(
        redis, post_id=2, author_id=1, score=200.0, follower_ids=[1]
    )
    await feed_service.fanout_post_to_followers(
        redis, post_id=3, author_id=1, score=50.0, follower_ids=[1]
    )
    newest_first = await redis.zrevrange(K.home_feed(1), 0, -1)
    assert newest_first == ["2", "1", "3"]
