"""HyperLogLog DAU + leaderboard."""
from __future__ import annotations

from datetime import date

import pytest

from app.services import analytics_service


async def test_dau_counts_unique_users(redis):
    for uid in [1, 2, 3, 1, 2]:
        await analytics_service.record_active(redis, uid)
    assert await analytics_service.dau(redis) == 3


async def test_leaderboard_ordering(redis):
    await analytics_service.add_karma(redis, 1, 10)
    await analytics_service.add_karma(redis, 2, 25)
    await analytics_service.add_karma(redis, 3, 5)
    top = await analytics_service.top_leaderboard(redis, limit=3)
    uids = [uid for uid, _ in top]
    assert uids == [2, 1, 3]


async def test_user_rank(redis):
    await analytics_service.add_karma(redis, 1, 10)
    await analytics_service.add_karma(redis, 2, 25)
    assert await analytics_service.user_rank(redis, 2) == 0
    assert await analytics_service.user_rank(redis, 1) == 1
    assert await analytics_service.user_rank(redis, 99) is None


async def test_activity_search(redis):
    await analytics_service.record_activity(
        redis, user_id=1, kind="post", target="post:42"
    )
    await analytics_service.record_activity(
        redis, user_id=2, kind="like", target="post:42"
    )
    await analytics_service.record_activity(
        redis, user_id=3, kind="comment", target="post:7"
    )
    results = await analytics_service.search_recent(redis, "post:42", limit=10)
    assert len(results) == 2
    results = await analytics_service.search_recent(redis, "comment", limit=10)
    assert len(results) == 1
