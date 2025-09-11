// src/hooks/usePermissions.ts
import { useCallback } from 'react';
import { useAppSelector } from './useAppDispatch';
import { selectCurrentUserPermissions, selectCurrentUserRole, selectPermissionsLoading } from '../store/profileSlice';
import { 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions, 
  canAccessRoute,
  checkPermissions,
  PermissionCheckResult 
} from '../utils/permissions';
import { getRoutePermissions } from '../constants/permissions';

export interface UsePermissionsReturn {
  permissions: string[];
  role: string | null;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  canAccessRoute: (route: string) => boolean;
  checkPermissions: (requiredPermissions: string[]) => PermissionCheckResult;
  isLoading: boolean;
}

/**
 * Hook to check user permissions
 */
export const usePermissions = (): UsePermissionsReturn => {
  const permissions = useAppSelector(selectCurrentUserPermissions);
  const role = useAppSelector(selectCurrentUserRole);
  const isLoading = useAppSelector(selectPermissionsLoading);

  const hasPermissionMemo = useCallback(
    (permission: string) => hasPermission(permissions, permission),
    [permissions]
  );

  const hasAnyPermissionMemo = useCallback(
    (perms: string[]) => hasAnyPermission(permissions, perms),
    [permissions]
  );

  const hasAllPermissionsMemo = useCallback(
    (perms: string[]) => hasAllPermissions(permissions, perms),
    [permissions]
  );

  const canAccessRouteMemo = useCallback(
    (route: string) => {
      const routePermissions = getRoutePermissions()[route] || [];
      return canAccessRoute(permissions, routePermissions);
    },
    [permissions]
  );

  const checkPermissionsMemo = useCallback(
    (requiredPermissions: string[]) => checkPermissions(permissions, requiredPermissions),
    [permissions]
  );

  return {
    permissions,
    role,
    hasPermission: hasPermissionMemo,
    hasAnyPermission: hasAnyPermissionMemo,
    hasAllPermissions: hasAllPermissionsMemo,
    canAccessRoute: canAccessRouteMemo,
    checkPermissions: checkPermissionsMemo,
    isLoading,
  };
};

/**
 * Hook to check specific permission
 */
export const useHasPermission = (permission: string): boolean => {
  const { hasPermission } = usePermissions();
  return hasPermission(permission);
};

/**
 * Hook to check multiple permissions (any)
 */
export const useHasAnyPermission = (permissions: string[]): boolean => {
  const { hasAnyPermission } = usePermissions();
  return hasAnyPermission(permissions);
};

/**
 * Hook to check route access
 */
export const useCanAccessRoute = (route: string): boolean => {
  const { canAccessRoute } = usePermissions();
  return canAccessRoute(route);
};
