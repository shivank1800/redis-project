"""Distributed lock semantics."""
from __future__ import annotations

import asyncio

import pytest

from app.redis_layer.lock import LockAcquireError, RedisLock, redis_lock


async def test_lock_basic_acquire_release(redis):
    lock = RedisLock(redis, "lock:x", ttl_ms=1_000)
    assert await lock.acquire() is True
    assert lock.acquired
    assert await lock.release() is True


async def test_lock_is_exclusive(redis):
    a = RedisLock(redis, "lock:x", ttl_ms=1_000)
    b = RedisLock(redis, "lock:x", ttl_ms=1_000)
    assert await a.acquire() is True
    assert await b.acquire() is False
    await a.release()
    assert await b.acquire() is True


async def test_lock_only_owner_can_release(redis):
    a = RedisLock(redis, "lock:x", ttl_ms=1_000)
    b = RedisLock(redis, "lock:x", ttl_ms=1_000)
    await a.acquire()
    # b never acquired — release should be a no-op.
    released = await b.release()
    assert released is False
    # a's lock still in place:
    assert not await b.acquire()


async def test_lock_async_context_manager(redis):
    async with RedisLock(redis, "lock:ctx", ttl_ms=1_000) as lock:
        assert lock.acquired
    # After ctx — lock should be free.
    another = RedisLock(redis, "lock:ctx", ttl_ms=1_000)
    assert await another.acquire()
    await another.release()


async def test_lock_context_manager_yields_none_on_contention(redis):
    holder = RedisLock(redis, "lock:held", ttl_ms=5_000)
    await holder.acquire()
    async with redis_lock(redis, "lock:held", ttl_ms=1_000, wait_ms=0) as lock:
        assert lock is None
    await holder.release()


async def test_lock_raises_on_required_acquisition(redis):
    holder = RedisLock(redis, "lock:must", ttl_ms=5_000)
    await holder.acquire()
    with pytest.raises(LockAcquireError):
        async with RedisLock(redis, "lock:must", ttl_ms=1_000, wait_ms=0):
            pass
    await holder.release()
