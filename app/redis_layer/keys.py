"""
Centralised Redis key-naming conventions.

Why one module? Key typos are a classic source of bugs; having every key
constructed from a single class guarantees consistency and makes it trivial
to audit which features use which key-spaces.

Namespacing strategy:
    <domain>:<entity>:<id>[:<sub>]

All keys are lowercase, colon-separated, and keep cardinality bounded.
"""
from __future__ import annotations

from datetime import date


class K:
    # --- Cache (string / hash) ----------------------------------------------
    @staticmethod
    def user_cache(user_id: int) -> str:
        return f"cache:user:{user_id}"

    @staticmethod
    def post_cache(post_id: int) -> str:
        return f"cache:post:{post_id}"

    @staticmethod
    def user_by_username(username: str) -> str:
        return f"cache:user:by_username:{username.lower()}"

    # --- Counters (atomic INCR) ---------------------------------------------
    @staticmethod
    def post_like_count(post_id: int) -> str:
        return f"counter:post:{post_id}:likes"

    @staticmethod
    def post_comment_count(post_id: int) -> str:
        return f"counter:post:{post_id}:comments"

    @staticmethod
    def user_follower_count(user_id: int) -> str:
        return f"counter:user:{user_id}:followers"

    @staticmethod
    def user_following_count(user_id: int) -> str:
        return f"counter:user:{user_id}:following"

    # --- Social graph (sets) -------------------------------------------------
    @staticmethod
    def user_followers(user_id: int) -> str:
        return f"social:followers:{user_id}"

    @staticmethod
    def user_following(user_id: int) -> str:
        return f"social:following:{user_id}"

    @staticmethod
    def post_likers(post_id: int) -> str:
        return f"social:post_likers:{post_id}"

    # --- Feed (sorted sets) --------------------------------------------------
    @staticmethod
    def home_feed(user_id: int) -> str:
        """Materialised timeline: ZSET score=timestamp, member=post_id."""
        return f"feed:home:{user_id}"

    @staticmethod
    def user_posts(user_id: int) -> str:
        """User's own posts timeline (used for fan-out on read)."""
        return f"feed:user:{user_id}"

    # --- Trending ------------------------------------------------------------
    TRENDING_POSTS = "trending:posts"  # ZSET with decayed scores

    @staticmethod
    def trending_bucket(hour_bucket: str) -> str:
        return f"trending:bucket:{hour_bucket}"

    # --- Leaderboard ---------------------------------------------------------
    LEADERBOARD_KARMA = "leaderboard:karma"  # ZSET score=karma, member=user_id

    # --- Notifications -------------------------------------------------------
    @staticmethod
    def notification_stream(user_id: int) -> str:
        """Per-user durable Redis Stream of notifications."""
        return f"notif:stream:{user_id}"

    @staticmethod
    def notification_pubsub(user_id: int) -> str:
        """Per-user pub/sub channel for live WebSocket delivery."""
        return f"notif:pub:{user_id}"

    @staticmethod
    def notification_unread(user_id: int) -> str:
        return f"notif:unread:{user_id}"

    # --- Sessions ------------------------------------------------------------
    @staticmethod
    def session(token: str) -> str:
        return f"session:{token}"

    @staticmethod
    def user_sessions(user_id: int) -> str:
        """SET of active session tokens for a user (for logout-all)."""
        return f"session:user:{user_id}"

    # --- Rate limiting -------------------------------------------------------
    @staticmethod
    def rate_limit(bucket: str, identity: str) -> str:
        return f"rl:{bucket}:{identity}"

    # --- Locks ---------------------------------------------------------------
    @staticmethod
    def lock(resource: str) -> str:
        return f"lock:{resource}"

    # --- Job queues (Redis Streams) -----------------------------------------
    STREAM_FANOUT = "jobs:fanout"            # fan-out feed writes
    STREAM_NOTIFICATIONS = "jobs:notifications"  # notification delivery

    # --- Analytics / HyperLogLog --------------------------------------------
    @staticmethod
    def dau(day: date | str) -> str:
        if isinstance(day, date):
            day = day.isoformat()
        return f"analytics:dau:{day}"

    @staticmethod
    def post_unique_viewers(post_id: int) -> str:
        return f"analytics:post_views:{post_id}"

    # --- Search (recent activity) -------------------------------------------
    RECENT_ACTIVITY = "activity:recent"  # capped LIST

    @staticmethod
    def user_activity(user_id: int) -> str:
        return f"activity:user:{user_id}"
