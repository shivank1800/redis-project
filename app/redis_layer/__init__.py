"""
Redis abstraction layer.

All direct interaction with Redis flows through this package. This keeps
key naming, serialisation, and Redis-specific error handling in one place so
that the rest of the code can stay clean and testable.
"""
from app.redis_layer.client import RedisClient, get_redis, close_redis  # noqa: F401
from app.redis_layer.keys import K  # noqa: F401
