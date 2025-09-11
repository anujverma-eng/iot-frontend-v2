// src/components/ProtectedRoute.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import { PermissionGuard } from './PermissionGuard';
import { getRoutePermissions } from '../constants/permissions';

interface ProtectedRouteProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  pageName?: string;
}

/**
 * Higher-order component for protecting routes with permissions
 * Automatically determines required permissions based on current route
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  pageName,
}) => {
  const location = useLocation();

  // If specific permissions are provided, use them
  if (permission || permissions) {
    return (
      <PermissionGuard
        permission={permission}
        permissions={permissions}
        requireAll={requireAll}
        pageName={pageName}
      >
        {children}
      </PermissionGuard>
    );
  }

  // Otherwise, determine permissions from current route
  const routePermissions = getRoutePermissions()[location.pathname];
  
  if (routePermissions && routePermissions.length > 0) {
    return (
      <PermissionGuard
        permissions={routePermissions}
        requireAll={false} // For route access, any permission is sufficient
        pageName={pageName}
      >
        {children}
      </PermissionGuard>
    );
  }

  // No permissions required for this route
  return <>{children}</>;
};

export default ProtectedRoute;
