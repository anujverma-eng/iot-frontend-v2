// src/api/members.service.ts
import http from "./http";
import { ApiResponse, unwrapApiResponse } from "./types";
import { UserRole } from "../types/User";

export interface MembershipWithUser {
  _id: string;
  userId: string;
  orgId: string;
  role: UserRole;
  allow: string[];
  deny: string[];
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  user: {
    email: string;
    displayName?: string;
  };
  permissions: string[]; // effective permissions
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  invitedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
}

export interface MembersListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
}

export interface MembersListResponse {
  data: MembershipWithUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const MembersService = {
  async list(orgId: string, params: MembersListParams = {}): Promise<MembersListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.search) searchParams.set('search', params.search);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.dir) searchParams.set('dir', params.dir);

    const response = await http.get<ApiResponse<MembershipWithUser[]>>(
      `/organizations/${orgId}/members?${searchParams.toString()}`
    );
    const apiResponse = response.data;
    
    return {
      data: apiResponse.data || [],
      pagination: apiResponse.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 }
    };
  },

  async updateRole(
    orgId: string, 
    membershipId: string, 
    role: UserRole,
    permissions?: { allow: string[]; deny: string[] }
  ): Promise<{ id: string; role: UserRole }> {
    const payload: any = { role };
    if (permissions) {
      payload.allow = permissions.allow;
      payload.deny = permissions.deny;
    }
    
    const response = await http.patch<ApiResponse<{ id: string; role: UserRole }>>(
      `/organizations/${orgId}/members/${membershipId}/role`,
      payload
    );
    const apiResponse = response.data;
    if (!apiResponse.data) {
      throw new Error('No data received from role update');
    }
    return apiResponse.data;
  },

  async updatePermissions(
    orgId: string, 
    membershipId: string, 
    permissions: { allow: string[]; deny: string[] }
  ): Promise<{ id: string; allow: string[]; deny: string[] }> {
    const response = await http.patch<ApiResponse<{ id: string; allow: string[]; deny: string[] }>>(
      `/organizations/${orgId}/members/${membershipId}/permissions`,
      permissions
    );
    const apiResponse = response.data;
    if (!apiResponse.data) {
      throw new Error('No data received from permissions update');
    }
    return apiResponse.data;
  },

  async remove(orgId: string, membershipId: string): Promise<void> {
    await http.delete(`/organizations/${orgId}/members/${membershipId}`);
  }
};
