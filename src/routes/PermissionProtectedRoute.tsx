// src/routes/PermissionProtectedRoute.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';

interface PermissionProtectedRouteProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  pageName?: string;
}

/**
 * Route component for protecting nested routes with permissions
 */
export const PermissionProtectedRoute: React.FC<PermissionProtectedRouteProps> = ({
  permission,
  permissions,
  requireAll = false,
  pageName,
}) => {
  return (
    <ProtectedRoute
      permission={permission}
      permissions={permissions}
      requireAll={requireAll}
      pageName={pageName}
    >
      <Outlet />
    </ProtectedRoute>
  );
};
