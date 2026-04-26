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
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight">
          <Flame className="h-8 w-8 text-red-500" />
          Trending posts
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Refreshed every 5s from Redis Sorted Set rankings.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      )}

      {error && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}

      {!isLoading && !error && items.length === 0 && (
        <EmptyState title="No trending data" body="Like a few posts to move the Redis score." />
      )}

      <div className="space-y-4">
        {items.map((item, index) => (
          <Card key={item.post.id}>
            <div className="flex gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-100 text-lg font-black text-red-600 dark:bg-red-950 dark:text-red-200">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-bold">{item.post.content}</p>
                <p className="mt-2 text-sm text-slate-500">
                  User #{item.post.author_id} · {relativeTime(item.post.created_at)} ·{" "}
                  {item.post.like_count} likes · score {item.score.toFixed(3)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
