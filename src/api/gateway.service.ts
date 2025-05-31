import { Gateway, GatewayStats } from "../types/gateway";
import http from "./http";

interface ApiResponse<T> {
  status: number;
  success: boolean;
  message: string;
  data: T;
  from: string;
  error: null | string;
}

export const GatewayService = {
  getGateways: (page = 1, limit = 20, search = "") =>
    http.get("/gateways", { params: { page, limit, search } }),

  getGatewayStats: () => http.get<ApiResponse<GatewayStats>>("/gateways/stats"),

  create: (mac: string) => http.post("/gateways", { mac }),

  getGatewayById: (id: string) => http.get<ApiResponse<Gateway>>(`/gateways/${id}`),

  getSensorsByGateway: (
    id: string,
    claimed = false,
    page = 1,
    limit = 10,
    search = "",
    sort?: string,
    dir: "asc" | "desc" = "asc",
  ) =>
    http.get(`/gateways/${id}/sensors`, {
      params: { claimed, page, limit, search, sort, dir },
    }),

    updateGateway: (id: string, data: { label?: string }) =>
    http.patch(`/gateways/${id}`, data),
};
