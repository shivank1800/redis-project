"""
Test fixtures.

We use `fakeredis` to get a fully in-process Redis-compatible async instance.
This means tests are fast, deterministic, and do not require a running
Redis server — perfect for CI.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
import fakeredis.aioredis


@pytest_asyncio.fixture
async def redis():
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    try:
        yield client
    finally:
        await client.flushall()
        await client.aclose()
