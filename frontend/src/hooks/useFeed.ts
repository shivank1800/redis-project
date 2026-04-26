/**
 * useFeed hook.
 *
 * WHAT:
 * Owns feed fetching, pagination, optimistic create-post, and optimistic likes.
 *
 * WHY:
 * Feed state has several behaviors that should not be scattered across
 * components: loading states, error handling, infinite scroll cursor, and
 * rollback when optimistic UI fails.
 *
 * BACKEND/REDIS RELATION:
 * `/feed/home` reads from Redis Sorted Sets (`feed:home:{user_id}`), so it can
 * return the latest timeline with very low latency. We paginate by timestamp
 * score (`before_ts`) rather than database offsets. Optimistic create-post
 * mirrors backend behavior: the author's own Redis timeline updates
 * immediately, while fan-out to followers happens asynchronously through Redis
 * Streams workers.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type { Post } from "../types/api";
import { epochSecondsFromIso } from "../utils/time";
import { useApiError } from "./useApiError";

const PAGE_SIZE = 20;

export function useFeed() {
  const currentUser = useAuthStore((state) => state.user);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handleError = useApiError();

  const oldestCursor = useMemo(() => {
    const oldest = posts[posts.length - 1];
    return oldest ? epochSecondsFromIso(oldest.created_at) - 1 : undefined;
  }, [posts]);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await api.getHomeFeed({ limit: PAGE_SIZE });
      setPosts(next);
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(handleError(err));
    } finally {
      setIsLoading(false);
    }
  }, [handleError]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore || !oldestCursor) return;

    setIsLoadingMore(true);
    try {
      const next = await api.getHomeFeed({ limit: PAGE_SIZE, beforeTs: oldestCursor });
      setPosts((prev) => {
        const seen = new Set(prev.map((post) => post.id));
        return [...prev, ...next.filter((post) => !seen.has(post.id))];
      });
      setHasMore(next.length === PAGE_SIZE);
    } catch (err) {
      setError(handleError(err));
    } finally {
      setIsLoadingMore(false);
    }
  }, [handleError, hasMore, isLoadingMore, oldestCursor]);

  const createPost = useCallback(
    async (content: string) => {
      if (!currentUser) return;

      const optimisticPost: Post = {
        id: -Date.now(),
        author_id: currentUser.id,
        content,
        created_at: new Date().toISOString(),
        like_count: 0,
        comment_count: 0,
      };

      setPosts((prev) => [optimisticPost, ...prev]);

      try {
        const saved = await api.createPost(content);
        setPosts((prev) => prev.map((post) => (post.id === optimisticPost.id ? saved : post)));
      } catch (err) {
        setPosts((prev) => prev.filter((post) => post.id !== optimisticPost.id));
        setError(handleError(err));
      }
    },
    [currentUser, handleError],
  );

  const likePost = useCallback(
    async (postId: number) => {
      const previous = posts;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, like_count: post.like_count + 1 } : post,
        ),
      );

      try {
        await api.likePost(postId);
      } catch (err) {
        setPosts(previous);
        setError(handleError(err));
      }
    },
    [handleError, posts],
  );

  const addComment = useCallback(
    async (postId: number, content: string) => {
      const previous = posts;
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, comment_count: post.comment_count + 1 } : post,
        ),
      );

      try {
        await api.createComment(postId, content);
      } catch (err) {
        setPosts(previous);
        setError(handleError(err));
      }
    },
    [handleError, posts],
  );

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  return {
    posts,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh: loadInitial,
    loadMore,
    createPost,
    likePost,
    addComment,
  };
}
