// src/routes/PublicRoute.tsx
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppDispatch';

/**
 * Pages under a PublicRoute are meant for logged‑out users.
 * If we already have a valid session, bounce to the last place
 * the user tried to reach (or "/" as a default).
 */
export default function PublicRoute() {
  const status   = useAppSelector(s => s.auth.status);
  const location = useLocation();

  if (status === 'auth') {
    // if they came here from a protected page, go back there
    const redirect = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
}
