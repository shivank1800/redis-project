from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.user import UserPublic


class PostCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class PostOut(ORMModel):
    id: int
    author_id: int
    author: UserPublic | None = None
    content: str
    created_at: datetime
    like_count: int = 0
    comment_count: int = 0


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1024)


class CommentOut(ORMModel):
    id: int
    post_id: int
    author_id: int
    content: str
    created_at: datetime


class TrendingPost(BaseModel):
    post: PostOut
    score: float
