import http from "./http";
import { UserRole } from "../types/User";
import { ApiResponse, unwrapApiResponse } from "./types";

export interface UserDTO {
  id: string;
  email: string;
  displayName?: string;
  cognitoSub: string;
}

export interface MembershipDTO {
  orgId: string;
  orgName: string;
  role: UserRole;
  status: string;
  permissions: {
    allow: string[];
    deny: string[];
    effective: string[];
  };
}

export interface CurrentOrgDTO {
  orgId: string;
  role: UserRole;
  permissions: string[];
}

export interface MeDTO {
  user: UserDTO;
  memberships: MembershipDTO[];
  currentOrg: CurrentOrgDTO | null;
  pendingInvitesCount: number;
}

export interface MyPermissionsDTO {
  organizationId: string;
  role: string;
  permissions: string[];
}

export interface UserSettings {
  userId: string;
  defaultOrgId?: string;
  orgChoiceMode: 'remember' | 'ask-every-time';
}

export interface UpdateUserSettingsRequest {
  defaultOrgId?: string;
  orgChoiceMode?: 'remember' | 'ask-every-time';
}

export const UserService = {
  async me(): Promise<MeDTO> {
    const response = await http.get<ApiResponse<MeDTO>>("/users/me");
    return unwrapApiResponse(response.data);
  },
  async myPermissions(): Promise<MyPermissionsDTO> {
    const response = await http.get<ApiResponse<MyPermissionsDTO>>("/users/me/permissions");
    return unwrapApiResponse(response.data);
  },
  async getMySettings(): Promise<UserSettings> {
    const response = await http.get<ApiResponse<UserSettings>>("/settings/me");
    return unwrapApiResponse(response.data);
  },
  async updateMySettings(request: UpdateUserSettingsRequest, orgId?: string): Promise<UserSettings> {
    const config = orgId ? { headers: { 'X-Org-Id': orgId } } : {};
    const response = await http.put<ApiResponse<UserSettings>>("/settings/me", request, config);
    return unwrapApiResponse(response.data);
  },
};
