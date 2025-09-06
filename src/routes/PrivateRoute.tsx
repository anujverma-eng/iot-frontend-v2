// src/routes/PrivateRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../hooks/useAppDispatch";
import { fetchProfile } from "../store/profileSlice";
import React from "react";
import { FullScreenLoader } from "../components/Loader";

export default function PrivateRoute() {
  const dispatch = useAppDispatch();
  const auth = useAppSelector((s) => s.auth);
  const profile = useAppSelector((s) => s.profile);
  const location = useLocation();

  /* fetch profile exactly once */
  React.useEffect(() => {
    if (auth.status === "auth" && !profile.loaded && !profile.loading) {
      dispatch(fetchProfile());
    }
  }, [auth.status, profile.loaded, profile.loading, dispatch]);

  /* --- guards --- */
  if (auth.status === "idle" || auth.status === "loading" || profile.loading) {
    return <FullScreenLoader show aria-label="Loading application" />;
  }

  if (auth.status === "guest" || auth.status === "error") {
    return <Navigate to="/login" replace />;
  }

  /* onboarding gate */
  if (profile.loaded && (profile.data?.memberships?.length ?? 0) === 0 && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
