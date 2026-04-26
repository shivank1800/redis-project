/**
 * useTrending hook.
 *
 * WHAT:
 * Fetches trending posts on mount and refreshes every few seconds.
 *
 * WHY:
 * Trending scores change as likes arrive and as recency decay takes effect.
 * Because the backend uses a Redis Sorted Set, top-K reads are cheap enough to
 * refresh frequently without a heavyweight client cache.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import type { TrendingPost } from "../types/api";
import { useApiError } from "./useApiError";

export function useTrending(refreshMs = 7_000) {
  const [items, setItems] = useState<TrendingPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleError = useApiError();

  const refresh = useCallback(async () => {
    try {
      const next = await api.getTrending(8);
      setItems(next);
      setError(null);
    } catch (err) {
      setError(handleError(err));
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), refreshMs);
    return () => window.clearInterval(timer);
  }, [refresh, refreshMs]);

  return { items, isLoading, error, refresh };
}
