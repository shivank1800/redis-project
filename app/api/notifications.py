from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status

from app.api.deps import CurrentUser, RedisDep
from app.redis_layer import pubsub
from app.redis_layer.client import get_redis
from app.redis_layer.keys import K
from app.security import decode_token
from app.services import notification_service, session_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])
_active_ws_tokens: set[str] = set()
_active_ws_lock = asyncio.Lock()


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

    async with _active_ws_lock:
        if token in _active_ws_tokens:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        _active_ws_tokens.add(token)

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
        async for payload in pubsub.subscribe(redis, channel):
            await websocket.send_json({"type": "event", "payload": payload})
    except WebSocketDisconnect:
        logger.info("WS disconnected user=%s", user_id)
    except asyncio.CancelledError:
        pass
    finally:
        async with _active_ws_lock:
            _active_ws_tokens.discard(token)


async def _resolve_user(redis, token: str) -> int | None:
    session = await session_service.get_session(redis, token)
    if session:
        return int(session["user_id"])
    try:
        return int(decode_token(token)["sub"])
    except Exception:
        return None
