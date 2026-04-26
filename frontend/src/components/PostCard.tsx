/**
 * PostCard.
 *
 * WHAT:
 * Displays a feed post with author id, timestamp, likes, comments, and inline
 * comment submission.
 *
 * BACKEND/REDIS RELATION:
 * Likes increment Redis counters first, then the backend folds long-term state
 * into Postgres later. The frontend can optimistically increase counts because
 * Redis `INCR` makes the backend write very fast and idempotent-ish for users.
 */

import { Heart, MessageCircle, UserRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Post } from "../types/api";
import { relativeTime } from "../utils/time";
import { Button } from "./Button";
import { Card } from "./Card";

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

  async function submitComment() {
    const trimmed = comment.trim();
    if (!trimmed) return;
    setComment("");
    setShowCommentBox(false);
    await onComment(post.id, trimmed);
  }

  return (
    <Card>
      <div className="flex gap-3">
        <Link
          to={`/profile/${post.author_id}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <UserRound className="h-5 w-5" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/profile/${post.author_id}`}
              className="font-bold text-slate-900 hover:underline dark:text-slate-50"
            >
              User #{post.author_id}
            </Link>
            <span className="text-xs text-slate-500">· {relativeTime(post.created_at)}</span>
            {post.id < 0 && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-200">
                syncing
              </span>
            )}
          </div>

          <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-800 dark:text-slate-100">
            {post.content}
          </p>

          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="ghost"
              className="px-3"
              disabled={post.id < 0}
              onClick={() => void onLike(post.id)}
            >
              <Heart className="mr-2 h-4 w-4" />
              {post.like_count}
            </Button>
            <Button
              variant="ghost"
              className="px-3"
              disabled={post.id < 0}
              onClick={() => setShowCommentBox((value) => !value)}
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              {post.comment_count}
            </Button>
          </div>

          {showCommentBox && (
            <div className="mt-4 flex gap-2">
              <input
                className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950"
                placeholder="Write a comment..."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void submitComment();
                }}
              />
              <Button disabled={!comment.trim()} onClick={() => void submitComment()}>
                Reply
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
