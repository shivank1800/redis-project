"""Redis Streams queue + consumer groups."""
from __future__ import annotations

import asyncio

import pytest

from app.redis_layer.queue import StreamQueue


async def test_publish_and_consume(redis):
    q = StreamQueue(redis, "test:stream", group="g1")
    await q.ensure_group()
    await q.publish({"x": 1})

    messages = []

    async def consume_once():
        async for msg in q.consume("consumer-1", batch=1, block_ms=100):
            messages.append(msg)
            await q.ack(msg.message_id)
            break

    await asyncio.wait_for(consume_once(), timeout=3)
    assert len(messages) == 1
    assert messages[0].payload == {"x": 1}
    assert await q.length() == 1


async def test_consumer_group_load_balances(redis):
    q = StreamQueue(redis, "test:lb", group="g1")
    await q.ensure_group()
    for i in range(10):
        await q.publish({"i": i})

    collected_by_consumer: dict[str, int] = {"c1": 0, "c2": 0}

    async def worker(name: str, n: int):
        taken = 0
        async for msg in q.consume(name, batch=1, block_ms=100):
            collected_by_consumer[name] += 1
            await q.ack(msg.message_id)
            taken += 1
            if taken >= n:
                break

    # Two workers race for 10 messages; each should get ≥ 1.
    await asyncio.wait_for(
        asyncio.gather(worker("c1", 5), worker("c2", 5)), timeout=5
    )
    assert sum(collected_by_consumer.values()) == 10
    assert collected_by_consumer["c1"] >= 1
    assert collected_by_consumer["c2"] >= 1


async def test_ensure_group_is_idempotent(redis):
    q = StreamQueue(redis, "test:idem", group="g1")
    await q.ensure_group()
    await q.ensure_group()  # must not raise
