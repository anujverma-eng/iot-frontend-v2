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
    const bucketSize = chooseBucketSize(params.timeRange.start, params.timeRange.end);
    const res = await TelemetryService.query({ ...params, bucketSize });

    /* map backend payload → UI-friendly structure */
    const mapped: Record<string, SensorData> = {};
    res.forEach((s) => {
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
}
const initialState: State = {
  loading: false,
  error: null,
  data: {},
  timeRange: {
    start: new Date(Date.now() - 24 * 60 * 60 * 1_000),
    end: new Date(),
  },
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
      .addCase(fetchTelemetry.fulfilled, (s, a) => {
        s.loading = false;

        Object.entries(a.payload).forEach(([sensorId, incoming]) => {
          const current = s.data[sensorId];
          /* only update if the newest sample changed */
          const nextStamp = incoming.series[0]?.timestamp;
          const currentStamp = current?.series[0]?.timestamp;

          if (!current || nextStamp !== currentStamp) {
            s.data[sensorId] = incoming;
          }
        });
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
