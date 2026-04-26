"""
Generic cache helpers with JSON serialisation and stampede protection.

Highlights:
    * Read-through pattern via `get_or_set`.
    * Jittered TTL to avoid synchronised expiry ("cache stampede").
    * `SETNX`-based recomputation lock: only one process recomputes a hot key
      when it expires; the rest briefly retry.

This is the pragmatic alternative to Go's singleflight or a full-blown
request coalescer for our purposes.
"""
from __future__ import annotations

import asyncio
import logging
import random
from typing import Any, Awaitable, Callable, Optional

import orjson
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


def _dumps(value: Any) -> bytes:
    return orjson.dumps(value)


def _loads(raw: str | bytes | None) -> Any:
    if raw is None:
        return None
    if isinstance(raw, str):
        raw = raw.encode()
    return orjson.loads(raw)


async def cache_get(redis: aioredis.Redis, key: str) -> Any:
    raw = await redis.get(key)
    return _loads(raw)


async def cache_set(
    redis: aioredis.Redis,
    key: str,
    value: Any,
    ttl_seconds: int,
    jitter_ratio: float = 0.1,
) -> None:
    """
    Set a value with a jittered TTL.

    Jitter defends against synchronized expiry of many keys — e.g. 10k user
    profiles cached at once and all expiring the same second would cause a
    huge thundering herd against Postgres.
    """
    jitter = int(ttl_seconds * jitter_ratio * random.random())
    await redis.set(key, _dumps(value), ex=ttl_seconds + jitter)


async def cache_delete(redis: aioredis.Redis, *keys: str) -> None:
    if keys:
        await redis.delete(*keys)


async def get_or_set(
    redis: aioredis.Redis,
    key: str,
    loader: Callable[[], Awaitable[Any]],
    ttl_seconds: int,
    *,
    lock_ttl_seconds: int = 5,
    retry_sleep: float = 0.05,
    max_retries: int = 40,
) -> Any:
    """
    Read-through cache with single-flight protection.

    Flow:
      1. Try GET.
      2. On miss, attempt to acquire a recomputation lock via SET NX EX.
         * Winner calls `loader()`, writes the value, releases lock.
         * Losers poll GET until the winner populates the key, then return.
      3. If lock acquisition keeps failing, we fall through to calling
         `loader()` anyway so we never block indefinitely.

    Trade-off: losers see a few ms of added latency on miss — vastly better
    than every one of them hammering the DB.
    """
    cached = await cache_get(redis, key)
    if cached is not None:
        return cached

    lock_key = f"{key}:lock"
    got_lock = await redis.set(lock_key, "1", nx=True, ex=lock_ttl_seconds)
    if got_lock:
        try:
            value = await loader()
            if value is not None:
                await cache_set(redis, key, value, ttl_seconds)
            return value
        finally:
            await redis.delete(lock_key)

    # Loser branch: poll briefly for the winner to populate the key.
    for _ in range(max_retries):
        await asyncio.sleep(retry_sleep)
        cached = await cache_get(redis, key)
        if cached is not None:
            return cached

    # Final fallback — winner crashed or loader is slow. Compute ourselves.
    logger.warning("Cache stampede fallback firing for key=%s", key)
    value = await loader()
    if value is not None:
        await cache_set(redis, key, value, ttl_seconds)
    return value


async def invalidate_many(redis: aioredis.Redis, *keys: str) -> None:
    """Delete multiple cache keys — used after writes."""
    if keys:
        await redis.delete(*keys)
