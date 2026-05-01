/**
 * NotificationsPage.
 *
 * WHAT:
 * Shows real-time notification history and live connection status.
 *
 * BACKEND/REDIS RELATION:
 * Redis Streams provide notification history, while Redis Pub/Sub pushes live
 * events through WebSocket. If WebSocket fails, the hook polls the Stream-backed
 * REST endpoint so the UI still converges.
 */

import { Wifi, WifiOff } from "lucide-react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { NotificationList } from "../components/NotificationList";
import { useOutletContext } from "react-router-dom";
import type { NotificationsState } from "../hooks/useNotifications";

export function NotificationsPage() {
  const { items, unread, connectionState, markAllRead, reload } =
    useOutletContext<NotificationsState>();
  const isLive = connectionState === "live";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              <span className="gradient-text">Notifications</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {isLive
                ? "Live via WebSocket + Redis Pub/Sub"
                : "Polling Redis Stream history"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                isLive
                  ? "border-emerald-200/70 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-amber-200/70 bg-amber-50/80 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
              }`}
            >
              {isLive ? (
                <Wifi className="h-4 w-4" />
              ) : (
                <WifiOff className="h-4 w-4" />
              )}
              <span className="uppercase tracking-wider">{connectionState}</span>
            </span>
            {unread > 0 && (
              <Button onClick={() => void markAllRead()}>
                Mark read ({unread})
              </Button>
            )}
            <Button variant="ghost" onClick={() => void reload()}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>

      <NotificationList items={items} />
    </div>
  );
}
