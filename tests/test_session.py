"""Session service — create, revoke, revoke-all semantics."""
from __future__ import annotations

import pytest

from app.services import session_service


async def test_create_and_get_session(redis):
    token = await session_service.create_session(redis, 42, user_agent="ua", ip="1.2.3.4")
    data = await session_service.get_session(redis, token)
    assert data is not None
    assert int(data["user_id"]) == 42
    assert data["ip"] == "1.2.3.4"


async def test_revoke_session(redis):
    token = await session_service.create_session(redis, 1)
    await session_service.revoke_session(redis, token)
    assert await session_service.get_session(redis, token) is None


async def test_revoke_all_kills_every_session(redis):
    tokens = [await session_service.create_session(redis, 1) for _ in range(3)]
    await session_service.create_session(redis, 2)  # unaffected
    killed = await session_service.revoke_all_sessions(redis, 1)
    assert killed == 3
    for t in tokens:
        assert await session_service.get_session(redis, t) is None
