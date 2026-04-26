from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(default="", max_length=128)
    bio: str = Field(default="", max_length=512)


class UserPublic(ORMModel):
    id: int
    username: str
    display_name: str
    bio: str
    created_at: datetime


class UserProfile(UserPublic):
    follower_count: int = 0
    following_count: int = 0
    post_count: int = 0


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserPublic
