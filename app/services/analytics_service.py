"""
Analytics using Redis data structures — free, high-throughput telemetry.

* **HyperLogLog** (PFADD / PFCOUNT): daily active users — ~1.6% error with
  12KB of memory regardless of cardinality. Beats SET by 100-1000x.
* **Capped LIST** for "recent activity" search: LPUSH + LTRIM keeps a
  rolling 10k activity log, searchable via LRANGE + client-side filter.
* **Leaderboard ZSET**: total karma (likes received) per user.
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Iterable

import orjson
import redis.asyncio as aioredis

from app.redis_layer.keys import K

_RECENT_ACTIVITY_MAX = 10_000


async def record_active(redis: aioredis.Redis, user_id: int) -> None:
    """Stamp a user as active today. O(1), ~1.6% error, 12KB memory/day."""
    key = K.dau(date.today())
    pipe = redis.pipeline()
    pipe.pfadd(key, user_id)
    # Retain DAU keys for ~90 days for trend analysis.
    pipe.expire(key, 60 * 60 * 24 * 90)
    await pipe.execute()


async def dau(redis: aioredis.Redis, day: date | None = None) -> int:
    return int(await redis.pfcount(K.dau(day or date.today())))


async def dau_range(redis: aioredis.Redis, days: list[date]) -> dict[str, int]:
    if not days:
        return {}
    keys = [K.dau(d) for d in days]
    pipe = redis.pipeline()
    for k in keys:
        pipe.pfcount(k)
    results = await pipe.execute()
    return {d.isoformat(): int(v or 0) for d, v in zip(days, results)}


async def record_post_view(redis: aioredis.Redis, post_id: int, user_id: int) -> None:
    """Unique post viewers (again using HyperLogLog for cheap cardinality)."""
    await redis.pfadd(K.post_unique_viewers(post_id), user_id)


async def post_unique_viewers(redis: aioredis.Redis, post_id: int) -> int:
    return int(await redis.pfcount(K.post_unique_viewers(post_id)))


async def record_activity(
    redis: aioredis.Redis, *, user_id: int, kind: str, target: str
) -> None:
    """
    Global + per-user capped activity log. The global log is used for
    keyword search over recent activity (`search_recent`).
    """
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "kind": kind,
        "target": target,
    }
    payload = orjson.dumps(entry).decode()
    pipe = redis.pipeline()
    pipe.lpush(K.RECENT_ACTIVITY, payload)
    pipe.ltrim(K.RECENT_ACTIVITY, 0, _RECENT_ACTIVITY_MAX - 1)
    pipe.lpush(K.user_activity(user_id), payload)
    pipe.ltrim(K.user_activity(user_id), 0, 499)
    await pipe.execute()


async def search_recent(
    redis: aioredis.Redis, query: str, *, limit: int = 50, scan: int = 2000
) -> list[dict]:
    """
    Naive linear scan over the recent activity log. Good for "last 10k"
    activity queries; for full-text search we'd plug in RediSearch.
    """
    rows = await redis.lrange(K.RECENT_ACTIVITY, 0, scan - 1)
    q = query.lower()
    out = []
    for raw in rows:
        if q in raw.lower():
            out.append(orjson.loads(raw))
            if len(out) >= limit:
                break
    return out


# ---- Leaderboard (bonus) ---------------------------------------------------

async def add_karma(redis: aioredis.Redis, user_id: int, delta: int = 1) -> float:
    return float(await redis.zincrby(K.LEADERBOARD_KARMA, delta, user_id))


async def top_leaderboard(
    redis: aioredis.Redis, *, limit: int = 50
) -> list[tuple[int, float]]:
    entries = await redis.zrevrange(K.LEADERBOARD_KARMA, 0, limit - 1, withscores=True)
    return [(int(uid), float(score)) for uid, score in entries]


async def user_rank(redis: aioredis.Redis, user_id: int) -> int | None:
    """0-indexed rank; None if user not on board."""
    rank = await redis.zrevrank(K.LEADERBOARD_KARMA, user_id)
    return int(rank) if rank is not None else None
