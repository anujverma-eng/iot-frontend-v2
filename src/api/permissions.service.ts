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
