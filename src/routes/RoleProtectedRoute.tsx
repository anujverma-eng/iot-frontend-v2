import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { UserRole, AuthUser } from "../types/User";
import { useAppSelector } from "../hooks/useAppDispatch";

export function RoleProtectedRoute({ roles }: { roles: UserRole[] }) {
  const { user, status } = useAppSelector((s) => s.auth) as { user: AuthUser | null; status: string };
  const location = useLocation();

  /* while auth is still boot‑strapping */
  if (status === "idle" || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="animate-pulse text-brand-600">Loading…</p>
      </div>
    );
  }

  /* not logged‑in -> bounce to /login, remember where we came from */
  if (!user || status !== "auth") return <Navigate to="/login" state={{ from: location }} replace />;

  /* logged‑in but role not allowed -> /unauthorized */
  if (!roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  /* all good – render child route(s) */
  return <Outlet />;
}
