import { createSlice, createAsyncThunk, PayloadAction, createSelector } from "@reduxjs/toolkit";
import { RootState } from ".";
import { chooseBucketSize } from "../utils/bucketSize";
import TelemetryService from "../api/telemetry.service";
import { TelemetryQueryParams, SensorTelemetryResponse } from "../types/telemetry";
import { startLive, stopLive, LiveDataMessage, LiveCallbacks, getConnectionStatus } from '../lib/liveMqtt';
import { updateSensorLastSeen, markSensorsOffline, fetchSensorDetails } from './sensorsSlice';

// Rate limiting cache for unknown sensor discovery (1 minute cooldown)
const unknownSensorCache = new Map<string, number>();
const UNKNOWN_SENSOR_COOLDOWN = 60000; // 60 seconds

// Additional cache for when sensors are added to unknownSensors list (prevents spam)
const unknownSensorListCache = new Map<string, number>();
const UNKNOWN_SENSOR_LIST_COOLDOWN = 30000; // 30 seconds
const UNKNOWN_SENSOR_DISCOVERY_COOLDOWN = 60000; // 1 minute cooldown for auto-discovery

// Throttle mechanism for lastSeen updates
const lastSeenUpdateThrottleMap = new Map<string, number>();
const LAST_SEEN_UPDATE_THROTTLE_MS = 10000; // Only update lastSeen every 10 seconds per sensor

/** Re-use the point & sensor-data shapes already consumed by the charts */
export interface DataPoint {
  timestamp: number; // epoch ms (easier for Recharts)
  value: number;
}

export interface SensorData {
  id: string;
  mac: string;
  type: SensorTelemetryResponse["type"];
  unit: string;
  series: DataPoint[];

  /** aggregates forwarded from the backend */
  min: number;
  max: number;
  avg: number;
  current: number;

  /** live data specific fields */
  isLive?: boolean;
  lastUpdated?: number;
}

/* ──────────────────────────────────────────────────────────── */
/*  thunks                                                     */
/* ──────────────────────────────────────────────────────────── */
export const fetchTelemetry = createAsyncThunk<
  /* return type  */ Record<string, SensorData>,
  /* arg type     */ TelemetryQueryParams,
  /* thunk API    */ { rejectValue: string }
>("telemetry/fetchTelemetry", async (params, { rejectWithValue }) => {
  try {

    // Detect if mobile for optimized bucket sizing
    const isMobile = window.innerWidth < 768;
    const bucketSize = chooseBucketSize(params.timeRange.start, params.timeRange.end, 400, isMobile);
    
    const response = await TelemetryService.query({ ...params, bucketSize });

    /* map backend payload → UI-friendly structure */
    const mapped: Record<string, SensorData> = {};
    response.forEach((s) => {
      mapped[s.sensorId] = {
        id: s.sensorId,
        mac: s.mac,
        type: s.type,
        unit: s.unit,
        min: s.min,
        max: s.max,
        avg: s.avg,
        current: s.current,
        series: s.data.map((p) => ({
          timestamp: new Date(p.timestamp).getTime(),
          value: p.value,
        })),
        isLive: false,
        lastUpdated: Date.now()
      };
    });

    return mapped;
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? err.message ?? "Failed to fetch telemetry data";
    return rejectWithValue(msg);
  }
});

// Auto-discovery thunk for unknown sensors with rate limiting
export const autoDiscoverSensor = createAsyncThunk(
  'telemetry/autoDiscoverSensor',
  async (mac: string, { dispatch }) => {
    const now = Date.now();
    const lastAttempt = unknownSensorCache.get(mac);
    
    // Check rate limiting
    if (lastAttempt && (now - lastAttempt) < UNKNOWN_SENSOR_COOLDOWN) {
      console.log(`[TelemetrySlice] Rate limiting: skipping auto-discovery for ${mac} (last attempt ${now - lastAttempt}ms ago)`);
      return { skipped: true, mac };
    }
    
    // Update cache
    unknownSensorCache.set(mac, now);
    console.log(`[TelemetrySlice] Attempting auto-discovery for unknown sensor: ${mac}`);
    
    // Fetch sensor details in background
    try {
      await dispatch(fetchSensorDetails(mac));
      return { success: true, mac };
    } catch (error) {
      console.error(`[TelemetrySlice] Auto-discovery failed for ${mac}:`, error);
      return { success: false, mac, error };
    }
  }
);

