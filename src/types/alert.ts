// src/types/alert.ts

export type AlertType = 'DEVICE_ONLINE' | 'DEVICE_OFFLINE' | 'LOW_BATTERY' | 'DEVICE_OUT_OF_TOLERANCE';

export type ConditionOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'between';

export interface AlertCondition {
  operator: ConditionOperator;
  value: number;
  value2?: number; // Required only for 'between' operator
}

export interface EmailChannel {
  enabled: boolean;
  addresses: string[];
}

export interface SmsChannel {
  enabled: boolean;
  phoneNumbers: string[];
}

export interface AlertChannels {
  email?: EmailChannel;
  sms?: SmsChannel;
}

export interface Alert {
  _id: string;
  orgId: string;
  name: string;
  alertType: AlertType;
  deviceId: string;
  displayName?: string;
  condition?: AlertCondition;
  channels: AlertChannels;
  throttleMinutes: number;
  enabled: boolean;
  createdBy: string;
  triggerCount: number;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRequest {
  name: string;
  alertType: AlertType;
  deviceId: string;
  condition?: AlertCondition;
  channels: AlertChannels;
  throttleMinutes: number;
  enabled?: boolean;
}

export interface UpdateAlertRequest {
  name?: string;
  deviceId?: string;
  condition?: AlertCondition;
  channels?: AlertChannels;
  throttleMinutes?: number;
  enabled?: boolean;
}

export interface AlertHistoryNotification {
  channel: 'email' | 'sms';
  recipient: string;
  success: boolean;
  timestamp: string;
}

export interface AlertHistory {
  _id: string;
  ruleId: {
    _id: string;
    name: string;
  } | string;
  orgId: string;
  alertType: AlertType;
  deviceId?: string | null;
  displayName?: string;
  triggerTime: string;
  sensorValue?: number;
  metric?: string;
  notifications: AlertHistoryNotification[];
  acknowledged: boolean;
  acknowledgedBy?: string | null;
  acknowledgedAt?: string | null;
  createdAt: string;
}

export interface AlertStats {
  totalRules: number;
  activeRules: number;
  triggersLast24Hours: number;
  triggersLast7Days: number;
  unacknowledgedAlerts: number;
}

export interface AlertsListParams {
  page?: number;
  limit?: number;
  enabled?: boolean;
  sensorId?: string;
}

export interface AlertHistoryParams {
  page?: number;
  limit?: number;
  ruleId?: string;
  sensorId?: string;
  acknowledged?: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AlertsListResponse {
  data: Alert[];
  pagination: Pagination;
}

export interface AlertHistoryResponse {
  data: AlertHistory[];
  pagination: Pagination;
}
