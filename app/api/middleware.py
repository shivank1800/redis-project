"""
Rate-limiting middleware — enforced at the edge for every HTTP request.

Uses the sliding-window limiter for strict control on write paths and a
cheaper default bucket for reads. Identity is: user_id if authenticated,
otherwise IP.
"""
from __future__ import annotations

import logging
import time

from redis.exceptions import RedisError
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.redis_layer.client import get_redis
from app.redis_layer.keys import K
from app.redis_layer.rate_limiter import SlidingWindowLimiter
from app.security import decode_token

logger = logging.getLogger(__name__)

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_EXEMPT_PATHS = {"/health", "/metrics", "/docs", "/redoc", "/openapi.json"}


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        # Never rate-limit CORS preflight; blocking OPTIONS surfaces as opaque
        # "network error" failures in browsers before the real request is sent.
        if request.method == "OPTIONS":
            return await call_next(request)

        if path in _EXEMPT_PATHS or path.startswith("/ws/"):
            return await call_next(request)

        identity = _resolve_identity(request)
        bucket = "write" if request.method in _WRITE_METHODS else "read"
        limit = (
            settings.rate_limit_write_per_minute
            if bucket == "write"
            else settings.rate_limit_default_per_minute
        )

        redis = await get_redis()
        limiter = SlidingWindowLimiter(
            redis, window_seconds=60, max_events=limit
        )
        try:
            result = await limiter.check(K.rate_limit(bucket, identity))
        except RedisError as exc:
            # Fail-open if Redis is temporarily saturated/unavailable; serving
            # requests is preferable to returning opaque 500 network failures.
            logger.warning("Rate limiter unavailable (%s); skipping check", exc)
            return await call_next(request)

        if not result.allowed:
            logger.info(
                "Rate-limited identity=%s bucket=%s retry_after_ms=%d",
                identity,
                bucket,
                result.retry_after_ms,
            )
            retry_s = max(1, result.retry_after_ms // 1000)
            return JSONResponse(
                {"error": "rate_limited", "retry_after_seconds": retry_s},
                status_code=429,
                headers={"Retry-After": str(retry_s)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(int(result.remaining))
        response.headers["X-RateLimit-Bucket"] = bucket
        return response


def _resolve_identity(request: Request) -> str:
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
        try:
            payload = decode_token(token)
            return f"user:{payload['sub']}"
        except Exception:
            return f"token:{token[:16]}"
    fwd = request.headers.get("x-forwarded-for") or ""
    ip = fwd.split(",")[0].strip() if fwd else (
        request.client.host if request.client else "unknown"
    )
    return f"ip:{ip}"
