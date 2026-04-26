from __future__ import annotations

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBDep, RedisDep
from app.schemas.post import PostOut, TrendingPost
from app.services import feed_service, trending_service

router = APIRouter(prefix="/feed", tags=["feed"])


@router.get("/home", response_model=list[PostOut])
async def home_feed(
    db: DBDep,
    redis: RedisDep,
    user_id: CurrentUser,
    limit: int = Query(30, ge=1, le=100),
    before_ts: float | None = Query(
        default=None, description="Epoch seconds; return posts older than this"
    ),
):
    return await feed_service.get_home_feed(
        db, redis, user_id, limit=limit, before_ts=before_ts
    )


@router.get("/trending", response_model=list[TrendingPost])
async def trending(
    db: DBDep, redis: RedisDep, limit: int = Query(20, ge=1, le=100)
):
    top = await trending_service.get_trending(redis, limit=limit)
    if not top:
        return []
    ids = [pid for pid, _ in top]
    posts = {p.id: p for p in await feed_service.hydrate_posts(db, redis, ids)}
    return [
        TrendingPost(post=posts[pid], score=score)
        for pid, score in top
        if pid in posts
    ]
