/**
 * Central API client.
 *
 * WHAT:
 * This file is the only place that knows backend URLs, auth headers, and error
 * translation. Components and hooks call small typed functions instead of
 * directly touching Axios.
 *
 * WHY:
 * Production frontends need a clean network boundary. It keeps UI code focused
 * on state and rendering while this layer handles tokens, 401s, 429s, and
 * backend response shapes.
 *
 * HOW IT CONNECTS TO THE REDIS-BACKED BACKEND:
 * The backend uses Redis for sessions, rate limits, feeds, trending, and
 * notifications. The frontend does not talk to Redis directly; it receives
 * the benefits through normal HTTP/WebSocket endpoints:
 * - `/feed/home` is fast because the backend reads Redis Sorted Sets.
 * - `/feed/trending` is fast because Redis keeps a scored trending ZSET.
 * - `/notifications/ws` streams Redis Pub/Sub/Stream-backed events.
 * - 429 responses come from Redis-backed distributed rate limiting.
 */

import axios, { AxiosError } from "axios";
import type {
  ApiErrorKind,
  Comment,
  LoginPayload,
  NotificationEvent,
  NotificationsResponse,
  Post,
  SignupPayload,
  TokenResponse,
  TrendingPost,
  UserProfile,
  UserPublic,
} from "../types/api";
import { ApiError } from "../types/api";
import { clearAuthStorage, getStoredToken } from "../utils/storage";

/**
 * In local `npm run dev`, default to same-origin requests so Vite can proxy to
 * FastAPI. That way signup and other calls work when the UI is opened as
 * http://<LAN-IP>:5173 (the browser would otherwise try <device>:8000 for
 * localhost:8000 and fail). Production builds still default to localhost:8000
 * unless VITE_API_BASE_URL is set at build time (e.g. Docker).
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "" : "http://localhost:8000");

function wsBaseUrl(): string {
  if (import.meta.env.VITE_WS_BASE_URL) {
    return import.meta.env.VITE_WS_BASE_URL;
  }
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${scheme}//${window.location.host}`;
  }
  return "ws://localhost:8000";
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12_000,
});

client.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; detail?: string; retry_after_seconds?: number }>) => {
    const status = error.response?.status;

    if (!error.response) {
      throw new ApiError(
        "Network error. Check that the FastAPI backend is running.",
        "network",
      );
    }

    if (status === 401) {
      clearAuthStorage();
      throw new ApiError("Your session expired. Please log in again.", "unauthorized", status);
    }

    if (status === 429) {
      const retryAfterHeader = error.response.headers["retry-after"];
      const retryAfterSeconds =
        Number(error.response.data?.retry_after_seconds) ||
        Number(retryAfterHeader) ||
        1;

      throw new ApiError(
        `Too many requests. Try again in ${retryAfterSeconds}s.`,
        "rate_limited",
        status,
        retryAfterSeconds,
      );
    }

    const kind: ApiErrorKind = status && status >= 500 ? "server" : "unknown";
    throw new ApiError(
      error.response.data?.detail ?? error.response.data?.error ?? "Request failed.",
      kind,
      status,
    );
  },
);

export const api = {
  /**
   * Auth: creates a server-side Redis session and returns the opaque token.
   * The token is not the source of truth; Redis is.
   */
  async login(payload: LoginPayload): Promise<TokenResponse> {
    const { data } = await client.post<TokenResponse>("/auth/login", payload);
    return data;
  },

  /**
   * Signup returns the public user. We then log in separately so the session is
   * created through the same Redis-backed `/auth/login` flow.
   */
  async signup(payload: SignupPayload): Promise<UserPublic> {
    const { data } = await client.post<UserPublic>("/auth/register", payload);
    return data;
  },

  async logout(): Promise<void> {
    await client.post("/auth/logout");
  },

  async me(): Promise<UserProfile> {
    const { data } = await client.get<UserProfile>("/users/me");
    return data;
  },

  async getUser(userId: number): Promise<UserProfile> {
    const { data } = await client.get<UserProfile>(`/users/${userId}`);
    return data;
  },

  async followUser(userId: number): Promise<void> {
    await client.post(`/users/${userId}/follow`);
  },

  async unfollowUser(userId: number): Promise<void> {
    await client.delete(`/users/${userId}/follow`);
  },

  /**
   * Feed is Redis Sorted Set-backed. `before_ts` asks for older ZSET scores and
   * lets the UI implement infinite scrolling without database offset scans.
   */
  async getHomeFeed(params: { limit?: number; beforeTs?: number } = {}): Promise<Post[]> {
    const { data } = await client.get<Post[]>("/feed/home", {
      params: {
        limit: params.limit ?? 20,
        before_ts: params.beforeTs,
      },
    });
    return data;
  },

  /**
   * Post creation writes to Postgres and enqueues Redis fan-out work. The UI
   * performs an optimistic insert because the user's own timeline updates
   * immediately, while follower timelines may update asynchronously.
   */
  async createPost(content: string): Promise<Post> {
    const { data } = await client.post<Post>("/posts", { content });
    return data;
  },

  async likePost(postId: number): Promise<void> {
    await client.post(`/posts/${postId}/like`);
  },

  async unlikePost(postId: number): Promise<void> {
    await client.delete(`/posts/${postId}/like`);
  },

  async createComment(postId: number, content: string): Promise<Comment> {
    const { data } = await client.post<Comment>(`/posts/${postId}/comments`, { content });
    return data;
  },

  async getComments(postId: number): Promise<Comment[]> {
    const { data } = await client.get<Comment[]>(`/posts/${postId}/comments`);
    return data;
  },

  /**
   * Trending comes from a Redis ZSET with time-decayed scores. The frontend
   * refreshes it frequently because the operation is cheap server-side.
   */
  async getTrending(limit = 10): Promise<TrendingPost[]> {
    const { data } = await client.get<TrendingPost[]>("/feed/trending", {
      params: { limit },
    });
    return data;
  },

  /**
   * Notification history comes from Redis Streams. The backend also persists a
   * long-term archive in Postgres through a background worker.
   */
  async getNotifications(limit = 50): Promise<NotificationsResponse> {
    const { data } = await client.get<NotificationsResponse>("/notifications", {
      params: { limit },
    });
    return data;
  },

  async markNotificationsRead(): Promise<void> {
    await client.post("/notifications/read-all");
  },

  async searchRecentActivity(query: string): Promise<unknown[]> {
    const { data } = await client.get<unknown[]>("/analytics/search", {
      params: { q: query },
    });
    return data;
  },
};

export function notificationSocketUrl(token: string): string {
  return `${wsBaseUrl()}/notifications/ws?token=${encodeURIComponent(token)}`;
}

export type LiveNotificationMessage =
  | { type: "history"; items: NotificationEvent[] }
  | { type: "event"; payload: NotificationEvent };
