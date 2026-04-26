from __future__ import annotations

import time

from fastapi import APIRouter

from app.api.deps import RedisDep
from app.redis_layer.keys import K

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(redis: RedisDep):
    t0 = time.perf_counter()
    pong = await redis.ping()
    redis_ms = round((time.perf_counter() - t0) * 1000, 2)
    fanout_len = await redis.xlen(K.STREAM_FANOUT) if await redis.exists(K.STREAM_FANOUT) else 0
    notif_len = await redis.xlen(K.STREAM_NOTIFICATIONS) if await redis.exists(K.STREAM_NOTIFICATIONS) else 0
    return {
        "status": "ok",
        "redis": {"pong": pong, "latency_ms": redis_ms},
        "streams": {"fanout": fanout_len, "notifications": notif_len},
    }


@router.get("/metrics")
async def metrics(redis: RedisDep):
    """Rough Redis + job-queue metrics. Wire into Prometheus if you want."""
    info = await redis.info("memory")
    return {
        "redis_memory_used_bytes": int(info.get("used_memory", 0)),
        "redis_memory_peak_bytes": int(info.get("used_memory_peak", 0)),
        "fanout_queue_len": await redis.xlen(K.STREAM_FANOUT)
        if await redis.exists(K.STREAM_FANOUT)
        else 0,
        "notifications_queue_len": await redis.xlen(K.STREAM_NOTIFICATIONS)
        if await redis.exists(K.STREAM_NOTIFICATIONS)
        else 0,
        "trending_zset_size": await redis.zcard(K.TRENDING_POSTS),
        "recent_activity_len": await redis.llen(K.RECENT_ACTIVITY),
    }
