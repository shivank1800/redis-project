/**
 * TrendingPage.
 *
 * WHAT:
 * Full page view of trending content.
 *
 * BACKEND/REDIS RELATION:
 * Redis maintains the trending ZSET, so this page can refresh often. The score
 * shown here is the backend's decayed score, useful for learning how likes and
 * recency combine.
 */

import { Flame } from "lucide-react";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { useTrending } from "../hooks/useTrending";
import { relativeTime } from "../utils/time";

export function TrendingPage() {
  const { items, isLoading, error } = useTrending(5_000);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 via-red-500 to-violet-600 text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,0.55)]">
              <Flame className="h-5 w-5" />
            </span>
            <span>
              <span className="gradient-text">Trending</span> posts
            </span>
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Refreshed every 5s from Redis Sorted Set rankings.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}

      {error && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      )}

      {!isLoading && !error && items.length === 0 && (
        <EmptyState title="No trending data" body="Like a few posts to move the Redis score." />
      )}

      <div className="space-y-4">
        {items.map((item, index) => {
          const rankStyles = [
            "from-amber-400 to-orange-500",
            "from-slate-300 to-slate-400",
            "from-amber-700 to-amber-800",
          ];
          const rankStyle =
            rankStyles[index] ?? "from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800";
          return (
            <Card key={item.post.id} hover className="animate-fade-in">
              <div className="flex gap-4">
                <div
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${rankStyle} text-lg font-black text-white shadow-[0_10px_30px_-15px_rgba(15,23,42,0.4)]`}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-bold leading-6 text-slate-900 dark:text-slate-50">
                    {item.post.content}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      User #{item.post.author_id}
                    </span>
                    <span>·</span>
                    <span>{relativeTime(item.post.created_at)}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                      {item.post.like_count} likes
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-200">
                      score {item.score.toFixed(3)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
