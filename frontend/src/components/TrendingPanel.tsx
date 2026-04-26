/**
 * TrendingPanel.
 *
 * BACKEND/REDIS RELATION:
 * Trending posts are stored in a Redis Sorted Set scored by likes plus recency
 * decay. The frontend auto-refreshes because top-K ZSET reads are cheap and
 * users expect trending content to move quickly.
 */

import { Flame } from "lucide-react";
import { Link } from "react-router-dom";
import { useTrending } from "../hooks/useTrending";
import { relativeTime } from "../utils/time";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

export function TrendingPanel() {
  const { items, isLoading, error } = useTrending();

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 font-black">
            <Flame className="h-5 w-5 text-red-500" />
            Trending
          </h2>
          <p className="text-xs text-slate-500">Redis ZSET, auto-refreshing</p>
        </div>
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
        <EmptyState title="Nothing trending yet" body="Create and like posts to seed Redis." />
      )}

      <div className="space-y-3">
        {items.map((item, index) => (
          <Link
            key={item.post.id}
            to={`/profile/${item.post.author_id}`}
            className="block rounded-2xl bg-slate-50 p-3 transition hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-red-100 text-sm font-black text-red-600 dark:bg-red-950 dark:text-red-200">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.post.content.slice(0, 120)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  score {item.score.toFixed(2)} · {relativeTime(item.post.created_at)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
