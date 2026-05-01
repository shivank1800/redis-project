/**
 * useNotifications hook.
 *
 * WHAT:
 * Loads notification history, opens a WebSocket for live events, and falls back
 * to polling if the socket cannot stay connected.
 *
 * WHY:
 * Real-time systems are imperfect in browsers: tabs sleep, networks drop, and
 * corporate proxies sometimes block WebSockets. A polling fallback keeps the UI
 * correct even when live push is unavailable.
 *
 * BACKEND/REDIS RELATION:
 * The backend writes every notification to a Redis Stream and also publishes
 * live events with Redis Pub/Sub. WebSocket messages represent Pub/Sub events;
 * history/polling reads the Stream-backed REST endpoint.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api, notificationSocketUrl, type LiveNotificationMessage } from "../services/api";
import { useAuthStore } from "../store/authStore";
import type { NotificationEvent } from "../types/api";
import { useApiError } from "./useApiError";

export type NotificationsState = {
  items: NotificationEvent[];
  unread: number;
  connectionState: "connecting" | "live" | "polling";
  markAllRead: () => Promise<void>;
  reload: () => Promise<void>;
};

export function useNotifications(): NotificationsState {
  const token = useAuthStore((state) => state.token);
  const [items, setItems] = useState<NotificationEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [connectionState, setConnectionState] = useState<"connecting" | "live" | "polling">(
    "connecting",
  );
  const socketRef = useRef<WebSocket | null>(null);
  const handleError = useApiError();

  const loadHistory = useCallback(async () => {
    try {
      const response = await api.getNotifications();
      setItems(response.items);
      setUnread(response.unread);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const markAllRead = useCallback(async () => {
    setUnread(0);
    try {
      await api.markNotificationsRead();
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  useEffect(() => {
    if (!token) return undefined;

    let pollingTimer: number | undefined;
    let reconnectTimer: number | undefined;
    let didFallbackToPolling = false;
    let isDisposed = false;

    void loadHistory();

    const startPolling = () => {
      if (didFallbackToPolling) return;
      didFallbackToPolling = true;
      setConnectionState("polling");
      pollingTimer = window.setInterval(() => {
        void loadHistory();
      }, 8_000);
    };

    const connect = () => {
      if (isDisposed || didFallbackToPolling) return;
      setConnectionState("connecting");
      const socket = new WebSocket(notificationSocketUrl(token));
      socketRef.current = socket;

      socket.onopen = () => {
        if (isDisposed) return;
        setConnectionState("live");
      };

      socket.onmessage = (event) => {
        if (isDisposed) return;
        const message = JSON.parse(event.data) as LiveNotificationMessage;

        if (message.type === "history") {
          setItems(message.items);
          return;
        }

        setItems((prev) => [message.payload, ...prev]);
        setUnread((prev) => prev + 1);
      };

      socket.onerror = () => {
        if (isDisposed) return;
        startPolling();
      };

      socket.onclose = () => {
        if (isDisposed || didFallbackToPolling) return;
        // Give WebSocket one reconnect attempt before relying on polling.
        reconnectTimer = window.setTimeout(() => {
          if (!isDisposed && !didFallbackToPolling) {
            connect();
            startPolling();
          }
        }, 2_000);
      };
    };

    connect();

    return () => {
      isDisposed = true;
      window.clearInterval(pollingTimer);
      window.clearTimeout(reconnectTimer);
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [loadHistory, token]);

  return {
    items,
    unread,
    connectionState,
    markAllRead,
    reload: loadHistory,
  };
}
