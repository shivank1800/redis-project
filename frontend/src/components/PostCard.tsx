/**
 * PostCard.
 *
 * Displays a feed post with author id, timestamp, likes, comments, and inline
 * comment submission.
 *
 * BACKEND/REDIS RELATION:
 * Likes increment Redis counters first, then the backend folds long-term state
 * into Postgres later. The frontend can optimistically increase counts because
 * Redis `INCR` makes the backend write very fast and idempotent-ish for users.
 */

import clsx from "clsx";
import { Heart, MessageCircle, SendHorizontal, Share2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Post } from "../types/api";
import { relativeTime } from "../utils/time";
import { Button } from "./Button";
import { Card } from "./Card";

// Stable palette so the same author always gets the same gradient swatch.
const AVATAR_GRADIENTS = [
  "from-rose-500 to-violet-600",
  "from-amber-500 to-rose-600",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-purple-600",
  "from-orange-500 to-red-600",
];

function gradientFor(id: number) {
  return AVATAR_GRADIENTS[Math.abs(id) % AVATAR_GRADIENTS.length];
}

export function PostCard({
  post,
  onLike,
  onComment,
}: {
  post: Post;
  onLike: (postId: number) => Promise<void>;
  onComment: (postId: number, content: string) => Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [showCommentBox, setShowCommentBox] = useState(false);
  // Purely UI state: we don't know from the server whether the *current* user
  // liked this post, so we animate on click and let the server be source of
  // truth for the count.
  const [liked, setLiked] = useState(false);
  const [likeBurst, setLikeBurst] = useState(0);

  async function submitComment() {
    const trimmed = comment.trim();
    if (!trimmed) return;
    setComment("");
    setShowCommentBox(false);
    await onComment(post.id, trimmed);
  }

  async function handleLike() {
    setLiked((prev) => !prev);
    setLikeBurst((n) => n + 1);
    await onLike(post.id);
  }

  const isSyncing = post.id < 0;
  const avatarGradient = gradientFor(post.author_id);
  const authorName = post.author?.display_name || post.author?.username || `User #${post.author_id}`;
  const authorHandle = post.author?.username ? `@${post.author.username}` : null;
  const avatarText = (post.author?.display_name || post.author?.username || String(post.author_id))
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card hover className="animate-fade-in">
      <div className="flex gap-4">
        <Link
          to={`/profile/${post.author_id}`}
          className={clsx(
            "grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-[0_8px_24px_-8px_rgba(15,23,42,0.35)] transition-transform duration-200 hover:scale-105",
            avatarGradient,
          )}
          aria-label={`Open profile of ${authorName}`}
        >
          <span className="text-base font-black tracking-tight">
            {avatarText}
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/profile/${post.author_id}`}
              className="font-bold text-slate-900 hover:underline dark:text-slate-50"
            >
              {authorName}
            </Link>
            {authorHandle && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {authorHandle}
              </span>
            )}
            <span className="text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {relativeTime(post.created_at)}
            </span>
            {isSyncing && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100/80 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                syncing
              </span>
            )}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-slate-800 dark:text-slate-100">
            {post.content}
          </p>

          <div className="mt-4 flex items-center gap-1">
            <button
              disabled={isSyncing}
              onClick={() => void handleLike()}
              className={clsx(
                "group/like inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200",
                "disabled:cursor-not-allowed disabled:opacity-60",
                liked
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                  : "text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/60",
              )}
            >
              <Heart
                key={likeBurst}
                className={clsx(
                  "h-4 w-4 transition-transform",
                  liked
                    ? "animate-pop fill-rose-500 text-rose-500"
                    : "group-hover/like:scale-110",
                )}
              />
              <span className="tabular-nums">{post.like_count}</span>
            </button>

            <button
              disabled={isSyncing}
              onClick={() => setShowCommentBox((value) => !value)}
              className={clsx(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                "disabled:cursor-not-allowed disabled:opacity-60",
                showCommentBox
                  ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
                  : "text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/60",
              )}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="tabular-nums">{post.comment_count}</span>
            </button>

            <button
              disabled={isSyncing}
              className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100/80 disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400 dark:hover:bg-slate-800/60"
              onClick={() =>
                navigator.clipboard?.writeText(`${window.location.origin}/#post-${post.id}`)
              }
              aria-label="Copy link to post"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {showCommentBox && (
            <div className="mt-4 flex items-center gap-2 animate-fade-in">
              <input
                className="flex-1 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/30 dark:border-slate-800/70 dark:bg-slate-950/60 dark:focus:border-rose-500"
                placeholder="Write a comment…"
                autoFocus
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitComment();
                  if (event.key === "Escape") setShowCommentBox(false);
                }}
              />
              <Button disabled={!comment.trim()} onClick={() => void submitComment()}>
                <SendHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Reply</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
