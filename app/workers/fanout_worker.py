"""
Fan-out worker — consumes `jobs:fanout` stream, writes to follower feeds.

Run multiple copies horizontally; the consumer group balances jobs across
them. Idle messages (stalled consumers) are periodically reclaimed via
`XAUTOCLAIM` so we're resilient to worker crashes.
"""
from __future__ import annotations

import asyncio
import logging
import signal

from app.config import settings
from app.database import SessionLocal
from app.logging_setup import configure_logging
from app.redis_layer.client import close_redis, get_redis
from app.redis_layer.keys import K
from app.redis_layer.queue import StreamMessage, StreamQueue
from app.services import feed_service, follow_service

logger = logging.getLogger(__name__)

GROUP = "fanout-workers"


async def _handle(redis, msg: StreamMessage) -> None:
    p = msg.payload
    t = p.get("type")
    if t == "fanout_post":
        post_id = int(p["post_id"])
        author_id = int(p["author_id"])
        score = float(p["score"])
        async with SessionLocal() as db:
            followers = await follow_service.get_followers(db, redis, author_id, limit=100_000)
        total = 0
        for i in range(0, len(followers), settings.fanout_batch_size):
            batch = followers[i : i + settings.fanout_batch_size]
            total += await feed_service.fanout_post_to_followers(
                redis, post_id=post_id, author_id=author_id, score=score, follower_ids=batch
            )
        logger.info(
            "Fanned out post %s from author %s to %d followers", post_id, author_id, total
        )

    elif t == "backfill_follower":
        follower_id = int(p["follower_id"])
        followee_id = int(p["followee_id"])
        count = await feed_service.backfill_follower_feed(redis, follower_id, followee_id)
        logger.info(
            "Backfilled %d posts from %s into feed of %s", count, followee_id, follower_id
        )
    else:
        logger.warning("Unknown fan-out job type: %s", t)


async def run() -> None:
    configure_logging()
    redis = await get_redis()
    queue = StreamQueue(redis, K.STREAM_FANOUT, group=GROUP)
    await queue.ensure_group()

    consumer = settings.worker_name
    logger.info("Fan-out worker %s starting", consumer)

    stop = asyncio.Event()

    def _shutdown(*_):
        logger.info("Shutdown signal received")
        stop.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, _shutdown)
        except NotImplementedError:
            pass

    async def reclaim_loop():
        while not stop.is_set():
            try:
                claimed = await queue.reclaim_idle(consumer, min_idle_ms=60_000, count=100)
                for msg in claimed:
                    try:
                        await _handle(redis, msg)
                        await queue.ack(msg.message_id)
                    except Exception:
                        logger.exception("Failed re-processing reclaimed msg %s", msg.message_id)
            except Exception:
                logger.exception("reclaim loop error")
            await asyncio.sleep(30)

    reclaim_task = asyncio.create_task(reclaim_loop())

    try:
        async for msg in queue.consume(consumer, batch=32, block_ms=5_000):
            if stop.is_set():
                break
            try:
                await _handle(redis, msg)
                await queue.ack(msg.message_id)
            except Exception:
                # No ack — the message will be redelivered via XAUTOCLAIM.
                logger.exception("Job %s failed; will be retried", msg.message_id)
    finally:
        reclaim_task.cancel()
        await close_redis()


if __name__ == "__main__":
    asyncio.run(run())
