"""
Singleton Redis client.

We use redis-py's asyncio interface with a connection pool so hot endpoints
don't pay the cost of connection setup. `decode_responses=True` is explicitly
disabled — we prefer to keep bytes at this layer and decode where we know the
type, which is especially important for Streams/JSON payloads.
"""
from __future__ import annotations

import logging
from typing import Optional

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[aioredis.Redis] = None


class RedisClient:
    """Thin wrapper exposing the underlying async Redis connection."""

    def __init__(self, client: aioredis.Redis):
        self._client = client

    @property
    def raw(self) -> aioredis.Redis:
        return self._client


async def get_redis() -> aioredis.Redis:
    """Return the process-wide async Redis client (lazy-init)."""
    global _client
    if _client is None:
        _client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=100,
            socket_keepalive=True,
            health_check_interval=30,
        )
        try:
            await _client.ping()
            logger.info("Connected to Redis at %s", settings.redis_url)
        except Exception as exc:  # pragma: no cover
            logger.error("Failed to connect to Redis: %s", exc)
            raise
    return _client


async def close_redis() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
