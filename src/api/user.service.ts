import http from "./http";
import { UserRole } from "../types/User";

export interface MeDTO {
  _id: string;
  email: string;
  role: UserRole;
  orgId: string | null;
}

export const UserService = {
  async me(): Promise<MeDTO> {
    const { data } = await http.get("/users/me");
    if (!data?.success) throw new Error(data?.message ?? "ME_FAILED");
    return data.data;
  },
};
