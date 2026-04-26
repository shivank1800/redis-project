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
            <h1 className="text-3xl font-black tracking-tight">Notifications</h1>
            <p className="mt-1 text-sm text-slate-500">
              {isLive ? "Live via WebSocket + Redis Pub/Sub" : "Polling Redis Stream history"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold dark:bg-slate-950">
              {isLive ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-amber-500" />}
              {connectionState}
            </span>
            {unread > 0 && <Button onClick={() => void markAllRead()}>Mark read ({unread})</Button>}
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
