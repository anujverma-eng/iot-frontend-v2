// src/api/sensor.service.ts
import http from "./http";
import type { Sensor, SensorResponse, SensorTelemetryResponse, TelemetryQueryParams } from "../types/sensor";
import { ServerResponse } from "http";

/** All sensor-related API calls live here so pages/slices never import `http` directly */
export const SensorService = {
  /* ── CRUD / list ─────────────────────────────────────────── */
  getSensors(params: {
    page?: number;
    limit?: number;
    claimed?: boolean;
    search?: string;
    sort?: string | null;
    dir?: "asc" | "desc";
  }) {
    const { page = 1, limit = 50, claimed = true, search = "", sort, dir = "asc" } = params;
    return http
      .get<ServerResponse>("/sensors", {
        params: { page, limit, claimed, q: search, sort, dir },
      })
      .then((r) => r.data);
  },

  getSensorByMac(mac: string): Promise<Sensor> {
    return http.get(`/sensors/${mac}`).then((r) => r.data.data as Sensor);
  },

  updateSensor(mac: string, body: Partial<Sensor>) {
    return http.patch(`/sensors/${mac}`, body).then((r) => r.data);
  },

  claimSensor(mac: string, displayName?: string) {
    return http.post(`/sensors/${mac}/claim`, { displayName }).then((r) => r.data);
  },

  unclaimSensor(mac: string) {
    return http.post(`/sensors/${mac}/unclaim`).then((r) => r.data);
  },

  addSensor(gatewayId: string, macs: string[]) {
    return http.post(`/gateways/${gatewayId}/sensors`, { macs }).then((r) => r.data);
  },

  /* ── stats & telemetry ───────────────────────────────────── */
  getSensorStats(): Promise<{ claimed: number; unclaimed: number; avgReadingFrequency: number }> {
    return http.get("/sensors/stats").then((r) => r.data.data);
  },

  telemetry(params: TelemetryQueryParams): Promise<SensorTelemetryResponse[]> {
    return http.post("/telemetry/query", params).then((r) => r.data.data);
  },

  toggleSensorStar(mac: string) {
    return http.post(`/sensors/${mac}/star`).then((r) => r.data);
  },

  updateSensorNickname(mac: string, displayName: string) {
    return http.patch(`/sensors/${mac}`, { displayName }).then((r) => r.data);
  },
  async getSensorById(id: string): Promise<Sensor> {
    const response = await http.get(`/sensors/${id}`);
    return response.data.data;
  },
};
export default SensorService;
