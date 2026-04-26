/**
 * SignupPage.
 *
 * WHAT:
 * Creates a user and then logs in.
 *
 * WHY:
 * The backend register endpoint creates the durable user row; login creates the
 * Redis session. Keeping them separate matches the backend contract and makes
 * session behavior explicit for learners.
 */

import { FormEvent, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "../components/Button";
import { useApiError } from "../hooks/useApiError";
import { useAuthStore } from "../store/authStore";
import { AuthLayout } from "./LoginPage";

export function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signup = useAuthStore((state) => state.signup);
  const isAuthenticated = Boolean(useAuthStore((state) => state.token));
  const handleError = useApiError();

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signup({ username, email, password, display_name: displayName });
    } catch (err) {
      setError(handleError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create account" subtitle="Try the Redis-backed feed end to end.">
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <Field label="Username" value={username} onChange={setUsername} />
        <Field label="Email" type="email" value={email} onChange={setEmail} />
        <Field label="Display name" value={displayName} onChange={setDisplayName} />
        <Field label="Password" type="password" value={password} onChange={setPassword} />
        {error && <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <Button className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create account"}
        </Button>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link className="font-bold text-slate-900 underline dark:text-white" to="/login">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function Field({
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
