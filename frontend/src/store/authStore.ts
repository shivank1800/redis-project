/**
 * Authentication store.
 *
 * WHAT IS GLOBAL:
 * - Current user
 * - Session token
 * - Login/signup/logout actions
 *
 * WHY GLOBAL:
 * Auth affects the whole app: route protection, API token injection, navbar,
 * WebSocket connection, and graceful 401 handling.
 *
 * HOW IT CONNECTS TO REDIS:
 * The browser stores only an opaque token. The backend validates that token by
 * reading a Redis session hash. Clearing this store is enough to disconnect the
 * UI when Redis says a session expired or was revoked.
 */

import { create } from "zustand";
import { api } from "../services/api";
import type { LoginPayload, SignupPayload, UserPublic } from "../types/api";
import {
  clearAuthStorage,
  getStoredToken,
  getStoredUser,
  setStoredToken,
  setStoredUser,
} from "../utils/storage";

type AuthState = {
  token: string | null;
  user: UserPublic | null;
  isBootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getStoredToken(),
  user: getStoredUser(),
  isBootstrapping: true,

  async login(payload) {
    const response = await api.login(payload);
    setStoredToken(response.access_token);
    setStoredUser(response.user);
    set({ token: response.access_token, user: response.user });
  },

  async signup(payload) {
    await api.signup(payload);
    await get().login({ username: payload.username, password: payload.password });
  },

  async logout() {
    try {
      await api.logout();
    } finally {
      get().clearSession();
    }
  },

  async refreshMe() {
    if (!get().token) {
      set({ isBootstrapping: false });
      return;
    }

    try {
      const profile = await api.me();
      const user: UserPublic = {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        bio: profile.bio,
        created_at: profile.created_at,
      };
      setStoredUser(user);
      set({ user, isBootstrapping: false });
    } catch {
      get().clearSession();
      set({ isBootstrapping: false });
    }
  },

  clearSession() {
    clearAuthStorage();
    set({ token: null, user: null });
  },
}));
