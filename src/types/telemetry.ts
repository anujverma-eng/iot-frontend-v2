/** One raw reading coming back from the backend */
export interface TelemetryPoint {
  /** ISO-8601 string — we’ll convert to epoch ms where needed */
  timestamp: string;
  /** numeric reading exactly as stored */
  value: number;
}

/** What each sensor block looks like in the response payload */
export interface SensorTelemetryResponse {
  /** Mongo/ObjectId or DB primary key for the sensor */
  sensorId: string;
  /** MAC address (helps the UI when display names are blank) */
  mac: string;
  /** e.g. “temperature”, “humidity”, … — must match <SensorType> union */
  type: "temperature" | "humidity" | "pressure" | "battery" | "co2" | "light" | "motion" | "unknown";
  /** base unit string, ex: "°C", "%", "hPa", "ppm" */
  unit: string;
  /** full un-bucketed series (or bucketed if `bucketSize` supplied) */
  data: TelemetryPoint[];
  /** aggregate helpers so the UI can skip client-side scans */
  min: number;
  max: number;
  avg: number;
  /** most recent point’s value */
  current: number;
}

/** POST body we’ll send to /telemetry/query  */
export interface TelemetryQueryParams {
  /** one or many sensor IDs */
  sensorIds: string[];
  /** inclusive ISO start / end */
  timeRange: {
    start: string;
    end: string;
  };
  /** optional roll-up period like “15m”, “1h”, “1d” */
  bucketSize?: string;
}
