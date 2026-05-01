/**
 * Application shell.
 *
 * Shared navigation, responsive layout, dark mode, notification badge, and
 * outlet for route pages.
 *
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
    `relative flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
      isActive
        ? "bg-gradient-to-br from-rose-500 via-red-500 to-violet-600 text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,0.55)]"
        : "text-slate-600 hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/60"
    }`;

  return (
    <div className="min-h-screen">
      <RateLimitBanner />

      <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/75 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="group flex items-center gap-3">
            <div className="relative grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 via-red-500 to-violet-600 text-white shadow-[0_10px_30px_-10px_rgba(244,63,94,0.6)] transition-transform duration-200 group-hover:scale-105">
              <span className="font-black tracking-tight">R</span>
              <span className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-black tracking-tight">
                <span className="gradient-text">Redis</span>{" "}
                <span className="text-slate-900 dark:text-slate-50">Social</span>
              </p>
              <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                real-time feed · live
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 rounded-2xl border border-slate-200/60 bg-white/60 p-1 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/50">
            <NavLink className={navClass} to="/" end>
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
                  <span className="absolute -right-2 -top-2 grid min-w-[18px] place-items-center rounded-full bg-gradient-to-br from-rose-500 to-red-600 px-1 text-[10px] font-bold leading-4 text-white shadow-[0_0_0_2px_rgba(255,255,255,1)] dark:shadow-[0_0_0_2px_rgba(2,6,23,1)]">
                    {Math.min(notifications.unread, 99)}
                  </span>
                )}
              </span>
              <span className="hidden sm:inline">Alerts</span>
            </NavLink>
          </nav>

          <div className="flex items-center gap-2">
            <button
              className="rounded-2xl p-2 text-slate-600 transition hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/60"
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {user && (
              <Link
                to={`/profile/${user.id}`}
                className="hidden items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/60 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white dark:border-slate-800/60 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-slate-800 sm:flex"
              >
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-rose-500 to-violet-600 text-[11px] font-black uppercase text-white">
                  {user.username.slice(0, 1)}
                </span>
                {user.username}
              </Link>
            )}

            <button
              className="rounded-2xl p-2 text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
              onClick={() => void logout()}
              aria-label="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="animate-fade-in">
          <Outlet context={notifications} />
        </div>
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-6 pt-2 text-center text-xs text-slate-400 dark:text-slate-500 sm:px-6">
        Built on Redis · ZSETs · Streams · Pub/Sub
      </footer>
    </div>
  );
}
