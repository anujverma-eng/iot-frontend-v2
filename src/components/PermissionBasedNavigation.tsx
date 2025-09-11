// src/components/PermissionBasedNavigation.tsx
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { usePermissions } from '../hooks/usePermissions';
import { PERMISSIONS, getRoutePermissions } from '../constants/permissions';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  permission?: string;
  permissions?: string[];
}

interface PermissionBasedNavigationProps {
  navItems: NavItem[];
  className?: string;
}

/**
 * Navigation component that filters items based on user permissions
 */
export const PermissionBasedNavigation: React.FC<PermissionBasedNavigationProps> = ({
  navItems,
  className = "",
}) => {
  const location = useLocation();
  const { hasPermission, hasAnyPermission } = usePermissions();
  const routePermissionsMap = getRoutePermissions();

  const filteredNavItems = navItems.filter((item) => {
    // Check if user has required permissions for this nav item
    if (item.permission) {
      return hasPermission(item.permission);
    }
    
    if (item.permissions && item.permissions.length > 0) {
      return hasAnyPermission(item.permissions);
    }
    
    // Check route-level permissions
    const routePermissions = routePermissionsMap[item.path];
    if (routePermissions) {
      return hasAnyPermission([...routePermissions]);
    }
    
    // No permissions required
    return true;
  });

  return (
    <nav className={className}>
      <div className="space-y-1">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant={isActive ? "flat" : "light"}
                color={isActive ? "primary" : "default"}
                className="w-full justify-start"
                startContent={<Icon icon={item.icon} className="h-4 w-4" />}
              >
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

// Example navigation configuration
export const defaultNavItems: NavItem[] = [
  {
    label: 'Home',
    path: '/dashboard/home',
    icon: 'lucide:home',
    permission: PERMISSIONS.HOME.VIEW,
  },
  {
    label: 'Sensors',
    path: '/dashboard/sensors',
    icon: 'lucide:activity',
    permission: PERMISSIONS.SENSORS.VIEW,
  },
  {
    label: 'Gateways',
    path: '/dashboard/gateways',
    icon: 'lucide:router',
    permission: PERMISSIONS.GATEWAYS.VIEW,
  },
  {
    label: 'Team',
    path: '/dashboard/team',
    icon: 'lucide:users',
    permission: PERMISSIONS.TEAMS.VIEW_MEMBERS,
  },
  {
    label: 'Settings',
    path: '/dashboard/settings',
    icon: 'lucide:settings',
    permission: PERMISSIONS.SETTINGS.VIEW,
  },
];

export default PermissionBasedNavigation;
