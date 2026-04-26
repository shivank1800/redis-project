"""
Thin pub/sub helpers.

Pub/sub is used **only** for live WebSocket fan-out. Durable storage happens
in Redis Streams (see `queue.py`). If a client is offline when a notification
is published, the stream keeps the data; when they reconnect they replay from
their last-seen ID.

This two-channel design — "durable log + ephemeral notify" — is the same
pattern used by Kafka compacted topics + websockets, but without introducing
Kafka.
"""
from __future__ import annotations

import logging
from typing import AsyncIterator

import orjson
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


async def publish(redis: aioredis.Redis, channel: str, payload: dict) -> int:
    return await redis.publish(channel, orjson.dumps(payload).decode())


async def subscribe(
    redis: aioredis.Redis, *channels: str
) -> AsyncIterator[dict]:
    pubsub = redis.pubsub()
    await pubsub.subscribe(*channels)
    try:
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = message["data"]
            if isinstance(data, bytes):
                data = data.decode()
            try:
                yield orjson.loads(data)
            except orjson.JSONDecodeError:
                logger.warning("Skipping non-JSON pubsub message: %s", data)
    finally:
        await pubsub.unsubscribe(*channels)
        await pubsub.aclose()
