// src/components/PermissionWrapper.tsx
import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

interface PermissionWrapperProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  showFallback?: boolean;
}

/**
 * Wrapper component that conditionally renders children based on permissions
 * 
 * @param permission - Single permission to check
 * @param permissions - Array of permissions to check
 * @param requireAll - If true, user must have ALL permissions. If false, ANY permission is sufficient
 * @param fallback - Component to render when user doesn't have permission
 * @param showFallback - Whether to show fallback or just hide content
 * @param children - Content to render when user has permission
 */
export const PermissionWrapper: React.FC<PermissionWrapperProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  showFallback = false,
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading, permissions: userPermissions } = usePermissions();

  // Show loading state if permissions are being fetched
  if (isLoading) {
    return showFallback ? fallback : null;
  }

  let hasAccess = false;

  if (permission) {
    // Single permission check
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    // Multiple permissions check
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  } else {
    // No permissions specified, allow access
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  return showFallback ? <>{fallback}</> : null;
};

export default PermissionWrapper;
