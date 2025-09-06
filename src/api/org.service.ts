// src/api/org.service.ts
import http from "./http";
import { ApiResponse, unwrapApiResponse } from "./types";

export interface OrgDTO {
  _id: string;
  name: string;
  needsUpgrade: boolean;
  plan: {
    name: string;
    maxGateways: number;
    maxSensors: number;
    maxUsers: number;
    retentionDays: number;
  };
  createdAt: string;
}

export const OrgService = {
  create(name: string) {
    return http.post("/organizations", { name });
  },
  async me(): Promise<OrgDTO> {
    const response = await http.get<ApiResponse<OrgDTO>>("/organizations/me");
    return unwrapApiResponse(response.data);
  },
};
