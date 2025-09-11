// src/api/org.service.ts
import http from "./http";
import { ApiResponse, unwrapApiResponse } from "./types";

export interface OrgDTO {
  _id: string;
  name: string;
  description?: string;
  status: string;
  planId?: string;
  adminUserId?: string;
  needsUpgrade?: boolean;
  plan?: {
    name: string;
    maxGateways: number;
    maxSensors: number;
    maxUsers: number;
    retentionDays: number;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface UpdateOrgNameRequest {
  name: string;
}

export interface UpdateOrgNameResponse {
  status: string;
  statusCode: number;
  message: string;
  data: OrgDTO | null;
}

export const OrgService = {
  create(name: string) {
    return http.post("/organizations", { name });
  },
  
  createWithInvites(data: { name: string; inviteEmails?: string[] }) {
    return http.post("/organizations", data);
  },
  
  async me(): Promise<OrgDTO> {
    const response = await http.get<ApiResponse<OrgDTO>>("/organizations/me");
    return unwrapApiResponse(response.data);
  },

  async updateName(orgId: string, request: UpdateOrgNameRequest): Promise<UpdateOrgNameResponse> {
    const response = await http.put<UpdateOrgNameResponse>(`/organizations/${orgId}/name`, request);
    return response.data;
  },
};
