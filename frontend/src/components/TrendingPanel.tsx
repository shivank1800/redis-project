/**
 * TrendingPanel.
 *
 * BACKEND/REDIS RELATION:
 * Trending posts are stored in a Redis Sorted Set scored by likes plus recency
 * decay. The frontend auto-refreshes because top-K ZSET reads are cheap and
 * users expect trending content to move quickly.
 */

import clsx from "clsx";
import { Flame, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTrending } from "../hooks/useTrending";
import { relativeTime } from "../utils/time";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

const RANK_STYLES = [
  "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_8px_20px_-8px_rgba(251,146,60,0.6)]",
  "bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-[0_8px_20px_-8px_rgba(148,163,184,0.6)]",
  "bg-gradient-to-br from-amber-700 to-amber-800 text-white shadow-[0_8px_20px_-8px_rgba(180,83,9,0.5)]",
];

function rankStyle(index: number) {
  return (
    RANK_STYLES[index] ??
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
  );
}

export function TrendingPanel() {
  const { items, isLoading, error } = useTrending();

  return (
    <Card className="sticky top-24">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-rose-500 via-red-500 to-violet-600 text-white shadow-[0_8px_20px_-8px_rgba(244,63,94,0.55)]">
              <Flame className="h-4 w-4" />
            </span>
            Trending
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Redis ZSET · auto-refreshing
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          live
        </span>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      )}

      {!isLoading && error && <p className="text-sm text-rose-600">{error}</p>}

      {!isLoading && !error && items.length === 0 && (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Nothing trending yet"
          body="Create and like posts to seed Redis."
        />
      )}

      <div className="space-y-2.5">
        {items.map((item, index) => (
          <Link
            key={item.post.id}
            to={`/profile/${item.post.author_id}`}
            className={clsx(
              "group block rounded-2xl border border-transparent p-3 transition-all duration-200",
              "hover:border-slate-200/70 hover:bg-slate-50/80 dark:hover:border-slate-800/70 dark:hover:bg-slate-900/60",
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={clsx(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-black tabular-nums",
                  rankStyle(index),
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800 group-hover:text-slate-900 dark:text-slate-100 dark:group-hover:text-white">
                  {item.post.content.slice(0, 140)}
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{item.post.author?.display_name || item.post.author?.username || `User #${item.post.author_id}`}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                    score {item.score.toFixed(2)}
                  </span>
                  <span>·</span>
                  <span>{relativeTime(item.post.created_at)}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
