from __future__ import annotations

from datetime import date, timedelta

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, RedisDep
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dau")
async def dau(redis: RedisDep, days: int = Query(7, ge=1, le=90)):
    today = date.today()
    dates = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
    return await analytics_service.dau_range(redis, dates)


@router.get("/leaderboard")
async def leaderboard(redis: RedisDep, limit: int = Query(50, ge=1, le=200)):
    entries = await analytics_service.top_leaderboard(redis, limit=limit)
    return [{"user_id": uid, "karma": score} for uid, score in entries]


@router.get("/leaderboard/me")
async def my_rank(redis: RedisDep, user_id: CurrentUser):
    rank = await analytics_service.user_rank(redis, user_id)
    return {"rank": rank}


@router.get("/search")
async def search(
    redis: RedisDep,
    q: str = Query(..., min_length=1, max_length=128),
    limit: int = Query(50, ge=1, le=200),
):
    return await analytics_service.search_recent(redis, q, limit=limit)


@router.get("/posts/{post_id}/unique-views")
async def post_unique(redis: RedisDep, post_id: int):
    return {"post_id": post_id, "unique": await analytics_service.post_unique_viewers(redis, post_id)}
