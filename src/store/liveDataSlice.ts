// src/store/liveDataSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "./index";
import { startLive, stopLive, getConnectionStatus, LiveCallbacks } from "../lib/liveMqtt";
import { updateSensorLastSeen, selectSensors } from "./sensorsSlice";
import { fetchGateways, updateGatewayPresence as updateGatewayPresenceInGatewaySlice } from "./gatewaySlice";
import { addLiveData } from "./telemetrySlice";
import { offlineDetectionService } from "../services/offlineDetectionService";
import { selectCurrentUserPermissions } from "./profileSlice";
import { getPermissionValue } from "../constants/permissions";

// Gateway presence message interface
export interface GatewayPresenceMessage {
  gatewayId: string;
  isConnected: boolean;
  ts: string;
}

// Centralized live data state
interface LiveDataState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connectedGateways: string[];
  gatewayPresence: Record<string, boolean>; // gatewayId -> isConnected status
  autoConnect: boolean; // Whether to auto-connect on app start
  isLiveMode: boolean; // Global live mode status
  lastConnectionAttempt: number | null;
}

const initialState: LiveDataState = {
  isConnected: false,
  isConnecting: false,
  error: null,
  connectedGateways: [],
  gatewayPresence: {},
  autoConnect: true,
  isLiveMode: false,
  lastConnectionAttempt: null,
};

// Thunk to handle gateway going offline
export const handleGatewayOfflineEvent = createAsyncThunk(
  "liveData/handleGatewayOffline",
  async (gatewayId: string, { getState }) => {
    const state = getState() as RootState;
    const sensors = selectSensors(state);

    // Pass current sensors to the offline detection service
    offlineDetectionService.handleGatewayOffline(gatewayId, sensors);

    return gatewayId;
  }
);

// Initialize live data connection with all available gateways
export const initializeLiveConnection = createAsyncThunk(
  "liveData/initializeConnection",
  async (_, { dispatch, getState }) => {
    const state = getState() as RootState;
    const timestamp = Date.now();

    try {
      // Check if user has permission for live sensor data
      const userPermissions = selectCurrentUserPermissions(state);
      const requiredPermission = getPermissionValue("SENSORS", "LIVE");

      // Only check permissions here - URL param checks should be handled by the calling component
      // The ?mode=offline param only affects INITIAL auto-connect, not manual toggles
      if (!userPermissions.includes(requiredPermission)) {
        return {
          gatewayIds: [],
          connected: false,
          timestamp,
          error: "Permission denied: sensors.live permission required",
        };
      }

      // Check organization readiness
      const activeOrgStatus = state.activeOrg?.status;
      const activeOrgId = state.activeOrg?.orgId;

      if (activeOrgStatus !== "ready" || !activeOrgId) {
        return {
          gatewayIds: [],
          connected: false,
          timestamp,
          error: "Organization context not ready",
        };
      }

      // First fetch all available gateways

      const gatewaysResponse = await dispatch(
        fetchGateways({
          page: 1,
          limit: 100, // Get all gateways
          search: "",
        })
      ).unwrap();

      if (!gatewaysResponse || !gatewaysResponse.data || !Array.isArray(gatewaysResponse.data)) {
        return { gatewayIds: [], connected: false, timestamp, error: "Invalid gateways response" };
      }

      const gatewayIds = gatewaysResponse.data.map((gateway: any) => gateway._id);

      if (gatewayIds.length === 0) {
        return { gatewayIds: [], connected: false, timestamp };
      }

      // Initialize offline detection service with known gateways
      offlineDetectionService.initializeGatewayTracking(gatewayIds);

      // Add throttling for live data updates to improve performance
      let lastUpdateTime = 0;
      const throttleDelay = 0; // Update every 100ms maximum (10 updates per second)

      // Start live connection with all gateway IDs
      const callbacks: LiveCallbacks = {
        onData: (data) => {
          // Throttle updates to prevent overwhelming the UI
          const now = Date.now();
          if (now - lastUpdateTime < throttleDelay) {
            return;
          }
          lastUpdateTime = now;

          // IMPORTANT: Dispatch the sensor data to telemetry slice for visualization
          dispatch(addLiveData(data));

          // Update sensor last seen (existing throttling applies)
          data.sensors.forEach((reading) => {
            const nowStr = new Date().toISOString();
            const now = new Date(nowStr);

            dispatch(
              updateSensorLastSeen({
                mac: reading.mac,
                lastSeen: nowStr,
                battery: reading.battery, // Include battery data from socket
                lastValue: reading.value, // Include the actual sensor reading value
                type: reading.type, // Include sensor type from live data
                unit: reading.unit, // Include sensor unit from live data
              })
            );

            // Notify offline detection service of sensor activity
            offlineDetectionService.updateSensorLastSeen(reading.mac, now);
          });
        },
        onPresence: (topic, message) => {
          // Handle gateway presence updates
          if (typeof message === "object" && message.gatewayId && typeof message.isConnected === "boolean") {
            const presenceData = {
              gatewayId: message.gatewayId,
              isConnected: message.isConnected,
              timestamp: message.ts || new Date().toISOString(),
            };

            // Update both liveData slice and gateway slice
            dispatch(updateGatewayPresence(presenceData));
            dispatch(
              updateGatewayPresenceInGatewaySlice({
                gatewayId: message.gatewayId,
                isConnected: message.isConnected,
              })
            );

            // Notify offline detection service of gateway status change
            offlineDetectionService.updateGatewayStatus(
              message.gatewayId,
              message.isConnected,
              new Date(presenceData.timestamp)
            );

            // If gateway went offline, handle sensor dependencies
            if (!message.isConnected) {
              // We need to trigger this through a thunk to access current state
              dispatch(handleGatewayOfflineEvent(message.gatewayId));
            }
          }
        },
        onError: (error) => {
          dispatch(setConnectionError(error.message || "Connection error"));
        },
        onConnectionChange: (status) => {
          dispatch(setConnectionStatus(status));
        },
      };

      try {
        const startLiveResult = await startLive(gatewayIds, callbacks);
      } catch (startLiveError) {
        throw startLiveError;
      }

      return { gatewayIds, connected: true, timestamp };
    } catch (error: any) {
      // Reset connecting state on error
      return { gatewayIds: [], connected: false, timestamp, error: error.message };
    }
  }
);

