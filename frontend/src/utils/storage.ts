/**
 * Browser storage helpers.
 *
 * WHAT:
 * Store the session token and user in localStorage so the page can refresh
 * without logging the user out.
 *
 * WHY:
 * The backend keeps the authoritative session in Redis. The browser only keeps
 * the opaque token that points to `session:{token}` on Redis.
 *
 * HOW IT CONNECTS TO REDIS:
 * On every API call we send `Authorization: Bearer <token>`. The backend checks
 * Redis for that session hash; if Redis says the token was revoked or expired,
 * the frontend receives 401 and clears local state.
 */

import type { UserPublic } from "../types/api";

const TOKEN_KEY = "redis_social_feed_token";
const USER_KEY = "redis_social_feed_user";

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser(): UserPublic | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as UserPublic;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setStoredUser(user: UserPublic): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_KEY);
}

export function clearAuthStorage(): void {
  clearStoredToken();
  clearStoredUser();
}
