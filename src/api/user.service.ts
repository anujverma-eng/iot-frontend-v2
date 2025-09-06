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

export const UserService = {
  async me(): Promise<MeDTO> {
    const response = await http.get<ApiResponse<MeDTO>>("/users/me");
    return unwrapApiResponse(response.data);
  },
};
