import { createSlice, createAsyncThunk, PayloadAction, createSelector } from "@reduxjs/toolkit";
import { RootState } from ".";
import { chooseBucketSize } from "../utils/bucketSize";
import TelemetryService, { PaginatedTelemetryResponse } from "../api/telemetry.service";
import { TelemetryQueryParams, SensorTelemetryResponse } from "../types/telemetry";
import { startLive, stopLive, LiveDataMessage, LiveCallbacks, getConnectionStatus } from '../lib/liveMqtt';
import { updateSensorLastSeen, markSensorsOffline, fetchSensorDetails } from './sensorsSlice';
import { 
  analyzeTelemetryRequest, 
  handleTelemetryApiError, 
  showApiErrorToast, 
  calculateRetryDelay,
  createSafeRequestParams 
} from '../utils/apiErrorHandler';

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
  /* arg type     */ TelemetryQueryParams & { attemptNumber?: number },
  /* thunk API    */ { rejectValue: { message: string; canRetry: boolean; fallbackOptions: any[] } }
>("telemetry/fetchTelemetry", async (params, { rejectWithValue }) => {
  const attemptNumber = params.attemptNumber || 1;
  
  try {
    // Analyze request for potential issues
    const requestMetrics = analyzeTelemetryRequest({
      timeRange: params.timeRange,
      sensorIds: params.sensorIds
    });
    
    // Create safe parameters if needed
    const safeParams = requestMetrics.riskLevel === 'critical' ? 
      createSafeRequestParams(params) : params;

    // Detect if mobile for optimized bucket sizing
    const isMobile = window.innerWidth < 768;
    const bucketSize = chooseBucketSize(safeParams.timeRange.start, safeParams.timeRange.end, 400, isMobile);
    
    const response = await TelemetryService.query({ ...safeParams, bucketSize });

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
    console.error(`❌ Telemetry API Error (Attempt #${attemptNumber}):`, err);
    
    // Create error context for smart recovery
    const errorContext = {
      endpoint: 'fetchTelemetry',
      requestSize: analyzeTelemetryRequest({
        timeRange: params.timeRange,
        sensorIds: params.sensorIds
      }).requestSize,
      statusCode: err?.response?.status,
      timeRange: params.timeRange,
      sensorIds: params.sensorIds,
      attemptNumber,
      originalError: err
    };
    
    // Get smart recovery suggestions
    const recovery = handleTelemetryApiError(err, errorContext);
    
    // Show user-friendly error toast
    showApiErrorToast(recovery);
    
    // Return structured error for the UI to handle
    return rejectWithValue({
      message: recovery.userMessage,
      canRetry: recovery.canRetry,
      fallbackOptions: recovery.fallbackOptions
    });
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

// New optimized telemetry thunk for charts
export const fetchOptimizedTelemetry = createAsyncThunk<
  Record<string, SensorData>,
  {
    sensorIds: string[];
    timeRange: { start: string; end: string };
    targetPoints: number;
    deviceType?: 'mobile' | 'desktop';
    liveMode?: { enabled: boolean; maxReadings: number };
  }
>('telemetry/fetchOptimizedTelemetry', async (params, { rejectWithValue, getState }) => {
  try {
    const state = getState() as RootState;
    const isLiveMode = state.telemetry.isLiveMode;
    const maxLiveReadings = state.telemetry.maxLiveReadings;

    // Auto-detect device type if not provided
    const deviceType = params.deviceType || (window.innerWidth < 768 ? 'mobile' : 'desktop');

    const response = await TelemetryService.getOptimized({
      sensorIds: params.sensorIds,
      timeRange: params.timeRange,
      targetPoints: params.targetPoints,
      deviceType,
      // Always cap maxReadings at 100 (backend limit) - whether provided or fallback
      liveMode: params.liveMode 
        ? { enabled: params.liveMode.enabled, maxReadings: Math.min(params.liveMode.maxReadings, 100) }
        : (isLiveMode ? { enabled: true, maxReadings: Math.min(maxLiveReadings, 100) } : undefined)
    });

    // Map backend payload to UI-friendly structure
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
    console.error('❌ Optimized Telemetry API Error:', err);
    
    return rejectWithValue({
      message: err?.response?.data?.message || 'Failed to fetch optimized telemetry data',
      canRetry: true
    });
  }
});

// New table data thunk for paginated table display
export const fetchTableData = createAsyncThunk<
  any, // Will be used by table components directly, not stored in Redux
  {
    sensorIds: string[];
    timeRange: { start: string; end: string };
    pagination: { page: number; limit: number };
    sortBy?: 'timestamp' | 'value';
    sortOrder?: 'asc' | 'desc';
    search?: string;
  }
>('telemetry/fetchTableData', async (params, { rejectWithValue }) => {
  try {
    const response = await TelemetryService.getTableData(params);
    return response;
  } catch (err: any) {
    console.error('❌ Table Data API Error:', err);
    
    return rejectWithValue({
      message: err?.response?.data?.message || 'Failed to fetch table data',
      canRetry: true
    });
  }
});

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
  
  // UI state
  isCompareMode: boolean; // Track if user is in sensor comparison mode
  
  // Table data specific state
  tableData: Record<string, PaginatedTelemetryResponse>;
  tableLoading: boolean;
  tableError: string | null;
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
  isCompareMode: false, // Default to single sensor mode
  
  // Table data initial state
  tableData: {},
  tableLoading: false,
  tableError: null,
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

    setCompareMode: (state, action: PayloadAction<boolean>) => {
      state.isCompareMode = action.payload;
      // When entering compare mode, disable live mode for data consistency
      if (action.payload && state.isLiveMode) {
        state.isLiveMode = false;
        state.liveStatus = 'disconnected';
        // Clear live flags from all sensors
        Object.values(state.data).forEach(sensor => {
          sensor.isLive = false;
        });
      }
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
        // Handle both string and structured error payloads
        if (typeof a.payload === 'string') {
          s.error = a.payload;
        } else if (a.payload?.message) {
          s.error = a.payload.message;
        } else {
          s.error = a.error?.message ?? "Error";
        }
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
      })
      // New optimized telemetry thunk handlers
      .addCase(fetchOptimizedTelemetry.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOptimizedTelemetry.fulfilled, (state, action) => {
        state.loading = false;
        
        console.log('[DEBUG] fetchOptimizedTelemetry.fulfilled:', {
          requestedSensorIds: action.meta.arg.sensorIds,
          responsePayload: action.payload,
          payloadKeys: action.payload ? Object.keys(action.payload) : [],
          payloadEntries: action.payload ? Object.entries(action.payload).map(([key, value]) => ({
            sensorId: key,
            hasData: !!value,
            seriesLength: value?.series?.length || 0
          })) : []
        });
        
        // Handle empty response
        if (!action.payload || Object.keys(action.payload).length === 0) {
          const requestedSensorIds = action.meta.arg.sensorIds || [];
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
              series: [],
              isLive: false,
              lastUpdated: Date.now()
            } as SensorData;
          });
          state.lastUpdated = new Date().toISOString();
          return;
        }

        // Update data with optimized results
        Object.entries(action.payload).forEach(([sensorId, data]) => {
          state.data[sensorId] = data as SensorData;
        });
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchOptimizedTelemetry.rejected, (state, action) => {
        state.loading = false;
        if (typeof action.payload === 'string') {
          state.error = action.payload;
        } else if (action.payload && typeof action.payload === 'object' && 'message' in action.payload) {
          state.error = (action.payload as any).message;
        } else {
          state.error = action.error?.message ?? "Failed to fetch optimized data";
        }
      })
      // Table data thunk handlers
      .addCase(fetchTableData.pending, (state) => {
        state.tableLoading = true;
        state.tableError = null;
      })
      .addCase(fetchTableData.fulfilled, (state, action) => {
        state.tableLoading = false;
        state.tableError = null;
        // Store the table data by sensor ID (using first sensor ID as key)
        const sensorId = action.meta.arg.sensorIds[0];
        if (sensorId && action.payload) {
          state.tableData[sensorId] = action.payload;
        }
      })
      .addCase(fetchTableData.rejected, (state, action) => {
        state.tableLoading = false;
        if (typeof action.payload === 'string') {
          state.tableError = action.payload;
        } else if (action.payload && typeof action.payload === 'object' && 'message' in action.payload) {
          state.tableError = (action.payload as any).message;
        } else {
          state.tableError = action.error?.message ?? "Failed to fetch table data";
        }
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
  setCompareMode,
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

// Compare mode selector
export const selectIsCompareMode = (st: RootState) => st.telemetry.isCompareMode;

// Memoized selector for live sensors to prevent unnecessary re-renders
export const selectLiveSensors = createSelector(
  [(st: RootState) => st.telemetry.data],
  (data) => Object.values(data).filter(sensor => sensor.isLive)
);

export const selectMaxLiveReadings = (st: RootState) => st.telemetry.maxLiveReadings;

// Table data selectors
export const selectTableData = (st: RootState) => st.telemetry.tableData;
export const selectTableLoading = (st: RootState) => st.telemetry.tableLoading;
export const selectTableError = (st: RootState) => st.telemetry.tableError;
export const selectSensorTableData = (st: RootState, sensorId: string) => st.telemetry.tableData[sensorId];

export default telemetrySlice.reducer;
