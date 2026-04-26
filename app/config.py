"""
Centralised configuration using pydantic-settings.

Values are read from environment variables (and .env file in dev). Everything
is typed so the rest of the codebase can rely on `settings.xyz` being correct.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---------------------------------------------------------
    app_name: str = "redis-social-feed"
    app_env: Literal["development", "staging", "production", "test"] = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    log_level: str = "INFO"

    # --- Security ------------------------------------------------------------
    secret_key: str = "dev-secret-change-me"
    access_token_ttl_seconds: int = 86_400  # 24h
    jwt_algorithm: str = "HS256"

    # --- PostgreSQL ----------------------------------------------------------
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "feeduser"
    postgres_password: str = "feedpass"
    postgres_db: str = "feeddb"

    # --- Redis ---------------------------------------------------------------
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str | None = None

    # --- Feed tuning ---------------------------------------------------------
    # Maximum number of entries kept per user's materialised timeline.
    feed_max_size: int = 1_000
    # Fan-out jobs push batches of follower IDs to workers of this size.
    fanout_batch_size: int = 500
    # Users with more followers than this are treated as "celebrities" and
    # fanned-out on READ rather than on WRITE to avoid thundering herd.
    celebrity_follower_threshold: int = 10_000

    # --- Rate limiting -------------------------------------------------------
    rate_limit_default_per_minute: int = 120
    rate_limit_write_per_minute: int = 30

    # --- Trending ------------------------------------------------------------
    # Score = likes * exp(-lambda * age_hours). Higher lambda = faster decay.
    trending_decay_lambda: float = 0.08
    trending_window_hours: int = 48

    # --- Worker --------------------------------------------------------------
    worker_name: str = "worker-1"

    # --- Derived -------------------------------------------------------------
    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def postgres_sync_dsn(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
