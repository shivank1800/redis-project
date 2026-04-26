/**
 * Application shell.
 *
 * WHAT:
 * Shared navigation, responsive layout, dark mode, notification badge, and
 * outlet for route pages.
 *
 * WHY:
 * Real-time apps need persistent UI around pages: the WebSocket notification
 * badge should keep updating while the user moves between feed/profile/trending
 * views.
 */

import { Bell, Flame, Home, LogOut, Moon, Search, Sun, UserRound } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import type { NotificationsState } from "../hooks/useNotifications";
import { useAuthStore } from "../store/authStore";
import { useUiStore } from "../store/uiStore";
import { RateLimitBanner } from "./RateLimitBanner";

export function AppShell({ notifications }: { notifications: NotificationsState }) {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isDark = useUiStore((state) => state.isDark);
  const toggleDarkMode = useUiStore((state) => state.toggleDarkMode);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition ${
      isActive
        ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
        : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
    }`;

  return (
    <div className="min-h-screen">
      <RateLimitBanner />

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-red-500 text-white shadow-soft">
              R
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-black tracking-tight">Redis Social UI</p>
              <p className="text-xs text-slate-500">real-time feed demo</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            <NavLink className={navClass} to="/">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Feed</span>
            </NavLink>
            <NavLink className={navClass} to="/trending">
              <Flame className="h-4 w-4" />
              <span className="hidden sm:inline">Trending</span>
            </NavLink>
            <NavLink className={navClass} to="/search">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </NavLink>
            <NavLink className={navClass} to="/notifications">
              <span className="relative">
                <Bell className="h-4 w-4" />
                {notifications.unread > 0 && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 text-[10px] leading-4 text-white">
                    {Math.min(notifications.unread, 99)}
                  </span>
                )}
              </span>
              <span className="hidden sm:inline">Alerts</span>
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <button
              className="rounded-2xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {user && (
              <Link
                to={`/profile/${user.id}`}
                className="hidden items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-900 sm:flex"
              >
                <UserRound className="h-4 w-4" />
                {user.username}
              </Link>
            )}

            <button
              className="rounded-2xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900"
              onClick={() => void logout()}
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet context={notifications} />
      </main>
    </div>
  );
}
