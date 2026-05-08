from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
import orjson

from app.api.deps import CurrentUser, RedisDep
from app.redis_layer.client import get_redis
from app.redis_layer.keys import K
from app.security import decode_token
from app.services import notification_service, session_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(
    redis: RedisDep,
    user_id: CurrentUser,
    limit: int = Query(50, ge=1, le=200),
):
    items = await notification_service.list_notifications(redis, user_id, limit=limit)
    unread = await notification_service.unread_count(redis, user_id)
    return {"items": items, "unread": unread}


@router.post("/read-all")
async def mark_all_read(redis: RedisDep, user_id: CurrentUser):
    await notification_service.mark_all_read(redis, user_id)
    return {"status": "ok"}


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket, token: str | None = None):
    """
    Live notification stream via WebSocket.

    Auth: pass `?token=<session-token-or-jwt>` because browsers don't send
    Authorization on WS upgrades.

    Flow:
        1. Authenticate → resolve user_id.
        2. Replay last 20 notifications from the user's Redis Stream so the
           client has immediate context.
        3. Subscribe to the user's pub/sub channel and forward live events.
    """
    await websocket.accept()
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    redis = await get_redis()
    user_id: int | None = None
    try:
        user_id = await _resolve_user(redis, token)
        if user_id is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        history = await notification_service.list_notifications(redis, user_id, limit=20)
        await websocket.send_json({"type": "history", "items": history})

        channel = K.notification_pubsub(user_id)
        pubsub_client = redis.pubsub()
        await pubsub_client.subscribe(channel)
        try:
            while True:
                msg_task = asyncio.create_task(
                    pubsub_client.get_message(
                        ignore_subscribe_messages=True,
                        timeout=1.0,
                    )
                )
                recv_task = asyncio.create_task(websocket.receive())
                done, pending = await asyncio.wait(
                    {msg_task, recv_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                for task in pending:
                    task.cancel()
                if pending:
                    await asyncio.gather(*pending, return_exceptions=True)

                if recv_task in done:
                    event = recv_task.result()
                    if event["type"] == "websocket.disconnect":
                        break

                if msg_task in done:
                    message = msg_task.result()
                    if not message or message.get("type") != "message":
                        continue
                    payload = message.get("data")
                    if isinstance(payload, bytes):
                        payload = payload.decode()
                    await websocket.send_json(
                        {"type": "event", "payload": orjson.loads(payload)}
                    )
        finally:
            await pubsub_client.unsubscribe(channel)
            await pubsub_client.aclose()
    except WebSocketDisconnect:
        logger.info("WS disconnected user=%s", user_id)
    except asyncio.CancelledError:
        pass


async def _resolve_user(redis, token: str) -> int | None:
    session = await session_service.get_session(redis, token)
    if session:
        return int(session["user_id"])
    try:
        return int(decode_token(token)["sub"])
    except Exception:
        return None
