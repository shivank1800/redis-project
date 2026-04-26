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
import { Button } from "../components/Button";
import { Card } from "../components/Card";
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
        <TextField label="Username" value={username} onChange={setUsername} />
        <TextField label="Password" type="password" value={password} onChange={setPassword} />
        {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <Button className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
        <p className="text-center text-sm text-slate-500">
          New here?{" "}
          <Link className="font-bold text-slate-900 underline dark:text-white" to="/signup">
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
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-red-500 text-2xl font-black text-white">
            R
          </div>
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
