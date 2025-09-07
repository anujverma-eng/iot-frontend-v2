// src/api/roles.service.ts
import http from "./http";
import { ApiResponse } from "./types";
import { UserRole } from "../types/User";

export interface RolePermission {
  name: string;
  description: string;
  permissions: string[];
  permissionCount: number;
}

export interface RolePermissionsResponse {
  roles: Record<string, RolePermission>;
  totalRoles: number;
}

export const RolesService = {
  async getRolePermissions(): Promise<RolePermissionsResponse> {
    const response = await http.get<ApiResponse<RolePermissionsResponse>>(
      '/members/roles/permissions'
    );
    
    if (!response.data.data) {
      throw new Error('No role permissions data received');
    }
    
    return response.data.data;
  },

  getPermissionsForRole(rolePermissions: RolePermissionsResponse, role: UserRole): string[] {
    const roleKey = role.toLowerCase();
    return rolePermissions.roles[roleKey]?.permissions || [];
  }
};
