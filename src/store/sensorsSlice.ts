import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { Sensor } from "../types/sensor";
import { RootState } from ".";
import SensorService from "../api/sensor.service";

/* ─────────────────  thunks  ───────────────── */
export const fetchSensors = createAsyncThunk(
  "sensors/fetch",
  async ({
    page,
    limit,
    claimed,
    search,
    sort,
    dir,
  }: {
    page: number;
    limit: number;
    claimed: boolean;
    search: string;
    sort?: string;
    dir?: "asc" | "desc";
  }) => {
    const response = await SensorService.getSensors({page, limit, claimed, search, sort, dir});
    return response;
  }
);

export const fetchSensorStats = createAsyncThunk("sensors/fetchStats", async () => {
  const response = await SensorService.getSensorStats();
  return response;
});

export const fetchSensorDetails = createAsyncThunk("sensors/fetchDetails", async (mac: string) => {
  const response = await SensorService.getSensorByMac(mac);
  return response;
});

export const updateSensorLabel = createAsyncThunk(
  "sensors/updateLabel",
  async ({ mac, displayName }: { mac: string; displayName: string }) => {
    const response = await SensorService.updateSensor(mac, { displayName });
    return { mac, displayName };
  }
);

export const unclaimSensor = createAsyncThunk("sensors/unclaim", async (mac: string) => {
  const response = await SensorService.unclaimSensor(mac);
  return mac;
});

export const claimSensor = createAsyncThunk(
  "sensors/claim",
  async ({ mac, displayName }: { mac: string; displayName?: string }) => {
    const response = await SensorService.claimSensor(mac, displayName);
    return { mac, displayName, success: response.success, error: response.error };
  }
);

/* ─────────────────  state  ─────────────────── */
interface State {
  loading: boolean;
  loaded: boolean;
  error: string | null;
  data: Sensor[];
  stats: {
    claimed: number;
    unclaimed: number;
    avgReadingFrequency: number;
  } | null;
  pagination: {
    page: number;
    totalPages: number;
  };
  // Detail state
  detail: {
    loading: boolean;
    sensor: Sensor | null;
    error: string | null;
  };
  // Claim modal state
  claimModal: {
    isOpen: boolean;
    loading: boolean;
    error: string | null;
  };
}

const initial: State = {
  loading: false,
  loaded: false,
  error: null,
  data: [],
  stats: null,
  pagination: {
    page: 1,
    totalPages: 1,
  },
  detail: {
    loading: false,
    sensor: null,
    error: null,
  },
  claimModal: {
    isOpen: false,
    loading: false,
    error: null,
  },
};

/* ─────────────────  slice  ─────────────────── */
const sensorSlice = createSlice({
  name: "sensors",
  initialState: initial,
  reducers: {
    clear: () => initial,
    setPage: (state, action: PayloadAction<number>) => {
      state.pagination.page = action.payload;
    },
    // Detail actions
    clearDetail: (state) => {
      state.detail = initial.detail;
    },
    // Claim modal actions
    setClaimModalOpen: (state, action: PayloadAction<boolean>) => {
      state.claimModal.isOpen = action.payload;
      if (!action.payload) {
        state.claimModal.error = null;
      }
    },
  },
  extraReducers: (builder) => {
    /* fetch sensors ------------------------------------- */
    builder.addCase(fetchSensors.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    builder.addCase(fetchSensors.rejected, (s, a) => {
      s.loading = false;
      s.error = a.error.message ?? "Error";
    });
    builder.addCase(fetchSensors.fulfilled, (s, a) => {
      s.loading = false;
      s.loaded = true;
      s.data = a.payload.data;
      s.pagination.totalPages = a.payload.pagination.totalPages;
    });

    /* fetch stats ------------------------------------- */
    builder.addCase(fetchSensorStats.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    builder.addCase(fetchSensorStats.rejected, (s, a) => {
      s.loading = false;
      s.error = a.error.message ?? "Error";
    });
    builder.addCase(fetchSensorStats.fulfilled, (s, a) => {
      s.loading = false;
      s.stats = a.payload;
    });

    /* fetch details ------------------------------------- */
    builder.addCase(fetchSensorDetails.pending, (state) => {
      state.detail.loading = true;
      state.detail.error = null;
    });
    builder.addCase(fetchSensorDetails.rejected, (state, action) => {
      state.detail.loading = false;
      state.detail.error = action.error.message ?? "Error";
    });
    builder.addCase(fetchSensorDetails.fulfilled, (state, action) => {
      state.detail.loading = false;
      state.detail.sensor = action.payload;
    });

    /* update label ------------------------------------- */
    builder.addCase(updateSensorLabel.pending, (state) => {
      state.detail.loading = true;
      state.detail.error = null;
    });
    builder.addCase(updateSensorLabel.rejected, (state, action) => {
      state.detail.loading = false;
      state.detail.error = action.error.message ?? "Error";
    });
    builder.addCase(updateSensorLabel.fulfilled, (state, action) => {
      state.detail.loading = false;
      if (state.detail.sensor) {
        state.detail.sensor.displayName = action.payload.displayName;
      }
      // Update in the main list
      const index = state.data.findIndex((s) => s.mac === action.payload.mac);
      if (index !== -1) {
        state.data[index].displayName = action.payload.displayName;
      }
    });

    /* unclaim sensor ------------------------------------- */
    builder.addCase(unclaimSensor.pending, (state) => {
      state.detail.loading = true;
      state.detail.error = null;
    });
    builder.addCase(unclaimSensor.rejected, (state, action) => {
      state.detail.loading = false;
      state.detail.error = action.error.message ?? "Error";
    });
    builder.addCase(unclaimSensor.fulfilled, (state, action) => {
      state.detail.loading = false;
      // Remove from the main list
      state.data = state.data.filter((s) => s.mac !== action.payload);
      // Clear detail if it was the unclaimed sensor
      if (state.detail.sensor?.mac === action.payload) {
        state.detail.sensor = null;
      }
    });

    /* claim sensor ------------------------------------- */
    builder.addCase(claimSensor.pending, (state) => {
      state.claimModal.loading = true;
      state.claimModal.error = null;
    });
    builder.addCase(claimSensor.rejected, (state, action) => {
      state.claimModal.loading = false;
      state.claimModal.error = action.error.message ?? "Error";
    });
    builder.addCase(claimSensor.fulfilled, (state, action) => {
      state.claimModal.loading = false;
      if (action.payload.success) {
        state.claimModal.isOpen = false;
        state.claimModal.error = null;
      } else {
        state.claimModal.error = action.payload.error ?? "Failed to claim sensor";
      }
    });
  },
});

export const { clear, setPage, clearDetail, setClaimModalOpen } = sensorSlice.actions;

/* ─────────────────  selectors  ─────────────────── */
export const selectSensors = (state: RootState) => state.sensors.data;
export const selectSensorStats = (state: RootState) => state.sensors.stats;
export const selectSensorPagination = (state: RootState) => state.sensors.pagination;
export const selectSensorDetail = (state: RootState) => state.sensors.detail.sensor;
export const selectSensorDetailLoading = (state: RootState) => state.sensors.detail.loading;
export const selectSensorDetailError = (state: RootState) => state.sensors.detail.error;
export const selectClaimModalState = (state: RootState) => state.sensors.claimModal;

export default sensorSlice.reducer;
