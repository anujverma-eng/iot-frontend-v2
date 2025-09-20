// src/constants/permissions.ts
import { PermissionsCatalog, getPermission } from '../api/permissions.service';

// Dynamic permissions object that will be populated from API
export let PERMISSIONS: Record<string, Record<string, string>> = {};

// Static fallback permissions (in case API fails)
export const FALLBACK_PERMISSIONS = {
  HOME: {
    VIEW: 'home.view',
  },
  DASHBOARD: {
    VIEW: 'dashboard.view',
  },
  SENSORS: {
    VIEW: 'sensors.view',
    LIVE: 'sensors.live',
    ADD: 'sensors.add',  // for claim
    CREATE: 'sensors.create',  // for claim sensor
    UPDATE: 'sensors.update',  // for update name, favorite
    DELETE: 'sensors.delete',  // for unclaim
    HISTORICAL: 'sensors.historical',  // for telemetry data
  },
  GATEWAYS: {
    VIEW: 'gateways.view',
    DETAILS: 'gateways.details',
    ADD: 'gateways.add',  // for register
    UPDATE: 'gateways.update',  // for label, location update
    DELETE: 'gateways.delete',
  },
  TEAMS: {
    VIEW_MEMBERS: 'teams.view.members',
    REMOVE_MEMBERS: 'teams.remove.members',
    MANAGE_ROLES: 'teams.roles',
    MANAGE_PERMISSIONS: 'teams.permissions'
  },
  INVITES: {
    VIEW: 'invites.view',
    CREATE: 'invites.create',
    REVOKE: 'invites.revoke',
  },
  SETTINGS: {
    VIEW: 'settings.view',
    RENAME_ORG: 'settings.rename_org',
    UPDATE_SENSOR_OFFLINE_TIME: 'settings.update_sensor_offline_time',
  }
} as const;

// Initialize permissions from API response
export const initializePermissions = (permissionsData: PermissionsCatalog) => {
  PERMISSIONS = permissionsData.permissions;
};

// Helper function to get permission value safely
export const getPermissionValue = (category: string, action: string): string => {
  const dynamicPermission = PERMISSIONS[category]?.[action];
  const fallbackCategory = FALLBACK_PERMISSIONS[category as keyof typeof FALLBACK_PERMISSIONS];
  const fallbackPermission = fallbackCategory ? (fallbackCategory as any)[action] : undefined;
  return dynamicPermission || fallbackPermission || `${category.toLowerCase()}.${action.toLowerCase()}`;
};

// Route permission mappings
export const getRoutePermissions = (): Record<string, string[]> => ({
  '/dashboard/home': [getPermissionValue('HOME', 'VIEW')],
  '/dashboard': [getPermissionValue('DASHBOARD', 'VIEW')],
  '/dashboard/sensors': [getPermissionValue('SENSORS', 'VIEW')],
  '/dashboard/gateways': [getPermissionValue('GATEWAYS', 'VIEW')],
  '/dashboard/team': [getPermissionValue('TEAMS', 'VIEW_MEMBERS')],
  '/dashboard/analytics': [getPermissionValue('DASHBOARD', 'VIEW')],
  '/dashboard/organization': [getPermissionValue('SETTINGS', 'VIEW')],
  '/dashboard/settings': [getPermissionValue('SETTINGS', 'VIEW')],
});

// Page titles for permission denied messages
export const PAGE_TITLES: Record<string, string> = {
  'home.view': 'Home',
  'dashboard.view': 'Dashboard',
  'sensors.view': 'Sensors',
  'sensors.add': 'Claim Sensors',
  'sensors.update': 'Update Sensor',
  'sensors.delete': 'Delete Sensor',
  'gateways.view': 'Gateways',
  'gateways.details': 'Gateway Details',
  'gateways.update': 'Update Gateway',
  'teams.view.members': 'Team Management',
  'settings.view': 'Settings',
};
