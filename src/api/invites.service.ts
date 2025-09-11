// src/api/invites.service.ts
import http from "./http";
import { ApiResponse, unwrapApiResponse, Invite } from "./types";
import { UserRole } from "../types/User";

export interface InvitesListParams {
  page?: number;
  limit?: number;
  status?: string[];
  sort?: string;
  dir?: 'asc' | 'desc';
}

export interface InvitesListResponse {
  data: Invite[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateInviteRequest {
  email: string;
  role?: UserRole;
  allow?: string[];
  deny?: string[];
}

export interface BulkInviteUser {
  email: string;
  role: UserRole;
}

export interface BulkInviteRequest {
  users: BulkInviteUser[];
}

export interface BulkInviteResponse {
  message: string;
  successful: Array<{
    email: string;
    invite: Invite;
  }>;
  failed: Array<{
    email: string;
    error: string;
  }>;
}

export const InvitesService = {
  async list(orgId: string, params: InvitesListParams = {}): Promise<InvitesListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.dir) searchParams.set('dir', params.dir);
    if (params.status?.length) {
      params.status.forEach(status => searchParams.append('status[]', status));
    }

    const response = await http.get<ApiResponse<Invite[]>>(
      `/organizations/${orgId}/invites?${searchParams.toString()}`
    );
    const apiResponse = response.data;
    
    return {
      data: apiResponse.data || [],
      pagination: apiResponse.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 }
    };
  },

  async create(orgId: string, invite: CreateInviteRequest): Promise<Invite> {
    const response = await http.post<ApiResponse<Invite>>(
      `/organizations/${orgId}/invites`,
      invite
    );
    return unwrapApiResponse(response.data);
  },

  async bulkCreate(orgId: string, bulkInvite: BulkInviteRequest): Promise<BulkInviteResponse> {
    const response = await http.post<ApiResponse<BulkInviteResponse>>(
      `/organizations/${orgId}/invites/bulk`,
      bulkInvite
    );
    return unwrapApiResponse(response.data);
  },

  async revoke(orgId: string, inviteId: string): Promise<void> {
    await http.delete(`/organizations/${orgId}/invites/${inviteId}`);
  },

  // Public invite info (no auth required)
  async getPublicInvite(token: string): Promise<{
    email: string;
    orgName: string;
    role: string;
    expiresAt: string;
    status: string;
    expired: boolean;
    invitedBy?: string;
  }> {
    const response = await http.get<ApiResponse<{
      email: string;
      orgName: string;
      role: string;
      expiresAt: string;
      status: string;
      expired: boolean;
      invitedBy?: string;
    }>>(`/invites/${token}`);
    return unwrapApiResponse(response.data);
  },

  // My invitations (invitations I received)
  async getMyInvitations(orgId?: string): Promise<InvitesListResponse> {
    const response = await http.get<ApiResponse<{ invites: Invite[] }>>('/me/invites');
    const apiResponse = response.data;
    
    return {
      data: apiResponse.data?.invites || [],
      pagination: apiResponse.pagination || { page: 1, limit: 20, total: apiResponse.data?.invites?.length || 0, totalPages: 1 }
    };
  },

  async acceptInvite(token: string): Promise<any> {
    const response = await http.post<ApiResponse<any>>(`/invites/${token}/accept`);
    return unwrapApiResponse(response.data);
  },

  async declineInvite(token: string): Promise<void> {
    await http.post<ApiResponse<void>>(`/invites/${token}/decline`);
  }
};
