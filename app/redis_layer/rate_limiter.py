"""
Distributed rate limiters.

Two algorithms are provided:

1. `SlidingWindowLimiter` — precise rolling-window limit using a sorted set
   of timestamps per identity. Server-timestamped, so clients cannot cheat
   by lying about their clocks. Evaluated atomically with a Lua script so
   no race between ZREMRANGEBYSCORE/ZCARD/ZADD.

2. `TokenBucketLimiter` — cheaper, more permissive; implemented with a small
   Lua script that stores (tokens, last_refill_ts). Good fit for bursty
   traffic.

Lua scripts are cached on the server via `SCRIPT LOAD`/`EVALSHA`.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from typing import Literal

import redis.asyncio as aioredis

# ---- Sliding Window (ZSET of event timestamps) -----------------------------

_SLIDING_LUA = """
-- KEYS[1] = zset key
-- ARGV[1] = window size in milliseconds
-- ARGV[2] = max events allowed in window
-- ARGV[3] = now (ms)
-- ARGV[4] = unique member id
local key    = KEYS[1]
local window = tonumber(ARGV[1])
local limit  = tonumber(ARGV[2])
local now    = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
local count = redis.call('ZCARD', key)
if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_after = window - (now - tonumber(oldest[2]))
  return {0, count, retry_after}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, window)
return {1, count + 1, 0}
"""


# ---- Token Bucket ----------------------------------------------------------

_TOKEN_BUCKET_LUA = """
-- KEYS[1] = hash key with fields {tokens, ts}
-- ARGV[1] = capacity
-- ARGV[2] = refill rate (tokens / sec)
-- ARGV[3] = now (ms)
-- ARGV[4] = cost
local key      = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate     = tonumber(ARGV[2])
local now      = tonumber(ARGV[3])
local cost     = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1]) or capacity
local ts     = tonumber(data[2]) or now

local delta_ms = math.max(0, now - ts)
tokens = math.min(capacity, tokens + (delta_ms / 1000.0) * rate)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end
redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, math.ceil(capacity / rate * 1000) + 1000)

local retry_after_ms = 0
if allowed == 0 then
  retry_after_ms = math.ceil((cost - tokens) / rate * 1000)
end
return {allowed, math.floor(tokens * 1000) / 1000, retry_after_ms}
"""


@dataclass(slots=True)
class LimitResult:
    allowed: bool
    remaining: float  # remaining budget or tokens
    retry_after_ms: int
    algorithm: Literal["sliding_window", "token_bucket"]


class SlidingWindowLimiter:
    """Precise rolling-window limiter backed by ZSET."""

    def __init__(self, redis: aioredis.Redis, window_seconds: int, max_events: int):
        self._redis = redis
        self._window_ms = window_seconds * 1000
        self._max = max_events
        self._sha: str | None = None

    async def _script(self) -> str:
        if self._sha is None:
            self._sha = await self._redis.script_load(_SLIDING_LUA)
        return self._sha

    async def check(self, key: str) -> LimitResult:
        sha = await self._script()
        now = int(time.time() * 1000)
        member = f"{now}-{uuid.uuid4().hex[:8]}"
        try:
            allowed, count, retry_after = await self._redis.evalsha(
                sha, 1, key, self._window_ms, self._max, now, member
            )
        except aioredis.ResponseError:
            allowed, count, retry_after = await self._redis.eval(
                _SLIDING_LUA, 1, key, self._window_ms, self._max, now, member
            )
        return LimitResult(
            allowed=bool(int(allowed)),
            remaining=max(0, self._max - int(count)),
            retry_after_ms=int(retry_after),
            algorithm="sliding_window",
        )


class TokenBucketLimiter:
    """Classic token bucket; cheap HMSET + math in a single Lua round-trip."""

    def __init__(self, redis: aioredis.Redis, capacity: int, refill_per_second: float):
        self._redis = redis
        self._capacity = capacity
        self._rate = refill_per_second
        self._sha: str | None = None

    async def _script(self) -> str:
        if self._sha is None:
            self._sha = await self._redis.script_load(_TOKEN_BUCKET_LUA)
        return self._sha

    async def check(self, key: str, cost: int = 1) -> LimitResult:
        sha = await self._script()
        now = int(time.time() * 1000)
        try:
            allowed, tokens, retry_after_ms = await self._redis.evalsha(
                sha, 1, key, self._capacity, self._rate, now, cost
            )
        except aioredis.ResponseError:
            allowed, tokens, retry_after_ms = await self._redis.eval(
                _TOKEN_BUCKET_LUA, 1, key, self._capacity, self._rate, now, cost
            )
        return LimitResult(
            allowed=bool(int(allowed)),
            remaining=float(tokens),
            retry_after_ms=int(retry_after_ms),
            algorithm="token_bucket",
        )
