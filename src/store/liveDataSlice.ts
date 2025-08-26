// src/store/liveDataSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './index';
import { startLive, stopLive, getConnectionStatus, LiveCallbacks } from '../lib/liveMqtt';
import { updateSensorLastSeen, selectSensors } from './sensorsSlice';
import { fetchGateways, updateGatewayPresence as updateGatewayPresenceInGatewaySlice } from './gatewaySlice';
import { addLiveData } from './telemetrySlice';
import { offlineDetectionService } from '../services/offlineDetectionService';

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
  'liveData/handleGatewayOffline',
  async (gatewayId: string, { getState }) => {
    const state = getState() as RootState;
    const sensors = selectSensors(state);
    
    console.log(`[LiveData] Handling gateway ${gatewayId} offline event with ${sensors.length} sensors`);
    
    // Pass current sensors to the offline detection service
    offlineDetectionService.handleGatewayOffline(gatewayId, sensors);
    
    return gatewayId;
  }
);

// Initialize live data connection with all available gateways
export const initializeLiveConnection = createAsyncThunk(
  'liveData/initializeConnection',
  async (_, { dispatch, getState }) => {
    const state = getState() as RootState;
    const timestamp = Date.now();
    console.log(`[LiveData:${timestamp}] Initializing live connection...`);
    console.log(`[LiveData:${timestamp}] Current state:`, {
      isConnected: state.liveData.isConnected,
      isConnecting: state.liveData.isConnecting,
      connectedGateways: state.liveData.connectedGateways
    });

    try {
      // First fetch all available gateways
      console.log(`[LiveData:${timestamp}] Fetching gateways...`);
      const gatewaysResponse = await dispatch(fetchGateways({ 
        page: 1, 
        limit: 100, // Get all gateways
        search: '' 
      })).unwrap();
      
      console.log(`[LiveData:${timestamp}] Gateways response:`, gatewaysResponse);
      
      if (!gatewaysResponse || !gatewaysResponse.data || !Array.isArray(gatewaysResponse.data)) {
        console.error(`[LiveData:${timestamp}] Invalid gateways response format:`, gatewaysResponse);
        return { gatewayIds: [], connected: false, timestamp, error: 'Invalid gateways response' };
      }
      
      const gatewayIds = gatewaysResponse.data.map((gateway: any) => gateway._id);
      console.log(`[LiveData:${timestamp}] Extracted gateway IDs:`, gatewayIds);
      
      if (gatewayIds.length === 0) {
        console.log(`[LiveData:${timestamp}] No gateways found, skipping live connection`);
        return { gatewayIds: [], connected: false, timestamp };
      }

      console.log(`[LiveData:${timestamp}] Found gateways for live connection:`, gatewayIds);
      
      // Initialize offline detection service with known gateways
      offlineDetectionService.initializeGatewayTracking(gatewayIds);
      
      // Add throttling for live data updates to improve performance
      let lastUpdateTime = 0;
      const throttleDelay = 0; // Update every 100ms maximum (10 updates per second)
      
      // Start live connection with all gateway IDs
      const callbacks: LiveCallbacks = {
        onData: (data) => {
          console.log(`[LiveData:${timestamp}] Received sensor data:`, data);
          
          // Throttle updates to prevent overwhelming the UI
          const now = Date.now();
          if (now - lastUpdateTime < throttleDelay) {
            console.log(`[LiveData:${timestamp}] Throttling update - too frequent`);
            return;
          }
          lastUpdateTime = now;
          
          // IMPORTANT: Dispatch the sensor data to telemetry slice for visualization
          dispatch(addLiveData(data));
          
          // Update sensor last seen (existing throttling applies)
          data.sensors.forEach(reading => {
            const nowStr = new Date().toISOString();
            const now = new Date(nowStr);
            
            dispatch(updateSensorLastSeen({ 
              mac: reading.mac, 
              lastSeen: nowStr,
              battery: reading.battery, // Include battery data from socket
              lastValue: reading.value // Include the actual sensor reading value
            }));

            // Notify offline detection service of sensor activity
            offlineDetectionService.updateSensorLastSeen(reading.mac, now);
          });
        },
        onPresence: (topic, message) => {
          console.log(`[LiveData:${timestamp}] Received presence update:`, topic, message);
          // Handle gateway presence updates
          if (typeof message === 'object' && message.gatewayId && typeof message.isConnected === 'boolean') {
            const presenceData = {
              gatewayId: message.gatewayId,
              isConnected: message.isConnected,
              timestamp: message.ts || new Date().toISOString()
            };
            
            // Update both liveData slice and gateway slice
            dispatch(updateGatewayPresence(presenceData));
            dispatch(updateGatewayPresenceInGatewaySlice({
              gatewayId: message.gatewayId,
              isConnected: message.isConnected
            }));

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
          console.error(`[LiveData:${timestamp}] Connection error:`, error);
          dispatch(setConnectionError(error.message || 'Connection error'));
        },
        onConnectionChange: (status) => {
          console.log(`[LiveData:${timestamp}] Connection status changed:`, status);
          dispatch(setConnectionStatus(status));
        }
      };

      console.log(`[LiveData:${timestamp}] Calling startLive with gatewayIds:`, gatewayIds);
      console.log(`[LiveData:${timestamp}] Callbacks configured:`, Object.keys(callbacks));
      
      try {
        const startLiveResult = await startLive(gatewayIds, callbacks);
        console.log(`[LiveData:${timestamp}] startLive returned:`, startLiveResult);
      } catch (startLiveError) {
        console.error(`[LiveData:${timestamp}] startLive threw error:`, startLiveError);
        throw startLiveError;
      }
      
      console.log(`[LiveData:${timestamp}] Live connection started successfully`);
      return { gatewayIds, connected: true, timestamp };
    } catch (error: any) {
      console.error(`[LiveData:${timestamp}] Failed to initialize live connection:`, error);
      
      // Reset connecting state on error
      return { gatewayIds: [], connected: false, timestamp, error: error.message };
    }
  }
);

// Manually toggle live mode (for user control)
export const toggleLiveMode = createAsyncThunk(
  'liveData/toggleLiveMode',
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
  name: 'liveData',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<'connecting' | 'connected' | 'disconnected' | 'error'>) => {
      state.isConnecting = action.payload === 'connecting';
      state.isConnected = action.payload === 'connected';
      state.isLiveMode = action.payload === 'connected';
      if (action.payload === 'connected') {
        state.error = null;
      }
    },
    setConnectionError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isConnecting = false;
      state.isConnected = false;
      state.isLiveMode = false;
    },
    updateGatewayPresence: (state, action: PayloadAction<{
      gatewayId: string;
      isConnected: boolean;
      timestamp: string;
    }>) => {
      const { gatewayId, isConnected } = action.payload;
      state.gatewayPresence[gatewayId] = isConnected;
      console.log(`[LiveData] Gateway ${gatewayId} is now ${isConnected ? 'online' : 'offline'}`);
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
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(initializeLiveConnection.pending, (state) => {
        console.log('[LiveData] Setting state to connecting...');
        state.isConnecting = true;
        state.error = null;
        state.lastConnectionAttempt = Date.now();
      })
      .addCase(initializeLiveConnection.fulfilled, (state, action) => {
        console.log('[LiveData] Connection fulfilled with payload:', action.payload);
        state.isConnecting = false;
        state.connectedGateways = action.payload.gatewayIds;
        state.isConnected = action.payload.connected;
        state.isLiveMode = action.payload.connected;
        state.error = null;
      })
      .addCase(initializeLiveConnection.rejected, (state, action) => {
        console.log('[LiveData] Connection rejected with error:', action.error);
        state.isConnecting = false;
        state.isConnected = false;
        state.isLiveMode = false;
        state.error = action.error.message || 'Failed to connect to live data';
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
        state.error = action.error.message || 'Failed to toggle live mode';
      });
  },
});

export const {
  setConnectionStatus,
  setConnectionError,
  updateGatewayPresence,
  disconnectLive,
  setAutoConnect,
  clearError
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
