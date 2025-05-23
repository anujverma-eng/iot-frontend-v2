export interface Gateway {
  _id: string;
  mac: string;
  status: "active" | "offline" | "claimed" | "unclaimed";
  lastSeen: string;
  orgId: string;
  label?: string;
  createdAt: string;
  updatedAt: string;
  sensors: {
    claimed: number;
    unclaimed: number;
  };
  sensorCounts: Array<{
    _id: boolean;
    c: number;
  }>;
}

export interface GatewayResponse {
  status: number;
  success: boolean;
  message: string;
  data: Gateway[];
  from: string;
  error: null | string;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface GatewayStats {
  totalGateways: number;
  liveGateways: number;
}

// Add a new interface for the single gateway response
export interface GatewayDetailResponse {
  status: number;
  success: boolean;
  message: string;
  data: Gateway;
  from: string;
  error: null | string;
}