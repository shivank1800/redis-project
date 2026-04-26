"""Tests for generic cache helpers + read-through stampede protection."""
from __future__ import annotations

import asyncio

import pytest

from app.redis_layer import cache


async def test_set_and_get_roundtrip(redis):
    await cache.cache_set(redis, "k", {"hello": "world"}, ttl_seconds=60)
    assert await cache.cache_get(redis, "k") == {"hello": "world"}


async def test_get_missing_returns_none(redis):
    assert await cache.cache_get(redis, "missing") is None


async def test_get_or_set_populates_on_miss(redis):
    calls = 0

    async def loader():
        nonlocal calls
        calls += 1
        return {"v": 42}

    out = await cache.get_or_set(redis, "ok", loader, ttl_seconds=60)
    assert out == {"v": 42}
    assert calls == 1

    out = await cache.get_or_set(redis, "ok", loader, ttl_seconds=60)
    assert out == {"v": 42}
    assert calls == 1  # served from cache


async def test_get_or_set_coalesces_concurrent_callers(redis):
    """
    With 10 concurrent callers and a slow loader, only one should invoke
    the loader; the others should either reuse the populated cache or fall
    through to the fallback branch without blocking.
    """
    call_count = 0
    loader_lock = asyncio.Lock()

    async def slow_loader():
        nonlocal call_count
        async with loader_lock:
            call_count += 1
        await asyncio.sleep(0.1)
        return "value"

    results = await asyncio.gather(
        *[
            cache.get_or_set(
                redis,
                "hot",
                slow_loader,
                ttl_seconds=60,
                lock_ttl_seconds=2,
                retry_sleep=0.01,
                max_retries=100,
            )
            for _ in range(10)
        ]
    )
    assert all(r == "value" for r in results)
    # At most one loader execution under the lock path; fallback may add 1
    # more if retries exhaust. Either way, dramatically less than 10.
    assert call_count <= 2


async def test_invalidate_many(redis):
    await cache.cache_set(redis, "a", 1, ttl_seconds=60)
    await cache.cache_set(redis, "b", 2, ttl_seconds=60)
    await cache.invalidate_many(redis, "a", "b")
    assert await cache.cache_get(redis, "a") is None
    assert await cache.cache_get(redis, "b") is None
