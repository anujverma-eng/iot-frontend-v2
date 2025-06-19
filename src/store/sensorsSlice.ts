import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { FilterState, Sensor } from "../types/sensor";
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
    const response = await SensorService.getSensors({ page, limit, claimed, search, sort, dir });
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
export const toggleSensorStar = createAsyncThunk("sensors/toggleStar", async (mac: string) => {
  const res = await SensorService.toggleSensorStar(mac);
  return { mac, success: res.success };
});

export const updateSensorDisplayName = createAsyncThunk(
  "sensors/updateDisplayName",
  async ({ mac, displayName }: { mac: string; displayName: string }) => {
    const res = await SensorService.updateSensorDisplayName(mac, displayName);
    return { mac, displayName, success: res.success };
  }
);

export const fetchSensorById = createAsyncThunk("sensors/fetchSensorById", async (id: string) => {
  const response = await SensorService.getSensorById(id);
  return response;
});

/* ─────────────────  state  ─────────────────── */
interface State {
  loading: boolean;
  loaded: boolean;
  error: string | null;
  data: Sensor[];
  stats: {
    claimed: number;
    unclaimed: number;
    liveSensors: number;
    offlineSensors: number;
  } | null;
  selectedSensorIds: string[];
  filters: FilterState;
  pagination: {
    page: number;
    totalPages: number;
    limit: number;
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
  selectedSensor: {
    loading: boolean;
    error: string | null;
    data: Sensor | null;
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
    limit: 50, // default limit
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
  selectedSensorIds: [],
  filters: {
    search: "",
    types: [],
    status: "all",
    timeRange: {
      // default “last 24 h”
      start: new Date(Date.now() - 86400_000),
      end: new Date(),
    },
  },
  selectedSensor: {
    loading: false,
    error: null,
    data: null,
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
    /* 🔸 filters / selection (pure client-side) */
    setFilters: (s, a: PayloadAction<Partial<FilterState>>) => {
      s.filters = { ...s.filters, ...a.payload };
    },
    setSelectedSensorIds: (s, a: PayloadAction<string[]>) => {
      s.selectedSensorIds = a.payload;
    },
    addSelectedSensorId: (s, a: PayloadAction<string>) => {
      if (!s.selectedSensorIds.includes(a.payload)) s.selectedSensorIds.push(a.payload);
    },
    removeSelectedSensorId: (s, a: PayloadAction<string>) => {
      s.selectedSensorIds = s.selectedSensorIds.filter((id) => id !== a.payload);
    },
    clearSelectedSensorIds: (s) => {
      s.selectedSensorIds = [];
    },
    setLimit: (state, action: PayloadAction<number>) => {
      state.pagination.limit = action.payload;
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
      let sensors: Sensor[] = [];
      if (
        typeof a.payload === "object" &&
        a.payload !== null &&
        "data" in a.payload &&
        "pagination" in a.payload &&
        typeof (a.payload as any).pagination === "object" &&
        (a.payload as any).pagination !== null &&
        "totalPages" in (a.payload as any).pagination
      ) {
        sensors = (a.payload as { data: Sensor[]; pagination: { totalPages: number } }).data;
        s.pagination.totalPages = (a.payload as { data: Sensor[]; pagination: { totalPages: number } }).pagination.totalPages;
      } else {
        sensors = Array.isArray(a.payload) ? (a.payload as Sensor[]) : [];
        s.pagination.totalPages = 1;
      }
      // Ensure favorite is always boolean
      s.data = sensors.map((sensor) => ({
        ...sensor,
        favorite: typeof sensor.favorite === "boolean" ? sensor.favorite : false,
      }));
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

    /* fetch sensor by id ------------------------------------- */
    builder.addCase(fetchSensorById.pending, (state) => {
      state.selectedSensor.loading = true;
      state.selectedSensor.error = null;
    });
    builder.addCase(fetchSensorById.rejected, (state, action) => {
      state.selectedSensor.loading = false;
      state.selectedSensor.error = action.error.message ?? "Error fetching sensor";
    });
    builder.addCase(fetchSensorById.fulfilled, (state, action) => {
      state.selectedSensor.loading = false;
      state.selectedSensor.data = action.payload;
    });

    /* toggle star ------------------------------------- */
    builder.addCase(toggleSensorStar.fulfilled, (s, a) => {
      if (!a.payload.success) return;
      const idx = s.data.findIndex((se) => se.mac === a.payload.mac);
      if (idx !== -1) {
        s.data[idx].favorite = !s.data[idx].favorite;
      }
      if (s.detail.sensor?.mac === a.payload.mac) {
        s.detail.sensor.favorite = !s.detail.sensor.favorite;
      }
    });

    /* display name update --------------------------------- */
    builder.addCase(updateSensorDisplayName.fulfilled, (s, a) => {
      if (!a.payload.success) return;
      const idx = s.data.findIndex((se) => se.mac === a.payload.mac);
      if (idx !== -1) {
        s.data[idx].displayName = a.payload.displayName;
      }
      if (s.detail.sensor?.mac === a.payload.mac) {
        s.detail.sensor.displayName = a.payload.displayName;
      }
    });
  },
});

export const { clear, setPage, clearDetail, setClaimModalOpen } = sensorSlice.actions;

export const {
  setFilters,
  setSelectedSensorIds,
  addSelectedSensorId,
  removeSelectedSensorId,
  clearSelectedSensorIds,
  setLimit,
} = sensorSlice.actions;

/* ─────────────────  selectors  ─────────────────── */
export const selectSensors = (state: RootState) => state.sensors.data;
export const selectSensorStats = (state: RootState) => state.sensors.stats;
export const selectSensorPagination = (state: RootState) => state.sensors.pagination;
export const selectSensorDetail = (state: RootState) => state.sensors.detail.sensor;
export const selectSensorDetailLoading = (state: RootState) => state.sensors.detail.loading;
export const selectSensorDetailError = (state: RootState) => state.sensors.detail.error;
export const selectClaimModalState = (state: RootState) => state.sensors.claimModal;
export const selectFilters = (state: RootState) => state.sensors.filters;
export const selectSelectedSensorIds = (state: RootState) => state.sensors.selectedSensorIds;
export const selectSensorsLoading = (state: RootState) => state.sensors.loading;
export const selectSensorsError = (state: RootState) => state.sensors.error;
export const selectPagination = (state: RootState) => state.sensors.pagination;
export const selectSelectedSensor = (state: RootState) => state.sensors.selectedSensor;

export default sensorSlice.reducer;
