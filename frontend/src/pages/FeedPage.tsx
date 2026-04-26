/**
 * FeedPage.
 *
 * WHAT:
 * Main social feed with create-post, infinite scroll, optimistic likes, and
 * comments.
 *
 * BACKEND/REDIS RELATION:
 * The feed endpoint is powered by Redis Sorted Sets and hybrid fan-out. The UI
 * fetches pages using a timestamp cursor instead of offset pagination because
 * Redis ZSET scores naturally model "newer/older than this post".
 */

import { RefreshCw } from "lucide-react";
import { CreatePostBox } from "../components/CreatePostBox";
import { EmptyState } from "../components/EmptyState";
import { PostCard } from "../components/PostCard";
import { PostSkeleton } from "../components/Skeleton";
import { TrendingPanel } from "../components/TrendingPanel";
import { useFeed } from "../hooks/useFeed";
import { Button } from "../components/Button";

export function FeedPage() {
  const {
    posts,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    createPost,
    likePost,
    addComment,
  } = useFeed();

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Home feed</h1>
            <p className="mt-1 text-sm text-slate-500">
              Redis Sorted Set timeline with optimistic UI.
            </p>
          </div>
          <Button variant="ghost" onClick={() => void refresh()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        <CreatePostBox onCreate={createPost} />

        {error && <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}

        {isLoading && (
          <div className="space-y-4">
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </div>
        )}

        {!isLoading && posts.length === 0 && (
          <EmptyState
            title="Your feed is empty"
            body="Create a post or follow users to populate Redis-backed timelines."
          />
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={likePost} onComment={addComment} />
          ))}
        </div>

        {!isLoading && posts.length > 0 && (
          <div className="flex justify-center">
            <Button variant="ghost" disabled={!hasMore || isLoadingMore} onClick={() => void loadMore()}>
              {isLoadingMore ? "Loading..." : hasMore ? "Load older posts" : "No more posts"}
            </Button>
          </div>
        )}
      </section>

      <aside className="space-y-5">
        <TrendingPanel />
      </aside>
    </div>
  );
}
