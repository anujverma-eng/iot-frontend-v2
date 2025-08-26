import http from "./http";

// Response interfaces
export interface SettingsResponse {
  _id: string;
  sensorOfflineTimeOut: number;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettingsCreateRequest {
  sensorOfflineTimeOut: number;
}

export interface SettingsUpdateRequest {
  sensorOfflineTimeOut: number;
}

export const SettingsService = {
  /**
   * Get current organization settings
   */
  async getSettings(): Promise<SettingsResponse> {
    try {
      const { data } = await http.get("/settings");
      if (!data?.success) throw new Error(data?.message ?? "GET_SETTINGS_FAILED");
      return data.data;
    } catch (error: any) {
      // Handle 404 specifically - settings don't exist yet
      if (error.response?.status === 404) {
        const errorMessage = error.response?.data?.message?.message || "Settings not found for your organization";
        throw new Error(`SETTINGS_NOT_FOUND: ${errorMessage}`);
      }
      
      // Handle other HTTP errors
      if (error.response?.data?.message) {
        const apiError = typeof error.response.data.message === 'string' 
          ? error.response.data.message 
          : error.response.data.message.message || 'Unknown API error';
        throw new Error(`API_ERROR: ${apiError}`);
      }
      
      // Re-throw original error if no specific handling
      throw error;
    }
  },

  /**
   * Create new organization settings
   */
  async createSettings(request: SettingsCreateRequest): Promise<SettingsResponse> {
    try {
      const { data } = await http.post("/settings", request);
      if (!data?.success) throw new Error(data?.message ?? "CREATE_SETTINGS_FAILED");
      return data.data;
    } catch (error: any) {
      // Handle API errors
      if (error.response?.data?.message) {
        const apiError = typeof error.response.data.message === 'string' 
          ? error.response.data.message 
          : error.response.data.message.message || 'Unknown API error';
        throw new Error(`CREATE_FAILED: ${apiError}`);
      }
      
      throw error;
    }
  },

  /**
   * Update existing organization settings
   */
  async updateSettings(request: SettingsUpdateRequest): Promise<SettingsResponse> {
    try {
      const { data } = await http.put("/settings", request);
      if (!data?.success) throw new Error(data?.message ?? "UPDATE_SETTINGS_FAILED");
      return data.data;
    } catch (error: any) {
      // Handle API errors
      if (error.response?.data?.message) {
        const apiError = typeof error.response.data.message === 'string' 
          ? error.response.data.message 
          : error.response.data.message.message || 'Unknown API error';
        throw new Error(`UPDATE_FAILED: ${apiError}`);
      }
      
      throw error;
    }
  },
};
