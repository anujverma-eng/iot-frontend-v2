// src/api/permissions.service.ts
import http from "./http";
import { ApiResponse, unwrapApiResponse } from "./types";

export interface PermissionCategory {
  key: string;
  label: string;
  description: string;
  permissions: Array<{
    key: string;
    value: string;
    label: string;
  }>;
}

export interface PermissionsCatalog {
  permissions: Record<string, Record<string, string>>;
  allPermissions: string[];
  categories: PermissionCategory[];
}

export const PermissionsService = {
  async getCatalog(): Promise<PermissionsCatalog> {
    const response = await http.get<ApiResponse<PermissionsCatalog>>("/users/permissions/all");
    const data = response.data.data;
    if (!data) {
      throw new Error('No permissions data received');
    }
    return data;
  }
};

// Dynamic permissions object that will be populated from API
export let PERMISSIONS: Record<string, Record<string, string>> = {};

// Function to get permission values dynamically
export const getPermission = (category: string, action: string): string => {
  return PERMISSIONS[category]?.[action] || `${category.toLowerCase()}.${action.toLowerCase()}`;
};

// Initialize permissions from API response
export const initializePermissions = (permissionsData: PermissionsCatalog) => {
  PERMISSIONS = permissionsData.permissions;
};

// Route permission mappings - will be updated after permissions are loaded
export let ROUTE_PERMISSIONS: Record<string, string[]> = {};

// Initialize route permissions
export const initializeRoutePermissions = () => {
  ROUTE_PERMISSIONS = {
    '/dashboard/home': [getPermission('HOME', 'VIEW')],
    '/dashboard': [getPermission('DASHBOARD', 'VIEW')],
    '/dashboard/sensors': [getPermission('SENSORS', 'VIEW')],
    '/dashboard/gateways': [getPermission('GATEWAYS', 'VIEW')],
    '/dashboard/team': [getPermission('TEAMS', 'VIEW_MEMBERS')],
    '/dashboard/analytics': [getPermission('DASHBOARD', 'VIEW')],
    '/dashboard/organization': [getPermission('SETTINGS', 'VIEW')],
    '/dashboard/settings': [getPermission('SETTINGS', 'VIEW')],
  };
};

// Page titles for permission denied messages
export const PAGE_TITLES: Record<string, string> = {
  'home.view': 'Home',
  'dashboard.view': 'Dashboard',
  'sensors.view': 'Sensors',
  'gateways.view': 'Gateways',
  'teams.view.members': 'Team Management',
  'settings.view': 'Settings',
};