// Manually toggle live mode (for user control)
export const toggleLiveMode = createAsyncThunk(
  "liveData/toggleLiveMode",
  async ({ enable }: { enable: boolean }, { dispatch, getState }) => {
    const state = getState() as RootState;

    if (enable && !state.liveData.isConnected) {
      await dispatch(initializeLiveConnection());
    } else if (!enable && state.liveData.isConnected) {
      stopLive();
      dispatch(disconnectLive());
    }

    return enable;
  }
);

const liveDataSlice = createSlice({
  name: "liveData",
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<"connecting" | "connected" | "disconnected" | "error">) => {
      state.isConnecting = action.payload === "connecting";
      state.isConnected = action.payload === "connected";
      state.isLiveMode = action.payload === "connected";
      if (action.payload === "connected") {
        state.error = null;
      }
    },
    setConnectionError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isConnecting = false;
      state.isConnected = false;
      state.isLiveMode = false;
    },
    updateGatewayPresence: (
      state,
      action: PayloadAction<{
        gatewayId: string;
        isConnected: boolean;
        timestamp: string;
      }>
    ) => {
      const { gatewayId, isConnected } = action.payload;
      state.gatewayPresence[gatewayId] = isConnected;
    },
    disconnectLive: (state) => {
      state.isConnected = false;
      state.isConnecting = false;
      state.isLiveMode = false;
      state.connectedGateways = [];
      state.error = null;
    },
    setAutoConnect: (state, action: PayloadAction<boolean>) => {
      state.autoConnect = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeLiveConnection.pending, (state) => {
        state.isConnecting = true;
        state.error = null;
        state.lastConnectionAttempt = Date.now();
      })
      .addCase(initializeLiveConnection.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.connectedGateways = action.payload.gatewayIds;
        state.isConnected = action.payload.connected;
        state.isLiveMode = action.payload.connected;
        state.error = null;
      })
      .addCase(initializeLiveConnection.rejected, (state, action) => {
        state.isConnecting = false;
        state.isConnected = false;
        state.isLiveMode = false;
        state.error = action.error.message || "Failed to connect to live data";
      })
      .addCase(toggleLiveMode.pending, (state) => {
        state.isConnecting = true;
      })
      .addCase(toggleLiveMode.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.isLiveMode = action.payload;
      })
      .addCase(toggleLiveMode.rejected, (state, action) => {
        state.isConnecting = false;
        state.error = action.error.message || "Failed to toggle live mode";
      });
  },
});

export const {
  setConnectionStatus,
  setConnectionError,
  updateGatewayPresence,
  disconnectLive,
  setAutoConnect,
  clearError,
} = liveDataSlice.actions;

// Selectors
export const selectLiveDataState = (state: RootState) => state.liveData;
export const selectIsLiveMode = (state: RootState) => state.liveData.isLiveMode;
export const selectIsConnecting = (state: RootState) => state.liveData.isConnecting;
export const selectConnectionError = (state: RootState) => state.liveData.error;
export const selectGatewayPresence = (state: RootState) => state.liveData.gatewayPresence;
export const selectConnectedGateways = (state: RootState) => state.liveData.connectedGateways;

// Utility selector to get gateway online status
export const selectGatewayOnlineStatus = (gatewayId: string) => (state: RootState) => {
  const presence = state.liveData.gatewayPresence[gatewayId];
  return presence !== undefined ? presence : null; // null means no presence data yet
};

export default liveDataSlice.reducer;
