// src/components/PermissionButton.tsx
import React from 'react';
import { Button, ButtonProps, Tooltip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { usePermissions } from '../hooks/usePermissions';

interface PermissionButtonProps extends Omit<ButtonProps, 'isDisabled'> {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  children: React.ReactNode;
  lockedTooltip?: string;
  lockedIcon?: string;
  isDisabled?: boolean; // Allow explicit disabled state
}

/**
 * Button component that shows as disabled/locked when user doesn't have permission
 * Always visible but provides visual feedback about permission status
 * 
 * @param permission - Single permission to check
 * @param permissions - Array of permissions to check
 * @param requireAll - If true, user must have ALL permissions. If false, ANY permission is sufficient
 * @param lockedTooltip - Custom tooltip message when button is locked
 * @param lockedIcon - Icon to show when button is locked (defaults to lock icon)
 * @param children - Button content
 */
export const PermissionButton: React.FC<PermissionButtonProps> = ({
  permission,
  permissions,
  requireAll = false,
  children,
  lockedTooltip,
  lockedIcon = "lucide:lock",
  onPress,
  isDisabled = false,
  ...buttonProps
}) => {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = usePermissions();

  // Determine if user has access
  let hasAccess = false;
  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  } else {
    hasAccess = true; // No permissions specified
  }

  // Create default locked tooltip based on permissions
  const defaultLockedTooltip = permission 
    ? `You don't have permission: ${permission}`
    : permissions 
    ? `You don't have required permissions: ${permissions.join(', ')}`
    : 'Permission required';

  const tooltipMessage = lockedTooltip || defaultLockedTooltip;

  // If user has access, render normal button
  if (hasAccess) {
    return (
      <Button
        {...buttonProps}
        onPress={onPress}
        isDisabled={isDisabled || isLoading}
      >
        {children}
      </Button>
    );
  }

  // If user doesn't have access, render locked button with tooltip
  const isButtonDisabled = isDisabled || true; // Always disabled when no permission
  
  return (
    <Tooltip content={tooltipMessage} color="warning" placement="top">
      <Button
        {...buttonProps}
        isDisabled={isButtonDisabled}
        variant="bordered"
        color="default"
        startContent={<Icon icon={lockedIcon} className="w-4 h-4" />}
        onPress={undefined} // Ensure no action on disabled button
      >
        {children}
      </Button>
    </Tooltip>
  );
};

export default PermissionButton;