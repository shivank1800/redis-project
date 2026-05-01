from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DBDep, RedisDep
from app.schemas.common import MessageResponse
from app.schemas.post import CommentCreate, CommentOut, PostCreate, PostOut
from app.services import analytics_service, feed_service, post_service

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostOut, status_code=201)
async def create_post(
    data: PostCreate, db: DBDep, redis: RedisDep, user_id: CurrentUser
):
    post = await feed_service.create_post(db, redis, user_id, data)
    await analytics_service.record_activity(
        redis, user_id=user_id, kind="post", target=f"post:{post.id}"
    )
    hydrated = await feed_service.hydrate_posts(db, redis, [post.id])
    return hydrated[0] if hydrated else PostOut.model_validate(post)


@router.get("/{post_id}", response_model=PostOut)
async def get_post(
    post_id: int, db: DBDep, redis: RedisDep, user_id: CurrentUser
):
    posts = await feed_service.hydrate_posts(db, redis, [post_id])
    if not posts:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "post not found")
    await analytics_service.record_post_view(redis, post_id, user_id)
    return posts[0]


@router.post("/{post_id}/like", response_model=MessageResponse)
async def like(
    post_id: int, db: DBDep, redis: RedisDep, user_id: CurrentUser
):
    ok = await post_service.like_post(db, redis, user_id, post_id)
    await analytics_service.record_activity(
        redis, user_id=user_id, kind="like", target=f"post:{post_id}"
    )
    return MessageResponse(message="liked" if ok else "already liked")


@router.delete("/{post_id}/like", response_model=MessageResponse)
async def unlike(
    post_id: int, db: DBDep, redis: RedisDep, user_id: CurrentUser
):
    ok = await post_service.unlike_post(db, redis, user_id, post_id)
    return MessageResponse(message="unliked" if ok else "not liked")


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=201)
async def comment(
    post_id: int,
    data: CommentCreate,
    db: DBDep,
    redis: RedisDep,
    user_id: CurrentUser,
):
    c = await post_service.comment_on_post(db, redis, user_id, post_id, data)
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "post not found")
    await analytics_service.record_activity(
        redis, user_id=user_id, kind="comment", target=f"post:{post_id}"
    )
    return c


@router.get("/{post_id}/comments", response_model=list[CommentOut])
async def list_comments(post_id: int, db: DBDep):
    return await post_service.list_comments(db, post_id)