// New live data thunk for managing MQTT connections
export const toggleLiveMode = createAsyncThunk(
  'telemetry/toggleLiveMode',
  async (params: { enable: boolean; gatewayIds: string[] }, { dispatch, getState }) => {
    const { enable, gatewayIds } = params;
    
    console.log('[TelemetrySlice] toggleLiveMode called with:', { enable, gatewayIds });
    
    if (enable) {
      // Start live connection
      console.log('[TelemetrySlice] Starting live mode...');
      dispatch(setLiveStatus('connecting'));
      
      const callbacks: LiveCallbacks = {
        onData: (data: LiveDataMessage) => {
          console.log('[TelemetrySlice] Received live data callback:', JSON.stringify(data, null, 2));
          dispatch(addLiveData(data));
          
          // Update lastSeen for each sensor that sent data (immediate updates)
          const now = new Date().toISOString();
          
          data.sensors.forEach(reading => {
            dispatch(updateSensorLastSeen({ 
              mac: reading.mac, 
              lastSeen: now,
              battery: reading.battery, // Include battery in sensor updates
              lastValue: reading.value // Include the actual sensor reading value
            }));
          });
        },
        onPresence: (topic: string, message: any) => {
          console.log('[TelemetrySlice] Presence event callback:', topic, message);
        },
        onError: (error: any) => {
          console.error('[TelemetrySlice] Live error callback:', error);
          dispatch(setLiveError(error.message || 'Connection error'));
        },
        onConnectionChange: (status) => {
          console.log('[TelemetrySlice] Connection status change callback:', status);
          dispatch(setLiveStatus(status));
        }
      };

      try {
        console.log('[TelemetrySlice] Calling startLive with gatewayIds:', gatewayIds);
        const unsubscribe = await startLive(gatewayIds, callbacks);
        console.log('[TelemetrySlice] startLive completed successfully');
        // Return the result but don't store unsubscribe in Redux
        return { enabled: true };
      } catch (error: any) {
        console.error('[TelemetrySlice] Error starting live mode:', error);
        dispatch(setLiveError(error.message || 'Failed to start live mode'));
        throw error;
      }
    } else {
      // Stop live connection
      console.log('[TelemetrySlice] Stopping live mode...');
      stopLive();
      // Mark all sensors as offline when live mode is disabled
      dispatch(markSensorsOffline());
      console.log('[TelemetrySlice] stopLive completed and sensors marked offline');
      return { enabled: false };
    }
  }
);

/* ──────────────────────────────────────────────────────────── */
/*  slice                                                      */
/* ──────────────────────────────────────────────────────────── */
interface State {
  loading: boolean;
  error: string | null;
  data: Record<string, SensorData>;
  timeRange: {
    start: Date;
    end: Date;
  };
  lastUpdated?: string;
  
  // Live data specific state
  isLiveMode: boolean;
  liveStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  maxLiveReadings: number;
  unknownSensors: string[]; // MACs of sensors that need auto-discovery
}
const initialState: State = {
  loading: false,
  error: null,
  data: {},
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1_000),
    end: new Date(),
  },
  lastUpdated: undefined,
  isLiveMode: true, // Default to live mode enabled
  liveStatus: 'disconnected',
  maxLiveReadings: 100,
  unknownSensors: [], // Track MACs that need auto-discovery
};

