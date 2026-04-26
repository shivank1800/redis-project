"""
FastAPI entry point.

Wires together:
    * Routers (auth, users, posts, feed, notifications, analytics, health)
    * Rate-limiting middleware
    * Lifespan: initialise DB + ensure consumer groups exist
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, auth, feed, health, notifications, posts, users
from app.api.middleware import RateLimitMiddleware
from app.config import settings
from app.database import init_models
from app.logging_setup import configure_logging
from app.redis_layer.client import close_redis, get_redis
from app.redis_layer.keys import K
from app.redis_layer.queue import StreamQueue

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info("Starting %s (env=%s)", settings.app_name, settings.app_env)
    await init_models()
    redis = await get_redis()

    # Make sure consumer groups exist so publishers never block on them.
    for stream, group in (
        (K.STREAM_FANOUT, "fanout-workers"),
        (K.STREAM_NOTIFICATIONS, "notif-workers"),
    ):
        q = StreamQueue(redis, stream, group=group)
        await q.ensure_group()

    yield
    await close_redis()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Real-Time Social Feed + Notifications (Redis-centric)",
    version="1.0.0",
    description=(
        "A production-style social feed backend where Redis is the primary "
        "data plane: feed fan-out, real-time notifications, rate limiting, "
        "trending, leaderboard, DAU, sessions, distributed locks, and durable "
        "job queues all live in Redis."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(posts.router)
app.include_router(feed.router)
app.include_router(notifications.router)
app.include_router(analytics.router)


@app.get("/", tags=["root"])
async def root():
    return {
        "app": settings.app_name,
        "version": app.version,
        "docs": "/docs",
        "health": "/health",
    }
