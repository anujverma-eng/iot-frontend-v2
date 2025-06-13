export interface Sensor {
  _id: string;
  mac: string;
  type: string;
  unit: string;
  lastValue: number;
  lastUnit: string;
  lastSeen: string;
  ignored: boolean;
  displayName?: string;
  claimed?: boolean;
  lastSeenBy?: string[];
  isStarred?: boolean;
  status?: "live" | "offline";
  firstSeen: string;
  name?: string; // Optional field for display name
  id?: string; // Optional field for compatibility with some APIs
}

export interface SensorResponse {
  status: number;
  success: boolean;
  message: string;
  data: Sensor[];
  from: string;
  error: null | string;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface SensorTelemetry {
  timestamp: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
}

export interface SensorTelemetryResponse {
  sensorId: string;
  mac: string;
  type: string;
  unit: string;
  data: SensorTelemetry[];
  min: number;
  max: number;
  avg: number;
  current: number;
}

export interface TelemetryQueryParams {
  sensorIds: string[];
  timeRange: {
    start: string;
    end: string;
  };
  bucketSize?: string; // e.g., '1h', '15m', '1d'
}

export type SensorType = 
  | 'temperature' 
  | 'humidity' 
  | 'pressure' 
  | 'battery' 
  | 'co2' 
  | 'light' 
  | 'motion'
  | 'unknown'
  | 'accelerometer'
  | 'generic'; // Add 'generic' as a valid SensorType

// export interface ChartConfig {
//   type: SensorType;
//   unit: string;
//   series: {
//     id: string;
//     name: string;
//     data: SensorTelemetry[];
//     color?: string;
//   }[];
//   min?: number;
//   max?: number;
//   avg?: number;
//   current?: number;
// }

export interface ChartConfig {
  type: SensorType;
  unit: string;
  series: DataPoint[];
  color?: string;
  visualizationType?: VisualizationType;
  showMovingAverage?: boolean;
  showDailyRange?: boolean;
}

export type SensorStatus = "live" | "offline";
export type VisualizationType =
  | "line"
  | "area"
  | "bar"
  | "gauge"
  | "candlestick"
  | "histogram"
  | "heatmap"
  | "fft"
  | "spark";

/* ➜ 1-B  Filter types the mock slice relied on */
export interface TimeRange {
  start: Date;
  end: Date;
}
export type FilterState = {
  types: SensorType[];
  status: SensorStatus | "all";
  timeRange: {
    start: Date;
    end: Date;
  };
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  search?: string;
};

/* ➜ 1-C  Extra helper shapes the mock charts used */
export interface DataPoint {
  timestamp: number;
  value: number;
  movingAverage?: number;
}
export interface SensorData {
  id: string;
  mac: string;
  type: SensorType;
  unit: string;
  series: DataPoint[];
}

export interface MultiSeriesConfig {
  type: SensorType;
  unit: string;
  series: {
    id: string;
    name: string;
    color: string;
    data: DataPoint[];
  }[];
}