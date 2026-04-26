/**
 * Rate-limit banner.
 *
 * BACKEND/REDIS RELATION:
 * The backend's FastAPI middleware uses Redis to enforce a distributed sliding
 * window. When that limiter returns 429, every page shows the same banner so
 * users understand the system is protecting throughput rather than failing.
 */

import { AlertTriangle, X } from "lucide-react";
import { useUiStore } from "../store/uiStore";

export function RateLimitBanner() {
  const message = useUiStore((state) => state.rateLimitMessage);
  const clear = useUiStore((state) => state.clearRateLimit);

  if (!message) return null;

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-soft dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1 text-sm font-medium">{message}</div>
        <button aria-label="Dismiss" onClick={clear}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
