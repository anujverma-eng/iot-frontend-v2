// src/api/org.service.ts
import http from "./http";

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
  me(): Promise<OrgDTO> {
    return http.get("/organizations/me").then((r) => r.data.data);
  },
};
