// src/components/PermissionGuard.tsx
import React from 'react';
import { Card, CardBody, Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { PAGE_TITLES } from '../constants/permissions';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  pageName?: string;
  redirectTo?: string;
}

/**
 * Permission guard component for page-level access control
 * Shows a permission denied page when user doesn't have required permissions
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  permissions,
  requireAll = false,
  pageName,
  redirectTo = '/dashboard/home',
}) => {
  const navigate = useNavigate();
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading, permissions: userPermissions } = usePermissions();

  // Show loading state while permissions are being fetched
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-default-500">Loading permissions...</p>
        </div>
      </div>
    );
  }

  let hasAccess = false;
  let requiredPermissions: string[] = [];

  if (permission) {
    hasAccess = hasPermission(permission);
    requiredPermissions = [permission];
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
    requiredPermissions = permissions;
  } else {
    // No permissions specified, allow access
    hasAccess = true;
  }

  if (hasAccess) {
    return <>{children}</>;
  }

  // Determine page name for display
  const displayPageName = pageName || PAGE_TITLES[requiredPermissions[0] as keyof typeof PAGE_TITLES] || 'Page';

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full">
        <CardBody className="text-center space-y-6 p-8">
          <div className="flex justify-center">
            <div className="bg-danger-50 p-4 rounded-full">
              <Icon 
                icon="lucide:lock" 
                className="h-12 w-12 text-danger-500"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Access Denied
            </h2>
            <p className="text-default-500">
              You don't have permission to access <strong>{displayPageName}</strong>
            </p>
          </div>

          <div className="bg-danger-50 p-4 rounded-lg">
            <p className="text-sm text-danger-600 font-medium mb-2">
              Required permissions:
            </p>
            <ul className="text-xs text-danger-600 space-y-1">
              {requiredPermissions.map((perm) => (
                <li key={perm} className="font-mono">
                  • {perm}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <Button
              color="primary"
              onPress={() => navigate(redirectTo)}
              className="w-full"
            >
              Go to Dashboard
            </Button>
            <Button
              variant="light"
              onPress={() => navigate(-1)}
              className="w-full"
            >
              Go Back
            </Button>
          </div>

          <p className="text-xs text-default-400">
            Contact your organization administrator if you need access to this page.
          </p>
        </CardBody>
      </Card>
    </div>
  );
};

export default PermissionGuard;
