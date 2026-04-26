/**
 * useAuth hook.
 *
 * WHAT:
 * Small wrapper over the Zustand auth store.
 *
 * WHY:
 * Components should not need to know how auth is stored. This hook exposes the
 * user/session operations in a clean way and gives us a single place to expand
 * behavior later (refresh tokens, analytics, feature flags).
 *
 * BACKEND/REDIS RELATION:
 * Login creates a Redis-backed session. `refreshMe` validates the stored token
 * by calling `/users/me`; if Redis no longer contains that session, the backend
 * returns 401 and the store is cleared.
 */

import { useEffect } from "react";
import { useAuthStore } from "../store/authStore";

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    void store.refreshMe();
    // refreshMe is stable enough for this learning project; calling once on
    // mount avoids excessive session checks against Redis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...store,
    isAuthenticated: Boolean(store.token && store.user),
  };
}
