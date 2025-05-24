import http from "./http";
import {
  TelemetryQueryParams,
  SensorTelemetryResponse,
} from "../types/telemetry";

/**
 * *Single-responsibility* service for analytics queries.
 * Keeps slices / components from importing `http` directly.
 */
export const TelemetryService = {
  /**
   * POST /telemetry/query
   * Returns `data: SensorTelemetryResponse[]`
   */
  async query(params: TelemetryQueryParams): Promise<SensorTelemetryResponse[]> {
    const res = await http.post("/telemetry/query", params);
    /** expecting envelope { status, success, data, … } */
    return res.data.data as SensorTelemetryResponse[];
  },
};

export default TelemetryService;
