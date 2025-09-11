// src/utils/permissions.ts

/**
 * Check if user has a specific permission
 */
export const hasPermission = (userPermissions: string[], permission: string): boolean => {
  return userPermissions.includes(permission);
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (userPermissions: string[], permissions: string[]): boolean => {
  return permissions.some(permission => userPermissions.includes(permission));
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (userPermissions: string[], permissions: string[]): boolean => {
  return permissions.every(permission => userPermissions.includes(permission));
};

/**
 * Filter permissions that user has from a list
 */
export const filterUserPermissions = (userPermissions: string[], permissionsToCheck: string[]): string[] => {
  return permissionsToCheck.filter(permission => userPermissions.includes(permission));
};

/**
 * Check if user can access a specific route based on route permissions
 */
export const canAccessRoute = (userPermissions: string[], routePermissions: string[]): boolean => {
  if (!routePermissions || routePermissions.length === 0) {
    return true; // No permissions required
  }
  return hasAnyPermission(userPermissions, routePermissions);
};

/**
 * Get missing permissions from a required list
 */
export const getMissingPermissions = (userPermissions: string[], requiredPermissions: string[]): string[] => {
  return requiredPermissions.filter(permission => !userPermissions.includes(permission));
};

/**
 * Check if user is super admin (has all permissions)
 */
export const isSuperAdmin = (userPermissions: string[], allPermissions: string[]): boolean => {
  return hasAllPermissions(userPermissions, allPermissions);
};

/**
 * Permission validation result type
 */
export interface PermissionCheckResult {
  hasAccess: boolean;
  missingPermissions: string[];
  userPermissions: string[];
}

/**
 * Comprehensive permission check with detailed result
 */
export const checkPermissions = (
  userPermissions: string[], 
  requiredPermissions: string[]
): PermissionCheckResult => {
  const hasAccess = hasAnyPermission(userPermissions, requiredPermissions);
  const missingPermissions = getMissingPermissions(userPermissions, requiredPermissions);
  
  return {
    hasAccess,
    missingPermissions,
    userPermissions: [...userPermissions]
  };
};
