"""
Notification emission + read API.

Emission: written to TWO places.
    1. Per-user Redis Stream (`notif:stream:{uid}`) — durable history, replayable.
    2. Per-user Pub/Sub channel (`notif:pub:{uid}`) — live WebSocket push.

Why both?
    * Streams give us durability, consumer groups, replay after reconnect.
    * Pub/Sub gives us the lowest-latency push path (no polling, no XREAD
      block budget burned per client).
    * If a client is offline, the message waits in the stream.
    * If it's online, the pub/sub push delivers it in <1ms.

We also publish a job onto `jobs:notifications` so the notification worker
can persist the event to Postgres without blocking the user's request.
"""
from __future__ import annotations

import logging
import time

import orjson
import redis.asyncio as aioredis

from app.redis_layer import pubsub
from app.redis_layer.keys import K
from app.redis_layer.queue import StreamQueue
from app.schemas.notification import NotificationEvent

logger = logging.getLogger(__name__)

_MAX_STREAM_LEN = 1_000  # per-user retention


async def emit_notification(
    redis: aioredis.Redis,
    *,
    kind: str,
    actor_id: int,
    recipient_id: int,
    object_type: str,
    object_id: int,
    message: str = "",
) -> None:
    if actor_id == recipient_id:
        return  # never notify yourself

    event = NotificationEvent(
        kind=kind,
        actor_id=actor_id,
        recipient_id=recipient_id,
        object_type=object_type,
        object_id=object_id,
        message=message,
        ts=time.time(),
    )
    payload = event.model_dump()

    pipe = redis.pipeline()
    pipe.xadd(
        K.notification_stream(recipient_id),
        {"data": orjson.dumps(payload).decode()},
        maxlen=_MAX_STREAM_LEN,
        approximate=True,
    )
    pipe.incr(K.notification_unread(recipient_id))
    pipe.expire(K.notification_unread(recipient_id), 60 * 60 * 24 * 30)  # 30d
    await pipe.execute()

    await pubsub.publish(redis, K.notification_pubsub(recipient_id), payload)

    # Async persistence.
    queue = StreamQueue(redis, K.STREAM_NOTIFICATIONS, group="notif-workers")
    await queue.publish({"type": "persist", **payload})


async def list_notifications(
    redis: aioredis.Redis, user_id: int, *, last_id: str = "0-0", limit: int = 50
) -> list[dict]:
    """
    Fetch historical notifications for a user by scanning their stream.

    `last_id` enables pagination / resumable reads (clients send the highest
    stream-id they've seen). `"$"` would mean "only future messages" which
    is what the WebSocket tailing loop uses.
    """
    entries = await redis.xrevrange(
        K.notification_stream(user_id), max="+", min="-", count=limit
    )
    out = []
    for msg_id, fields in entries:
        data = fields.get("data")
        if not data:
            continue
        payload = orjson.loads(data)
        payload["stream_id"] = msg_id
        out.append(payload)
    return out


async def mark_all_read(redis: aioredis.Redis, user_id: int) -> None:
    await redis.delete(K.notification_unread(user_id))


async def unread_count(redis: aioredis.Redis, user_id: int) -> int:
    val = await redis.get(K.notification_unread(user_id))
    return int(val or 0)
