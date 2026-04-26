/**
 * useProfile hook.
 *
 * WHAT:
 * Loads a user profile and handles follow/unfollow with optimistic counter
 * updates.
 *
 * WHY:
 * The backend stores hot follower counters in Redis. Optimistically changing
 * the counter makes the UI feel as fast as the Redis write path, while a failed
 * API call rolls the UI back.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import type { UserProfile } from "../types/api";
import { useApiError } from "./useApiError";

export function useProfile(userId: number) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleError = useApiError();

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await api.getUser(userId);
      setProfile(next);
      setError(null);
    } catch (err) {
      setError(handleError(err));
    } finally {
      setIsLoading(false);
    }
  }, [handleError, userId]);

  const toggleFollow = useCallback(async () => {
    if (!profile) return;

    const previous = profile;
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setProfile({
      ...profile,
      follower_count: profile.follower_count + (nextFollowing ? 1 : -1),
    });

    try {
      if (nextFollowing) {
        await api.followUser(profile.id);
      } else {
        await api.unfollowUser(profile.id);
      }
    } catch (err) {
      setProfile(previous);
      setIsFollowing(!nextFollowing);
      setError(handleError(err));
    }
  }, [handleError, isFollowing, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  return { profile, isLoading, isFollowing, error, reload: load, toggleFollow };
}
