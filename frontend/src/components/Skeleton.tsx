/**
 * Loading skeletons.
 *
 * WHY:
 * Redis-backed endpoints are fast, but production networks are not always fast.
 * Skeletons preserve layout while HTTP requests, auth checks, or WebSocket
 * fallback polling are in flight.
 */

import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800",
        className,
      )}
    />
  );
}

export function PostSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
