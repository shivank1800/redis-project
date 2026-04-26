/**
 * App routes.
 *
 * WHAT:
 * Defines public auth routes and protected product routes.
 *
 * WHY:
 * Route-level composition keeps the application easy to scan. The
 * Notifications hook is mounted once inside the protected layout so its
 * WebSocket can keep running across page transitions.
 */

import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./hooks/useAuth";
import { useNotifications } from "./hooks/useNotifications";
import { FeedPage } from "./pages/FeedPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SearchPage } from "./pages/SearchPage";
import { SignupPage } from "./pages/SignupPage";
import { TrendingPage } from "./pages/TrendingPage";

function ProtectedLayout() {
  const notifications = useNotifications();

  return (
    <ProtectedRoute>
      <AppShell notifications={notifications} />
    </ProtectedRoute>
  );
}

export function App() {
  // Runs one startup session check against the Redis-backed backend session.
  useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<FeedPage />} />
          <Route path="/trending" element={<TrendingPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/search" element={<SearchPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
