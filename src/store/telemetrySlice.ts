import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { RootState } from ".";
import { chooseBucketSize } from "../utils/bucketSize";
import TelemetryService from "../api/telemetry.service";
import { TelemetryQueryParams, SensorTelemetryResponse } from "../types/telemetry";

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
}

/* ──────────────────────────────────────────────────────────── */
/*  thunk                                                      */
/* ──────────────────────────────────────────────────────────── */
export const fetchTelemetry = createAsyncThunk<
  /* return type  */ Record<string, SensorData>,
  /* arg type     */ TelemetryQueryParams,
  /* thunk API    */ { rejectValue: string }
>("telemetry/fetchTelemetry", async (params, { rejectWithValue }) => {
  try {
    console.log("API Request to fetch telemetry:", {
      sensorIds: params.sensorIds,
      timeRange: params.timeRange,
    });

    const bucketSize = chooseBucketSize(params.timeRange.start, params.timeRange.end);
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
      };
    });

    return mapped;
  } catch (err: any) {
    const msg = err?.response?.data?.error ?? err.message ?? "Failed to fetch telemetry data";
    return rejectWithValue(msg);
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
            };
          });

          state.lastUpdated = new Date().toISOString();
          return;
        }

        // Standard data update logic for non-empty responses
        Object.entries(action.payload).forEach(([sensorId, data]) => {
          state.data[sensorId] = data;
        });

        state.lastUpdated = new Date().toISOString();
      });
  },
});

export const selectTimeRange = (st: RootState) => st.telemetry.timeRange;
export const { clear: clearTelemetry, setTimeRange } = telemetrySlice.actions;

/* ──────────────────────────────────────────────────────────── */
/*  selectors (unchanged for callers)                          */
/* ──────────────────────────────────────────────────────────── */
export const selectTelemetryLoading = (st: RootState) => st.telemetry.loading;
export const selectTelemetryError = (st: RootState) => st.telemetry.error;
export const selectTelemetryData = (st: RootState) => st.telemetry.data;
export const selectSensorTelemetry = (st: RootState, id: string) => st.telemetry.data[id];

export default telemetrySlice.reducer;
