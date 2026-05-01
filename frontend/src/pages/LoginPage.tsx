/**
 * LoginPage.
 *
 * BACKEND/REDIS RELATION:
 * `/auth/login` creates a server-side Redis session. The returned token is
 * stored locally and sent on later requests. If Redis expires or revokes that
 * session, API calls return 401 and the frontend redirects back here.
 */

import { FormEvent, useState } from "react";
import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { Activity, Flame, Zap } from "lucide-react";
import { Button } from "../components/Button";
import { useApiError } from "../hooks/useApiError";
import { useAuthStore } from "../store/authStore";

export function LoginPage() {
  const [username, setUsername] = useState("alice");
  const [password, setPassword] = useState("supersecret");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const login = useAuthStore((state) => state.login);
  const isAuthenticated = Boolean(useAuthStore((state) => state.token));
  const handleError = useApiError();

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ username, password });
    } catch (err) {
      setError(handleError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your Redis-backed social feed.">
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <TextField label="Username" value={username} onChange={setUsername} autoFocus />
        <TextField label="Password" type="password" value={password} onChange={setPassword} />
        {error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
            {error}
          </p>
        )}
        <Button className="w-full" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          New here?{" "}
          <Link
            className="font-bold text-slate-900 underline-offset-2 hover:underline dark:text-white"
            to="/signup"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <BackgroundOrbs />

      <div className="relative z-10 grid min-h-screen gap-0 lg:grid-cols-[1.1fr_1fr]">
        {/* Hero / marketing side */}
        <aside className="hidden flex-col justify-between p-10 lg:flex xl:p-16">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-rose-500 via-red-500 to-violet-600 text-white shadow-[0_14px_40px_-10px_rgba(244,63,94,0.7)]">
              <span className="text-lg font-black">R</span>
            </div>
            <div>
              <p className="text-sm font-black tracking-tight">
                <span className="gradient-text">Redis</span>{" "}
                <span className="text-slate-900 dark:text-slate-50">Social</span>
              </p>
              <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
                real-time feed · live
              </p>
            </div>
          </div>

          <div className="max-w-xl">
            <h2 className="text-4xl font-black leading-[1.05] tracking-tight text-slate-900 dark:text-white xl:text-5xl">
              A social feed where{" "}
              <span className="gradient-text">Redis is the database</span>, not
              the cache.
            </h2>
            <p className="mt-5 text-base text-slate-600 dark:text-slate-300">
              Sorted-Set timelines, Stream-backed fan-out, Pub/Sub live
              notifications, HyperLogLog analytics — all on the hot path.
              Postgres only holds the archive.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Chip icon={<Zap className="h-4 w-4" />} label="ZSET timeline" />
              <Chip icon={<Flame className="h-4 w-4" />} label="Decayed trending" />
              <Chip icon={<Activity className="h-4 w-4" />} label="Pub/Sub WS" />
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Built for learning production Redis patterns.
          </p>
        </aside>

        {/* Auth form side */}
        <div className="grid place-items-center px-4 py-10 sm:px-6 lg:py-16">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-8 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/70">
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-rose-500 via-red-500 to-violet-600 text-2xl font-black text-white shadow-[0_14px_40px_-10px_rgba(244,63,94,0.7)]">
                  R
                </div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                  {title}
                </h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  {subtitle}
                </p>
              </div>
              {children}
            </div>

            <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
              ZSET · STREAM · PUB/SUB · HLL
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/60 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/60 dark:text-slate-200">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-rose-500/90 to-violet-600/90 text-white">
        {icon}
      </span>
      {label}
    </div>
  );
}

function BackgroundOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 -left-16 h-80 w-80 rounded-full bg-rose-500/25 blur-3xl animate-float" />
      <div
        className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-violet-500/25 blur-3xl animate-float"
        style={{ animationDelay: "1.5s" }}
      />
      <div
        className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl animate-float"
        style={{ animationDelay: "3s" }}
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <input
        className="mt-2 w-full rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-[15px] outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/25 dark:border-slate-800/70 dark:bg-slate-950/60 dark:focus:border-rose-500"
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
