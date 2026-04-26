"""
Notification persistence worker.

Ephemeral Redis Stream -> durable Postgres table. Also credits the post
author with karma on the leaderboard.
"""
from __future__ import annotations

import asyncio
import logging
import signal

from app.config import settings
from app.database import SessionLocal
from app.logging_setup import configure_logging
from app.models import Notification
from app.redis_layer.client import close_redis, get_redis
from app.redis_layer.keys import K
from app.redis_layer.queue import StreamMessage, StreamQueue
from app.services import analytics_service

logger = logging.getLogger(__name__)

GROUP = "notif-workers"

_KARMA_PER_KIND = {"like": 1, "comment": 2, "follow": 3}


async def _handle(redis, msg: StreamMessage) -> None:
    p = msg.payload
    if p.get("type") != "persist":
        logger.warning("Unknown notif job type: %s", p.get("type"))
        return

    async with SessionLocal() as db:
        db.add(
            Notification(
                recipient_id=int(p["recipient_id"]),
                actor_id=int(p["actor_id"]),
                kind=p["kind"],
                object_type=p["object_type"],
                object_id=int(p["object_id"]),
                message=p.get("message", ""),
            )
        )
        await db.commit()

    delta = _KARMA_PER_KIND.get(p["kind"], 0)
    if delta:
        await analytics_service.add_karma(redis, int(p["recipient_id"]), delta)


async def run() -> None:
    configure_logging()
    redis = await get_redis()
    queue = StreamQueue(redis, K.STREAM_NOTIFICATIONS, group=GROUP)
    await queue.ensure_group()

    consumer = settings.worker_name
    logger.info("Notification worker %s starting", consumer)

    stop = asyncio.Event()

    def _shutdown(*_):
        stop.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, _shutdown)
        except NotImplementedError:
            pass

    try:
        async for msg in queue.consume(consumer, batch=64, block_ms=5_000):
            if stop.is_set():
                break
            try:
                await _handle(redis, msg)
                await queue.ack(msg.message_id)
            except Exception:
                logger.exception("Notification job %s failed; will retry", msg.message_id)
    finally:
        await close_redis()


if __name__ == "__main__":
    asyncio.run(run())
