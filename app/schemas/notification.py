from __future__ import annotations

from pydantic import BaseModel


class NotificationEvent(BaseModel):
    """
    Shape of a notification as it flows through Redis Streams + Pub/Sub.

    Kept small and stable because it is cross-service contract.
    """

    kind: str  # "like" | "comment" | "follow"
    actor_id: int
    recipient_id: int
    object_type: str  # "post" | "user"
    object_id: int
    message: str = ""
    ts: float  # epoch seconds (client-agnostic)
