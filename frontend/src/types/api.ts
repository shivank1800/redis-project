/**
 * Shared API contracts.
 *
 * These types mirror the FastAPI backend response models. Keeping contracts in
 * one file gives the frontend compile-time safety while still letting the
 * backend evolve independently.
 *
 * Redis connection:
 * - Feed and trending data are served by backend endpoints backed by Redis
 *   Sorted Sets.
 * - Notification payloads arrive from Redis Streams/PubSub through WebSocket.
 */

export type UserPublic = {
  id: number;
  username: string;
  display_name: string;
  bio: string;
  created_at: string;
};

export type UserProfile = UserPublic & {
  follower_count: number;
  following_count: number;
  post_count: number;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type SignupPayload = LoginPayload & {
  email: string;
  display_name?: string;
  bio?: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: UserPublic;
};

export type Post = {
  id: number;
  author_id: number;
  content: string;
  created_at: string;
  like_count: number;
  comment_count: number;
};

export type Comment = {
  id: number;
  post_id: number;
  author_id: number;
  content: string;
  created_at: string;
};

export type TrendingPost = {
  post: Post;
  score: number;
};

export type NotificationEvent = {
  kind: "like" | "comment" | "follow" | string;
  actor_id: number;
  recipient_id: number;
  object_type: "post" | "user" | string;
  object_id: number;
  message: string;
  ts: number;
  stream_id?: string;
};

export type NotificationsResponse = {
  items: NotificationEvent[];
  unread: number;
};

export type ApiErrorKind =
  | "rate_limited"
  | "unauthorized"
  | "network"
  | "server"
  | "unknown";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  retryAfterSeconds?: number;

  constructor(message: string, kind: ApiErrorKind, status?: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
