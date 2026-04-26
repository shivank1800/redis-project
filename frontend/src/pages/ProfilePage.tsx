/**
 * ProfilePage.
 *
 * WHAT:
 * Displays user details and follow/unfollow control.
 *
 * BACKEND/REDIS RELATION:
 * Profile counters are hot Redis counters. Follow/unfollow updates Redis sets
 * and counters, then a Redis Stream job backfills the follower's feed. The UI
 * updates counters optimistically to match that low-latency behavior.
 *
 * NOTE:
 * The current backend does not expose `/users/{id}/posts`, so the "User posts"
 * area explains the missing contract instead of making fake requests.
 */

import { UserRound } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { useProfile } from "../hooks/useProfile";
import { useAuthStore } from "../store/authStore";
import { relativeTime } from "../utils/time";

export function ProfilePage() {
  const { id } = useParams();
  const currentUser = useAuthStore((state) => state.user);
  const userId = Number(id);
  const { profile, isLoading, isFollowing, error, toggleFollow } = useProfile(userId);
  const isSelf = currentUser?.id === userId;

  if (!Number.isFinite(userId)) {
    return <EmptyState title="Invalid profile" body="The profile id in the URL is not valid." />;
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (error || !profile) {
    return <EmptyState title="Profile unavailable" body={error ?? "User not found."} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="grid h-24 w-24 place-items-center rounded-3xl bg-slate-100 dark:bg-slate-800">
            <UserRound className="h-10 w-10" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-black tracking-tight">{profile.display_name}</h1>
            <p className="mt-1 font-semibold text-slate-500">@{profile.username}</p>
            <p className="mt-3 text-slate-700 dark:text-slate-200">
              {profile.bio || "No bio yet."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Joined {relativeTime(profile.created_at)}
            </p>
          </div>
          {!isSelf && (
            <Button onClick={() => void toggleFollow()}>
              {isFollowing ? "Unfollow" : "Follow"}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Followers" value={profile.follower_count} />
        <Stat label="Following" value={profile.following_count} />
        <Stat label="Posts" value={profile.post_count} />
      </div>

      <Card>
        <h2 className="text-xl font-black">User posts</h2>
        <p className="mt-2 text-sm text-slate-500">
          The frontend is ready for a user-posts list, but the current backend
          exposes profile details and feed data, not `/users/{id}/posts`. In a
          production API this would read `feed:user:{id}` from Redis and hydrate
          post details exactly like the home feed.
        </p>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-3xl font-black">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </Card>
  );
}
