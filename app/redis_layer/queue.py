"""
Durable job queue built on Redis Streams with consumer groups.

Why Streams (XADD + XREADGROUP) instead of:
    * LIST (LPUSH/BRPOP):    no ack, no replay, no multi-consumer fan-in
    * PUB/SUB:               fire-and-forget — we lose messages on crash
    * Kafka:                 operationally heavier; overkill at our scale

Redis Streams gives us: persistence (AOF/RDB), ack/retry semantics via
XACK/XPENDING, consumer groups (load balancing across workers), and
`XAUTOCLAIM` to recover messages from dead consumers.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, AsyncIterator

import orjson
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class StreamMessage:
    message_id: str
    stream: str
    payload: dict[str, Any]


def _encode(payload: dict[str, Any]) -> dict[str, str]:
    # Streams store string→string; we keep a single "data" field with JSON
    # to avoid type coercion surprises. The stream id already gives ordering.
    return {"data": orjson.dumps(payload).decode()}


def _decode(fields: dict[str, str]) -> dict[str, Any]:
    raw = fields.get("data")
    return orjson.loads(raw) if raw else {}


class StreamQueue:
    def __init__(self, redis: aioredis.Redis, stream: str, group: str):
        self._redis = redis
        self._stream = stream
        self._group = group

    async def ensure_group(self) -> None:
        """Create the consumer group if it doesn't already exist."""
        try:
            await self._redis.xgroup_create(
                name=self._stream,
                groupname=self._group,
                id="$",
                mkstream=True,
            )
            logger.info(
                "Created consumer group %s on stream %s", self._group, self._stream
            )
        except aioredis.ResponseError as exc:
            if "BUSYGROUP" not in str(exc):
                raise

    async def publish(self, payload: dict[str, Any], *, maxlen: int = 100_000) -> str:
        """
        Publish a job. `maxlen` uses Redis' approximate trimming (~) so producers
        stay O(1) — we cap stream memory growth without pausing for exact trims.
        """
        return await self._redis.xadd(
            self._stream,
            _encode(payload),
            maxlen=maxlen,
            approximate=True,
        )

    async def consume(
        self,
        consumer_name: str,
        *,
        batch: int = 32,
        block_ms: int = 5_000,
    ) -> AsyncIterator[StreamMessage]:
        """
        Async iterator yielding messages for a specific consumer.

        Caller is responsible for calling `ack(msg.message_id)` once the job
        has been processed. Un-ack'd messages stay in the PEL and can be
        reclaimed by `reclaim_idle()` — exactly-once processing with retry
        semantics.
        """
        await self.ensure_group()
        while True:
            entries = await self._redis.xreadgroup(
                groupname=self._group,
                consumername=consumer_name,
                streams={self._stream: ">"},
                count=batch,
                block=block_ms,
            )
            if not entries:
                continue
            for _, messages in entries:
                for msg_id, fields in messages:
                    yield StreamMessage(
                        message_id=msg_id,
                        stream=self._stream,
                        payload=_decode(fields),
                    )

    async def ack(self, message_id: str) -> None:
        await self._redis.xack(self._stream, self._group, message_id)

    async def reclaim_idle(
        self, consumer_name: str, *, min_idle_ms: int = 60_000, count: int = 100
    ) -> list[StreamMessage]:
        """
        Reclaim messages idle for longer than `min_idle_ms` — these likely
        belonged to a consumer that died mid-processing. Called periodically
        by each worker to self-heal.
        """
        next_id, claimed, _ = await self._redis.xautoclaim(
            name=self._stream,
            groupname=self._group,
            consumername=consumer_name,
            min_idle_time=min_idle_ms,
            start_id="0-0",
            count=count,
        )
        return [
            StreamMessage(
                message_id=msg_id, stream=self._stream, payload=_decode(fields)
            )
            for msg_id, fields in claimed
        ]

    async def pending_count(self) -> int:
        info = await self._redis.xpending(self._stream, self._group)
        return info.get("pending", 0) if isinstance(info, dict) else 0

    async def length(self) -> int:
        return await self._redis.xlen(self._stream)
