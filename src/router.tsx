// src/router.tsx
import { Navigate, Route, Routes, BrowserRouter, Outlet } from "react-router-dom";
import { Unauthorized } from "./pages/403";
import { NotFound } from "./pages/404";
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
import MyInvitationsPage from "./pages/MyInvitationsPage";
import DashboardInvitationsPage from "./pages/DashboardInvitationsPage";
import { GatewaysPage } from "./pages/GatewayPage";
import { SensorsPage } from "./pages/SensorsPage";
import { AnalyticsPage } from "./pages/analytics";
import { DashboardHome } from "./pages/DashboardHome";
import { PanelPage } from "./pages/PanelPage";
import { SettingsPage } from "./pages/settings";
import { TeamPage } from "./pages/TeamPage";
import { PublicInvitePage } from "./pages/PublicInvitePage";
import AuthBootstrap from "./lib/auth/AuthBootstrap";
import MyProfilePage from "./pages/MyProfilePage";
import SecurityPage from "./pages/SecurityPage";
import OrganizationManagementPage from "./pages/OrganizationManagementPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { getPermissionValue } from "./constants/permissions";

export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthBootstrap />
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
              {/* Public invitation page - accessible without login */}
              <Route path="/invites/:token" element={<PublicInvitePage />} />
            </Route>
          </Route>

          {/* ---------- private (logged‑in) with permission protection ---------- */}

          <Route element={<PrivateRoute />}>
            <Route
              path="/dashboard"
              element={
                <DashboardLayout>
                  <Outlet />
                </DashboardLayout>
              }
            >
              {/* Home - protected by home.view permission */}
              <Route 
                path="home" 
                element={
                  <ProtectedRoute permission={getPermissionValue('HOME', 'VIEW')}>
                    <DashboardHome />
                  </ProtectedRoute>
                } 
              />

              {/* Sensors - protected by sensors.view permission */}
              <Route path="sensors">
                <Route 
                  index 
                  element={
                    <ProtectedRoute permission={getPermissionValue('SENSORS', 'VIEW')}>
                      <AnalyticsPage />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path=":sensorId" 
                  element={
                    <ProtectedRoute permission={getPermissionValue('SENSORS', 'VIEW')}>
                      <AnalyticsPage />
                    </ProtectedRoute>
                  } 
                />
              </Route>

              {/* Gateways - protected by gateways.view permission */}
              <Route 
                path="gateways" 
                element={
                  <ProtectedRoute permission={getPermissionValue('GATEWAYS', 'VIEW')}>
                    <GatewaysPage />
                  </ProtectedRoute>
                } 
              />

              {/* Team Management - protected by teams.view.members permission */}
              <Route 
                path="team" 
                element={
                  <ProtectedRoute permission={getPermissionValue('TEAMS', 'VIEW_MEMBERS')}>
                    <TeamPage />
                  </ProtectedRoute>
                } 
              />

              {/* Settings - protected by settings.view permission */}
              <Route 
                path="settings" 
                element={
                  <ProtectedRoute permission={getPermissionValue('SETTINGS', 'VIEW')}>
                    <SettingsPage />
                  </ProtectedRoute>
                } 
              />

              {/* Organization Management - protected by settings.view permission */}
              <Route 
                path="organization" 
                element={
                  <ProtectedRoute permission={getPermissionValue('SETTINGS', 'VIEW')}>
                    <OrganizationManagementPage />
                  </ProtectedRoute>
                } 
              />

              {/* Routes that don't require specific permissions */}
              <Route path="panel" element={<PanelPage />} />
              <Route path="invitations" element={<DashboardInvitationsPage />} />
              <Route path="profile" element={<MyProfilePage />} />
              <Route path="security" element={<SecurityPage />} />
            </Route>

            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/invitations" element={<MyInvitationsPage />} />
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
