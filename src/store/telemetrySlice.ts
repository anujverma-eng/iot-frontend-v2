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

      return { skipped: true, mac };
    }
    
    // Update cache
    unknownSensorCache.set(mac, now);

    // Fetch sensor details in background
    try {
      await dispatch(fetchSensorDetails(mac));
      return { success: true, mac };
    } catch (error) {

      return { success: false, mac, error };
    }
  }
);

// New live data thunk for managing MQTT connections
export const toggleLiveMode = createAsyncThunk(
  'telemetry/toggleLiveMode',
  async (params: { enable: boolean; gatewayIds: string[] }, { dispatch, getState }) => {
    const { enable, gatewayIds } = params;

    if (enable) {
      // Start live connection

      dispatch(setLiveStatus('connecting'));
      
      const callbacks: LiveCallbacks = {
        onData: (data: LiveDataMessage) => {

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

        },
        onError: (error: any) => {

          dispatch(setLiveError(error.message || 'Connection error'));
        },
        onConnectionChange: (status) => {

          dispatch(setLiveStatus(status));
        }
      };

      try {

        const unsubscribe = await startLive(gatewayIds, callbacks);

        // Return the result but don't store unsubscribe in Redux
        return { enabled: true };
      } catch (error: any) {

        dispatch(setLiveError(error.message || 'Failed to start live mode'));
        throw error;
      }
    } else {
      // Stop live connection

      stopLive();
      // Mark all sensors as offline when live mode is disabled
      dispatch(markSensorsOffline());

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
  isLiveMode: false, // Default to offline mode for better initial user experience
  liveStatus: 'disconnected',
  maxLiveReadings: 100, // Default matches first LIVE_READINGS_OPTIONS value
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

      state.isLiveMode = action.payload;
      if (!action.payload) {

        // Clear live flags when exiting live mode
        Object.values(state.data).forEach(sensor => {
          sensor.isLive = false;
        });
        state.liveStatus = 'disconnected';
      }
    },

    setLiveStatus: (state, action: PayloadAction<'connecting' | 'connected' | 'disconnected' | 'error'>) => {

      state.liveStatus = action.payload;
    },

    setLiveError: (state, action: PayloadAction<string>) => {

      state.error = action.payload;
      state.liveStatus = 'error';
    },

    clearUnknownSensor: (state, action: PayloadAction<string>) => {
      const mac = action.payload;
      state.unknownSensors = state.unknownSensors.filter(unknownMac => unknownMac !== mac);
      
      // Clean up cache entries for this MAC
      unknownSensorListCache.delete(mac);
      unknownSensorCache.delete(mac);

    },

    addLiveData: (state, action: PayloadAction<LiveDataMessage>) => {
      const { sensors } = action.payload;
      const now = Date.now();

      // Reduced logging frequency to prevent memory issues
      // TODO: AV
      // if (sensors.length > 0 && Math.random() < 0.05) { // Log only 5% of the time
      //   // }

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
            // //   unknownSensorCache.set(`log_${mac}`, now);
          // }
          
          return; // "return" here exits the forEach loop for this iteration.
        }
        // --- END REVISED LOGIC ---

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

    },

    clearLiveData: (state) => {

      let clearedCount = 0;
      Object.values(state.data).forEach(sensor => {
        if (sensor.isLive) {
          sensor.series = [];
          sensor.isLive = false;
          clearedCount++;
        }
      });

    },

    updateMaxLiveReadings: (state, action: PayloadAction<number>) => {

      const newMaxReadings = action.payload;
      state.maxLiveReadings = newMaxReadings;

      // Trim existing data if needed
      let trimmedSensors = 0;
      Object.values(state.data).forEach(sensor => {
        if (sensor.series.length > newMaxReadings) {
          const beforeLength = sensor.series.length;
          sensor.series = sensor.series.slice(-newMaxReadings);

          trimmedSensors++;
        }
      });

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

        state.loading = true;
        state.error = null;
      })
      .addCase(toggleLiveMode.fulfilled, (state, action) => {

        state.loading = false;
        state.isLiveMode = action.payload.enabled;
        if (!action.payload.enabled) {

          // Clear live flags when stopping live mode
          Object.values(state.data).forEach(sensor => {
            sensor.isLive = false;
          });
          state.liveStatus = 'disconnected';
        }
      })
      .addCase(toggleLiveMode.rejected, (state, action) => {

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
