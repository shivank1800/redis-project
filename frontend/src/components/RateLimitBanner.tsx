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
    <div className="fixed left-1/2 top-4 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 animate-fade-in rounded-2xl border border-amber-200/80 bg-amber-50/95 px-4 py-3 text-amber-900 shadow-[0_20px_60px_-20px_rgba(217,119,6,0.45)] backdrop-blur dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div className="flex-1 text-sm font-medium">{message}</div>
        <button
          aria-label="Dismiss"
          onClick={clear}
          className="rounded-lg p-1 transition hover:bg-amber-500/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
