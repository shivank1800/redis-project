"""
Distributed locking primitive (single-instance Redis lock).

For multi-node Redis (Sentinel/Cluster), Redlock is the right algorithm; for
a single primary this SETNX-with-fencing-token approach is safe and fast.

Why we need locks:
    Some operations need atomic read-modify-write on data that spans
    *both* Redis and Postgres — e.g. when we fold ephemeral Redis counters
    back into Postgres aggregates, or run periodic cleanup.

Features:
    * SET NX EX acquisition (no race)
    * Unique lock token so we only release *our own* lock (via Lua CAS-delete)
    * Optional blocking acquisition with exponential backoff
    * Async context manager ergonomics
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

_RELEASE_LUA = """
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
"""


class LockAcquireError(RuntimeError):
    pass


class RedisLock:
    def __init__(
        self,
        redis: aioredis.Redis,
        key: str,
        ttl_ms: int = 5_000,
        wait_ms: int = 0,
        retry_interval_ms: int = 50,
    ):
        self._redis = redis
        self._key = key
        self._ttl_ms = ttl_ms
        self._wait_ms = wait_ms
        self._retry_ms = retry_interval_ms
        self._token = uuid.uuid4().hex
        self._acquired = False

    @property
    def acquired(self) -> bool:
        return self._acquired

    async def acquire(self) -> bool:
        deadline = asyncio.get_event_loop().time() + self._wait_ms / 1000.0
        backoff = self._retry_ms / 1000.0
        while True:
            ok = await self._redis.set(
                self._key, self._token, nx=True, px=self._ttl_ms
            )
            if ok:
                self._acquired = True
                return True
            if self._wait_ms == 0 or asyncio.get_event_loop().time() >= deadline:
                return False
            await asyncio.sleep(backoff)
            backoff = min(backoff * 1.5, 0.5)

    async def release(self) -> bool:
        if not self._acquired:
            return False
        try:
            result = await self._redis.eval(_RELEASE_LUA, 1, self._key, self._token)
            return bool(int(result))
        finally:
            self._acquired = False

    async def __aenter__(self) -> "RedisLock":
        if not await self.acquire():
            raise LockAcquireError(f"could not acquire lock {self._key}")
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self.release()


@asynccontextmanager
async def redis_lock(
    redis: aioredis.Redis,
    key: str,
    *,
    ttl_ms: int = 5_000,
    wait_ms: int = 0,
) -> AsyncIterator[Optional[RedisLock]]:
    """
    Convenience context manager — yields the lock if acquired, else `None`.

    Use when the caller wants to *skip* rather than fail on contention.
    """
    lock = RedisLock(redis, key, ttl_ms=ttl_ms, wait_ms=wait_ms)
    ok = await lock.acquire()
    try:
        yield lock if ok else None
    finally:
        if ok:
            await lock.release()
