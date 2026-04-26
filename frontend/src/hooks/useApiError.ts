/**
 * API error helper.
 *
 * WHAT:
 * Converts typed API errors into user-facing messages.
 *
 * WHY:
 * Network failures, 401s, 429s, and 5xx failures require different UX. Redis
 * rate limiting is especially common in this project, so 429 gets a friendly
 * global banner rather than a confusing raw server error.
 */

import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useUiStore } from "../store/uiStore";
import { ApiError } from "../types/api";

export function useApiError() {
  const navigate = useNavigate();
  const showRateLimit = useUiStore((state) => state.showRateLimit);

  return (error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.kind === "rate_limited") {
        showRateLimit(error.message);
        return error.message;
      }

      if (error.kind === "unauthorized") {
        useAuthStore.getState().clearSession();
        navigate("/login");
        return error.message;
      }

      return error.message;
    }

    return "Something went wrong. Please try again.";
  };
}
