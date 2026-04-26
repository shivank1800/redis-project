/**
 * NotificationList.
 *
 * BACKEND/REDIS RELATION:
 * Items arrive from Redis Streams (history/polling) and Redis Pub/Sub
 * (WebSocket live delivery). The UI shows connection mode so developers can
 * observe when it is truly live vs fallback polling.
 */

import { BellRing, Heart, MessageCircle, UserPlus } from "lucide-react";
import type { NotificationEvent } from "../types/api";
import { relativeTime } from "../utils/time";
import { EmptyState } from "./EmptyState";

function icon(kind: string) {
  if (kind === "like") return <Heart className="h-4 w-4 text-red-500" />;
  if (kind === "comment") return <MessageCircle className="h-4 w-4 text-sky-500" />;
  if (kind === "follow") return <UserPlus className="h-4 w-4 text-emerald-500" />;
  return <BellRing className="h-4 w-4 text-slate-500" />;
}

export function NotificationList({ items }: { items: NotificationEvent[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No notifications yet"
        body="Likes, follows, and comments will appear here in real time."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.stream_id ?? `${item.kind}-${item.ts}-${index}`}
          className="flex gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-950"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white dark:bg-slate-900">
            {icon(item.kind)}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {item.message || `${item.kind} event from user ${item.actor_id}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {relativeTime(new Date(item.ts * 1000).toISOString())} · {item.object_type} #
              {item.object_id}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
