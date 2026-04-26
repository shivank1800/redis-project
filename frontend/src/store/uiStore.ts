/**
 * UI store.
 *
 * WHAT IS GLOBAL:
 * - Dark mode preference
 * - Last rate-limit message
 *
 * WHY GLOBAL:
 * These concerns are cross-cutting and not owned by a single page. Feed,
 * notifications, and profile requests can all receive 429 from the backend's
 * Redis rate limiter, so the app shows one consistent banner.
 */

import { create } from "zustand";

type UiState = {
  isDark: boolean;
  rateLimitMessage: string | null;
  toggleDarkMode: () => void;
  showRateLimit: (message: string) => void;
  clearRateLimit: () => void;
};

const initialDark =
  localStorage.getItem("redis_social_feed_theme") === "dark" ||
  (!localStorage.getItem("redis_social_feed_theme") &&
    window.matchMedia("(prefers-color-scheme: dark)").matches);

if (initialDark) {
  document.documentElement.classList.add("dark");
}

export const useUiStore = create<UiState>((set, get) => ({
  isDark: initialDark,
  rateLimitMessage: null,

  toggleDarkMode() {
    const next = !get().isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("redis_social_feed_theme", next ? "dark" : "light");
    set({ isDark: next });
  },

  showRateLimit(message) {
    set({ rateLimitMessage: message });
    window.setTimeout(() => {
      if (get().rateLimitMessage === message) {
        set({ rateLimitMessage: null });
      }
    }, 5_000);
  },

  clearRateLimit() {
    set({ rateLimitMessage: null });
  },
}));
