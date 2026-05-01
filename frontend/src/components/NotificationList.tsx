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

function iconFor(kind: string) {
  if (kind === "like")
    return {
      icon: <Heart className="h-4 w-4" />,
      tint: "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300",
    };
  if (kind === "comment")
    return {
      icon: <MessageCircle className="h-4 w-4" />,
      tint: "bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300",
    };
  if (kind === "follow")
    return {
      icon: <UserPlus className="h-4 w-4" />,
      tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
    };
  return {
    icon: <BellRing className="h-4 w-4" />,
    tint: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
}

export function NotificationList({ items }: { items: NotificationEvent[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<BellRing className="h-5 w-5" />}
        title="No notifications yet"
        body="Likes, follows, and comments will appear here in real time."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const { icon, tint } = iconFor(item.kind);
        return (
          <div
            key={item.stream_id ?? `${item.kind}-${item.ts}-${index}`}
            className="group flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4 backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft dark:border-slate-800/70 dark:bg-slate-900/60"
          >
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tint}`}
            >
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {item.message || `${item.kind} event from user ${item.actor_id}`}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {relativeTime(new Date(item.ts * 1000).toISOString())} · {item.object_type} #
                {item.object_id}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
