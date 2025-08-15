import { createSlice, createAsyncThunk, PayloadAction, createSelector } from "@reduxjs/toolkit";
import { RootState } from ".";
import { chooseBucketSize } from "../utils/bucketSize";
import TelemetryService from "../api/telemetry.service";
import { TelemetryQueryParams, SensorTelemetryResponse } from "../types/telemetry";
import { startLive, stopLive, LiveDataMessage, LiveCallbacks, getConnectionStatus } from '../lib/liveMqtt';

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
      console.log('[TelemetrySlice] stopLive completed');
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
  maxLiveReadings: 1000,
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

    addLiveData: (state, action: PayloadAction<LiveDataMessage>) => {
      const { sensors } = action.payload;
      const now = Date.now();

      console.log('[TelemetrySlice] addLiveData called with', sensors.length, 'sensors');
      console.log('[TelemetrySlice] Live data sensors:', JSON.stringify(sensors, null, 2));
      console.log('[TelemetrySlice] Current state.data keys:', Object.keys(state.data));

      sensors.forEach(reading => {
        const { mac, name, type, unit, value, timestamp } = reading;
        
        console.log('[TelemetrySlice] Processing sensor reading:', { mac, name, type, unit, value, timestamp });
        
        // Find existing sensor by MAC - check both as key and as mac property
        let existingSensorKey = Object.keys(state.data).find(key => 
          state.data[key].mac === mac || key === mac
        );
        
        console.log('[TelemetrySlice] Found existing sensor key:', existingSensorKey);
        
        // If no existing sensor found, try to match by MAC directly as key
        if (!existingSensorKey) {
          console.log('[TelemetrySlice] No existing sensor found, will create new entry');
          // Use the MAC address as the key for consistency
          existingSensorKey = mac;
        }
        
        const sensorKey = existingSensorKey;
        console.log('[TelemetrySlice] Final sensor key:', sensorKey);
        
        if (!state.data[sensorKey]) {
          console.log('[TelemetrySlice] Creating new sensor entry for:', sensorKey);
          // Initialize new sensor
          state.data[sensorKey] = {
            id: mac, // Use MAC as ID for consistency
            mac,
            type: type as any,
            unit,
            series: [],
            min: Number(value),
            max: Number(value),
            avg: Number(value),
            current: Number(value),
            isLive: true,
            lastUpdated: now
          };
        }

        const sensor = state.data[sensorKey];
        console.log('[TelemetrySlice] Current sensor data points before adding:', sensor.series.length);
        
        // Add new data point
        const dataPoint: DataPoint = {
          timestamp: timestamp || now,
          value: Number(value)
        };

        sensor.series.push(dataPoint);
        sensor.lastUpdated = now;
        sensor.isLive = true;
        sensor.current = Number(value);

        console.log('[TelemetrySlice] Added data point:', dataPoint);
        console.log('[TelemetrySlice] Current sensor data points after adding:', sensor.series.length);

        // Maintain max readings limit
        if (sensor.series.length > state.maxLiveReadings) {
          const removedCount = sensor.series.length - state.maxLiveReadings;
          sensor.series = sensor.series.slice(-state.maxLiveReadings);
          console.log('[TelemetrySlice] Trimmed', removedCount, 'old data points, now have:', sensor.series.length);
        }

        // Sort by timestamp to maintain order
        sensor.series.sort((a, b) => a.timestamp - b.timestamp);

        // Update aggregates for live data
        if (sensor.series.length > 0) {
          const values = sensor.series.map(p => p.value);
          sensor.min = Math.min(...values);
          sensor.max = Math.max(...values);
          sensor.avg = values.reduce((a, b) => a + b, 0) / values.length;
          console.log('[TelemetrySlice] Updated aggregates - min:', sensor.min, 'max:', sensor.max, 'avg:', sensor.avg);
        }
      });
      
      console.log('[TelemetrySlice] Final state.data keys after processing:', Object.keys(state.data));
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
      state.maxLiveReadings = action.payload;
      
      // Trim existing data if needed
      Object.values(state.data).forEach(sensor => {
        if (sensor.series.length > action.payload) {
          sensor.series = sensor.series.slice(-action.payload);
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
  updateMaxLiveReadings
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
