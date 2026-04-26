"""Sliding window + token bucket limiters."""
from __future__ import annotations

import asyncio

import pytest

from app.redis_layer.rate_limiter import SlidingWindowLimiter, TokenBucketLimiter


async def test_sliding_window_allows_within_limit(redis):
    limiter = SlidingWindowLimiter(redis, window_seconds=60, max_events=3)
    for _ in range(3):
        r = await limiter.check("rl:user:1")
        assert r.allowed is True


async def test_sliding_window_blocks_beyond_limit(redis):
    limiter = SlidingWindowLimiter(redis, window_seconds=60, max_events=3)
    for _ in range(3):
        await limiter.check("rl:user:1")
    r = await limiter.check("rl:user:1")
    assert r.allowed is False
    assert r.retry_after_ms > 0


async def test_sliding_window_is_per_key(redis):
    limiter = SlidingWindowLimiter(redis, window_seconds=60, max_events=2)
    for _ in range(2):
        assert (await limiter.check("rl:a")).allowed
    for _ in range(2):
        assert (await limiter.check("rl:b")).allowed
    assert not (await limiter.check("rl:a")).allowed
    assert not (await limiter.check("rl:b")).allowed


async def test_token_bucket_allows_burst_up_to_capacity(redis):
    limiter = TokenBucketLimiter(redis, capacity=5, refill_per_second=1)
    for _ in range(5):
        assert (await limiter.check("rl:user:x")).allowed
    assert not (await limiter.check("rl:user:x")).allowed


async def test_token_bucket_refills_over_time(redis):
    limiter = TokenBucketLimiter(redis, capacity=2, refill_per_second=50)
    for _ in range(2):
        assert (await limiter.check("rl:refill")).allowed
    assert not (await limiter.check("rl:refill")).allowed
    # 40ms @ 50/s should refill ≥ 1 token.
    await asyncio.sleep(0.1)
    assert (await limiter.check("rl:refill")).allowed
