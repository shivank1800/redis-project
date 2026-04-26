/**
 * ProtectedRoute.
 *
 * WHAT:
 * Blocks private pages when there is no local token/user.
 *
 * WHY:
 * Route protection is only a convenience. The backend still validates every
 * request against Redis-backed sessions, so hiding routes is not security by
 * itself; it simply improves user experience.
 */

import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";
import { Skeleton } from "./Skeleton";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);

  if (isBootstrapping) {
    return (
      <div className="mx-auto mt-24 max-w-md space-y-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