const telemetrySlice = createSlice({
  name: "telemetry",
  initialState,
  reducers: {
    /** clear everything (e.g. on logout) */
    clear: (s) => {
      s.data = {};
    },
    setTimeRange: (s, a: PayloadAction<{ start: Date; end: Date }>) => {
      s.timeRange = a.payload;
    },
    
    // Live mode reducers
    setLiveMode: (state, action: PayloadAction<boolean>) => {
      console.log('[TelemetrySlice] setLiveMode called with:', action.payload);
      state.isLiveMode = action.payload;
      if (!action.payload) {
        console.log('[TelemetrySlice] Clearing live flags for all sensors');
        // Clear live flags when exiting live mode
        Object.values(state.data).forEach(sensor => {
          sensor.isLive = false;
        });
        state.liveStatus = 'disconnected';
      }
    },

    setLiveStatus: (state, action: PayloadAction<'connecting' | 'connected' | 'disconnected' | 'error'>) => {
      console.log('[TelemetrySlice] setLiveStatus called with:', action.payload);
      state.liveStatus = action.payload;
    },

    setLiveError: (state, action: PayloadAction<string>) => {
      console.log('[TelemetrySlice] setLiveError called with:', action.payload);
      state.error = action.payload;
      state.liveStatus = 'error';
    },

    clearUnknownSensor: (state, action: PayloadAction<string>) => {
      const mac = action.payload;
      state.unknownSensors = state.unknownSensors.filter(unknownMac => unknownMac !== mac);
      
      // Clean up cache entries for this MAC
      unknownSensorListCache.delete(mac);
      unknownSensorCache.delete(mac);
      
      console.log(`[TelemetrySlice] Removed ${mac} from unknown sensors list and cleared cache`);
    },

    addLiveData: (state, action: PayloadAction<LiveDataMessage>) => {
      const { sensors } = action.payload;
      const now = Date.now();

      // Reduced logging frequency to prevent memory issues
      // TODO: AV
      // if (sensors.length > 0 && Math.random() < 0.05) { // Log only 5% of the time
      //   console.log('[TelemetrySlice] addLiveData called with', sensors.length, 'sensors');
      // }

      sensors.forEach(reading => {
        const { mac, name, type, unit, value, timestamp } = reading;
        
        // --- REVISED SENSOR FINDING LOGIC ---
        // Find the KEY of the sensor that has a matching MAC address.
        // Do NOT fall back to creating a new key from the MAC address.
        const sensorKey = Object.keys(state.data).find(key => state.data[key].mac === mac);

        // If no sensor with this MAC exists in our state, we cannot update it.
        // Log a warning and skip this reading. This prevents polluting the state.
        if (!sensorKey) {
          // Reduced logging to prevent memory issues - only log once per minute per unknown MAC
          // const now = Date.now();
          // const lastLogTime = unknownSensorCache.get(`log_${mac}`) || 0;
          // if (now - lastLogTime > 60000) { // 1 minute cooldown for logs
            // console.warn(`[TelemetrySlice] Unknown sensor MAC: ${mac}. Auto-discovery disabled.`);
          //   unknownSensorCache.set(`log_${mac}`, now);
          // }
          
          return; // "return" here exits the forEach loop for this iteration.
        }
        // --- END REVISED LOGIC ---

        console.log('[TelemetrySlice] Found matching sensor key:', sensorKey);
        
        // Now we are certain that `sensorKey` refers to an existing sensor 
        // (e.g., '6a8e5a7e-...') and we can safely update it.
        const sensor = state.data[sensorKey];
        
        // Add new data point
        const dataPoint: DataPoint = {
          timestamp: timestamp || now,
          value: Number(value)
        };

        // --- IMMUTABLE UPDATE LOGIC ---
        // 1. Create a new array with the new data point
        let newSeries = [...sensor.series, dataPoint];

        // 2. Sort the new array (sort() mutates, so we apply it to our new copy)
        newSeries.sort((a, b) => a.timestamp - b.timestamp);

        // 3. Slice if the new array exceeds the max length
        if (newSeries.length > state.maxLiveReadings) {
          const removedCount = newSeries.length - state.maxLiveReadings;
          newSeries = newSeries.slice(-state.maxLiveReadings);
          // Always log trimming for immediate visibility
          if (removedCount > 0) {
            console.log('[TelemetrySlice] Trimmed', removedCount, 'old data points, now have:', newSeries.length);
          }
        }

        // 4. Assign the new, sorted, and trimmed array to the state
        sensor.series = newSeries;
        // --- END IMMUTABLE UPDATE LOGIC ---

        sensor.lastUpdated = now;
        sensor.isLive = true;
        sensor.current = Number(value);

        // Update aggregates for live data
        if (sensor.series.length > 0) {
          const values = sensor.series.map(p => p.value);
          sensor.min = Math.min(...values);
          sensor.max = Math.max(...values);
          sensor.avg = values.reduce((a, b) => a + b, 0) / values.length;
        }
      });
      
      // Always log processing for immediate visibility
      console.log('[TelemetrySlice] Processed', sensors.length, 'sensor readings');
    },

    clearLiveData: (state) => {
      console.log('[TelemetrySlice] clearLiveData called');
      let clearedCount = 0;
      Object.values(state.data).forEach(sensor => {
        if (sensor.isLive) {
          sensor.series = [];
          sensor.isLive = false;
          clearedCount++;
        }
      });
      console.log('[TelemetrySlice] Cleared live data for', clearedCount, 'sensors');
    },

    updateMaxLiveReadings: (state, action: PayloadAction<number>) => {
      console.log('[TelemetrySlice] updateMaxLiveReadings called with:', action.payload);
      console.log('[TelemetrySlice] Previous maxLiveReadings:', state.maxLiveReadings);
      
      const newMaxReadings = action.payload;
      state.maxLiveReadings = newMaxReadings;
      
      console.log('[TelemetrySlice] Updated maxLiveReadings to:', state.maxLiveReadings);
      
      // Trim existing data if needed
      let trimmedSensors = 0;
      Object.values(state.data).forEach(sensor => {
        if (sensor.series.length > newMaxReadings) {
          const beforeLength = sensor.series.length;
          sensor.series = sensor.series.slice(-newMaxReadings);
          console.log(`[TelemetrySlice] Trimmed sensor data: ${beforeLength} -> ${sensor.series.length}`);
          trimmedSensors++;
        }
      });
      
      console.log(`[TelemetrySlice] Trimmed ${trimmedSensors} sensors to new limit: ${newMaxReadings}`);
    }
  },
  extraReducers: (builder) => {
    builder
      /* pending */
      .addCase(fetchTelemetry.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      /* error */
      .addCase(fetchTelemetry.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload ?? a.error.message ?? "Error";
      })
      /* success */
      // .addCase(fetchTelemetry.fulfilled, (s, a) => {
      //   s.loading = false;
      //   s.data = { ...s.data, ...a.payload };
      // })
      .addCase(fetchTelemetry.fulfilled, (state, action) => {
        state.loading = false;

        // Check if response is empty and handle appropriately
        if (!action.payload || Object.keys(action.payload).length === 0) {
          console.warn("API returned empty response for telemetry data");

          // IMPORTANT: Clear data for the requested sensors instead of keeping old data
          // Extract sensorIds from the action.meta.arg
          const requestedSensorIds = action.meta.arg.sensorIds || [];
          // Clear data for these specific sensors
          requestedSensorIds.forEach((id) => {
            state.data[id] = {
              id: id,
              mac: state.data[id]?.mac || "",
              type: state.data[id]?.type || "unknown",
              unit: state.data[id]?.unit || "",
              min: 0,
              max: 0,
              avg: 0,
              current: 0,
              series: [], // Empty the series array to reflect no data for this range
              isLive: false,
              lastUpdated: Date.now()
            } as SensorData;
          });

          state.lastUpdated = new Date().toISOString();
          return;
        }

        // Standard data update logic for non-empty responses
        Object.entries(action.payload).forEach(([sensorId, data]) => {
          state.data[sensorId] = data as SensorData;
        });

        state.lastUpdated = new Date().toISOString();
      })
      // Live mode thunk handlers
      .addCase(toggleLiveMode.pending, (state) => {
        console.log('[TelemetrySlice] toggleLiveMode.pending');
        state.loading = true;
        state.error = null;
      })
      .addCase(toggleLiveMode.fulfilled, (state, action) => {
        console.log('[TelemetrySlice] toggleLiveMode.fulfilled with:', action.payload);
        state.loading = false;
        state.isLiveMode = action.payload.enabled;
        if (!action.payload.enabled) {
          console.log('[TelemetrySlice] Live mode disabled, clearing live flags');
          // Clear live flags when stopping live mode
          Object.values(state.data).forEach(sensor => {
            sensor.isLive = false;
          });
          state.liveStatus = 'disconnected';
        }
      })
      .addCase(toggleLiveMode.rejected, (state, action) => {
        console.log('[TelemetrySlice] toggleLiveMode.rejected with error:', action.error.message);
        state.loading = false;
        state.isLiveMode = false;
        state.liveStatus = 'error';
        state.error = action.error.message || 'Failed to toggle live mode';
      });
  },
});

