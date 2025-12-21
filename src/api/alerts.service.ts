// src/api/alerts.service.ts
import http from './http';
import {
  Alert,
  AlertsListParams,
  AlertsListResponse,
  AlertHistoryParams,
  AlertHistoryResponse,
  CreateAlertRequest,
  UpdateAlertRequest,
  AlertStats,
  AlertHistory
} from '../types/alert';

interface ApiResponse<T> {
  status: number;
  success: boolean;
  message: string;
  data: T;
  from: string;
  error: null | string;
  pagination?: any;
}

export const AlertsService = {
  /**
   * List all alert rules with pagination and filters
   */
  listAlerts: async (params: AlertsListParams = {}): Promise<AlertsListResponse> => {
    const { page = 1, limit = 20, enabled, sensorId } = params;
    const response = await http.get<ApiResponse<Alert[]>>('/alerts', {
      params: { page, limit, enabled, sensorId }
    });
    return {
      data: response.data.data,
      pagination: response.data.pagination
    };
  },

  /**
   * Get a single alert rule by ID
   */
  getAlertById: async (id: string): Promise<Alert> => {
    const response = await http.get<ApiResponse<Alert>>(`/alerts/${id}`);
    return response.data.data;
  },

  /**
   * Create a new alert rule
   */
  createAlert: async (data: CreateAlertRequest): Promise<Alert> => {
    const response = await http.post<ApiResponse<Alert>>('/alerts', data);
    return response.data.data;
  },

  /**
   * Update an existing alert rule
   */
  updateAlert: async (id: string, data: UpdateAlertRequest): Promise<Alert> => {
    const response = await http.patch<ApiResponse<Alert>>(`/alerts/${id}`, data);
    return response.data.data;
  },

  /**
   * Toggle alert rule enabled/disabled status
   */
  toggleAlert: async (id: string, enabled: boolean): Promise<Alert> => {
    const response = await http.patch<ApiResponse<Alert>>(`/alerts/${id}/toggle`, { enabled });
    return response.data.data;
  },

  /**
   * Delete an alert rule
   */
  deleteAlert: async (id: string): Promise<void> => {
    await http.delete(`/alerts/${id}`);
  },

  /**
   * Get alert statistics
   */
  getAlertStats: async (): Promise<AlertStats> => {
    const response = await http.get<ApiResponse<AlertStats>>('/alerts/stats');
    return response.data.data;
  },

  /**
   * Get alert history with pagination and filters
   */
  getAlertHistory: async (params: AlertHistoryParams = {}): Promise<AlertHistoryResponse> => {
    const { page = 1, limit = 20, ruleId, sensorId, acknowledged } = params;
    const response = await http.get<ApiResponse<AlertHistory[]>>('/alerts/history', {
      params: { page, limit, ruleId, sensorId, acknowledged }
    });
    return {
      data: response.data.data,
      pagination: response.data.pagination
    };
  },

  /**
   * Acknowledge an alert in history
   */
  acknowledgeAlert: async (historyId: string): Promise<AlertHistory> => {
    const response = await http.patch<ApiResponse<AlertHistory>>(`/alerts/history/${historyId}/acknowledge`);
    return response.data.data;
  },
};
