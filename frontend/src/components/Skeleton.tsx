/**
 * Loading skeletons.
 *
 * Redis-backed endpoints are fast, but production networks are not always fast.
 * Skeletons preserve layout while HTTP requests, auth checks, or WebSocket
 * fallback polling are in flight. Uses a shimmer gradient defined in
 * `index.css` for a more premium feel than a plain pulse.
 */

import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("shimmer rounded-xl", className)} />;
}

export function PostSkeleton() {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-5 shadow-soft backdrop-blur dark:border-slate-800/70 dark:bg-slate-900/60 sm:p-6">
      <div className="flex gap-4">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