export const selectTimeRange = (st: RootState) => st.telemetry.timeRange;
export const { 
  clear: clearTelemetry, 
  setTimeRange,
  setLiveMode,
  setLiveStatus,
  setLiveError,
  addLiveData,
  clearLiveData,
  updateMaxLiveReadings,
  clearUnknownSensor
} = telemetrySlice.actions;

/* ──────────────────────────────────────────────────────────── */
/*  selectors (enhanced for live data)                        */
/* ──────────────────────────────────────────────────────────── */
export const selectTelemetryLoading = (st: RootState) => st.telemetry.loading;
export const selectTelemetryError = (st: RootState) => st.telemetry.error;
export const selectTelemetryData = (st: RootState) => st.telemetry.data;
export const selectSensorTelemetry = (st: RootState, id: string) => st.telemetry.data[id];

// Live mode selectors
export const selectIsLiveMode = (st: RootState) => st.telemetry.isLiveMode;
export const selectLiveStatus = (st: RootState) => st.telemetry.liveStatus;

// Memoized selector for live sensors to prevent unnecessary re-renders
export const selectLiveSensors = createSelector(
  [(st: RootState) => st.telemetry.data],
  (data) => Object.values(data).filter(sensor => sensor.isLive)
);

export const selectMaxLiveReadings = (st: RootState) => st.telemetry.maxLiveReadings;

export default telemetrySlice.reducer;
