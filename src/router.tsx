// src/router.tsx
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { Unauthorized } from "./pages/403";
import { NotFound } from "./pages/404";
import Dashboard from "./pages/Dashboard";
import Logout from "./pages/Logout";
import { Terms } from "./pages/Terms";
import { ForgotPassword } from "./pages/forgot-password";
import { Home } from "./pages/home";
import { Login } from "./pages/login";
import { Privacy } from "./pages/privacy";
import PrivateRoute from "./routes/PrivateRoute";
import PublicRoute from "./routes/PublicRoute";
import { RoleProtectedRoute } from "./routes/RoleProtectedRoute";
import { UserRole } from "./types/User";
import { PublicLayout } from "./layouts/PublicLayout";
import { DashboardLayout } from "./layouts/dashboard-layout";
import RootLayout from "./layouts/RootLayout";
import OnboardingPage from "./pages/OnboardingPage";
import { GatewaysPage } from "./pages/GatewayPage";
import { SensorsPage } from "./pages/SensorsPage";
import { AnalyticsPage } from "./pages/analytics";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* root picks the right navbar automatically */}
        <Route element={<RootLayout />}>
          {/* ---------- public (logged-out) ---------- */}
          <Route element={<PublicLayout />}>
            <Route element={<PublicRoute />}>
              <Route index element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
            </Route>
          </Route>

          {/* ---------- private (logged‑in) ---------- */}

          <Route element={<PrivateRoute />}>
            <Route
              path="/dashboard"
              element={
                <DashboardLayout>
                  <Outlet />
                </DashboardLayout>
              }
            >
              <Route index element={<AnalyticsPage />} />
              <Route path="gateways" element={<GatewaysPage />} />
              <Route path="sensors" element={<SensorsPage />} />+{" "}
              <Route path="analytics">
                <Route index element={<AnalyticsPage />} />
                <Route path=":sensorId" element={<AnalyticsPage />} />
              </Route>
            </Route>

            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/logout" element={<Logout />} />

            {/* role‑guarded admin area */}
            <Route element={<RoleProtectedRoute roles={[UserRole.ADMIN]} />}>
              {/* <Route path="/admin" element={<Admin />} /> */}
            </Route>

            {/* 403 page — user is logged‑in but not allowed */}
            <Route path="/unauthorized" element={<Unauthorized />} />
          </Route>
        </Route>

        {/* ---------- fall‑through ---------- */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
