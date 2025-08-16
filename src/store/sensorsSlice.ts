import { createSlice, createAsyncThunk, PayloadAction, createSelector } from "@reduxjs/toolkit";
import { FilterState, Sensor } from "../types/sensor";
import { RootState } from ".";
import SensorService from "../api/sensor.service";
import { isLowBattery } from "../utils/battery"; // Import battery utility

// Rate limiting cache for sensor fetches (30 seconds cooldown)
const sensorFetchCache = new Map<string, number>();
const FETCH_COOLDOWN_MS = 30000; // 30 seconds

// Global promise cache to prevent duplicate concurrent requests
const ongoingRequests = new Map<string, Promise<any>>();

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

export const fetchSensorDetails = createAsyncThunk(
  "sensors/fetchDetails", 
  async (mac: string, { rejectWithValue }) => {
    // Check if there's already an ongoing request for this MAC
    if (ongoingRequests.has(mac)) {
      console.log(`[SensorsSlice] Reusing ongoing request for sensor: ${mac}`);
      try {
        return await ongoingRequests.get(mac);
      } catch (error) {
        // If the ongoing request fails, we'll fall through to make a new one
        ongoingRequests.delete(mac);
      }
    }

    // Rate limiting check
    const now = Date.now();
    const lastFetch = sensorFetchCache.get(mac);
    
    if (lastFetch && (now - lastFetch) < FETCH_COOLDOWN_MS) {
      const timeSinceLastFetch = Math.round((now - lastFetch) / 1000);
      console.log(`[SensorsSlice] Rate limiting: Skipping fetch for ${mac} (last fetch was ${timeSinceLastFetch}s ago)`);
      return rejectWithValue(`Rate limited: Recently fetched sensor ${mac} (${timeSinceLastFetch}s ago)`);
    }
    
    // Create and cache the request promise
    const requestPromise = (async () => {
      try {
        console.log(`[SensorsSlice] Fetching sensor details for MAC: ${mac}`);
        sensorFetchCache.set(mac, now);
        const response = await SensorService.getSensorByMac(mac);
        return response;
      } catch (error) {
        // Remove from cache on error so we can retry later
        sensorFetchCache.delete(mac);
        throw error;
      } finally {
        // Always clean up the ongoing request
        ongoingRequests.delete(mac);
      }
    })();

    // Cache the promise to prevent duplicate concurrent requests
    ongoingRequests.set(mac, requestPromise);
    
    return await requestPromise;
  }
);

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
    lowBatterySensors: number; // Add low battery sensors count
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
  currentSensorDataLoading: boolean; // Track if current sensor data is loading
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
  currentSensorDataLoading: false, // Initialize current sensor data loading state
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
    setCurrentSensorDataLoading: (s, a: PayloadAction<boolean>) => {
      s.currentSensorDataLoading = a.payload;
    },
    setLimit: (state, action: PayloadAction<number>) => {
      state.pagination.limit = action.payload;
    },
    // Update lastSeen for a sensor when live data is received
    updateSensorLastSeen: (state, action: PayloadAction<{ mac: string; lastSeen: string; battery?: number }>) => {
      const { mac, lastSeen, battery } = action.payload;
      
      // Update in main sensors list - use more direct mutation to avoid reference changes
      const sensorIndex = state.data.findIndex((sensor: Sensor) => sensor.mac === mac);
      if (sensorIndex !== -1) {
        // Only update if the values are actually different to avoid unnecessary updates
        const sensor = state.data[sensorIndex];
        const newStatus = "live";
        
        if (sensor.lastSeen !== lastSeen || sensor.status !== newStatus || sensor.battery !== battery) {
          sensor.lastSeen = lastSeen;
          sensor.status = newStatus;
          if (battery !== undefined) {
            sensor.battery = battery;
          }
          console.log('[SensorsSlice] Updated lastSeen for sensor', mac, 'to', lastSeen, 'battery:', battery);
        }
      }
      
      // Update in selected sensor if it matches - only update if different
      if (state.selectedSensor.data && state.selectedSensor.data.mac === mac) {
        const selectedSensor = state.selectedSensor.data;
        const newStatus = "live";
        
        if (selectedSensor.lastSeen !== lastSeen || selectedSensor.status !== newStatus || selectedSensor.battery !== battery) {
          selectedSensor.lastSeen = lastSeen;
          selectedSensor.status = newStatus;
          if (battery !== undefined) {
            selectedSensor.battery = battery;
          }
        }
      }
    },
    // Mark all sensors as offline when live mode is disabled
    markSensorsOffline: (state) => {
      // Update status for all sensors in main list
      state.data.forEach((sensor: Sensor) => {
        if (sensor.status === "live") {
          sensor.status = "offline";
        }
      });
      
      // Update selected sensor if it's currently live
      if (state.selectedSensor.data && state.selectedSensor.data.status === "live") {
        state.selectedSensor.data.status = "offline";
      }
      
      console.log('[SensorsSlice] Marked all sensors as offline');
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
  setCurrentSensorDataLoading,
  setLimit,
  updateSensorLastSeen,
  markSensorsOffline,
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

// Stable selector that only changes when the sensor ID changes, not metadata
export const selectSelectedSensorId = (state: RootState) => state.sensors.selectedSensor.data?._id;

// Stable selector for checking if a sensor is loaded  
export const selectIsSensorLoaded = (sensorId: string) => (state: RootState) => {
  return state.sensors.selectedSensor.data?._id === sensorId;
};
export const selectCurrentSensorDataLoading = (state: RootState) => state.sensors.currentSensorDataLoading;

// Enhanced selector for stats with computed low battery count
export const selectEnhancedSensorStats = createSelector(
  [selectSensorStats, selectSensors],
  (stats, sensors) => {
    if (!stats) return null;
    
    // Calculate low battery sensors count from sensor data
    const lowBatterySensors = sensors.filter(sensor => isLowBattery(sensor.battery)).length;
    
    return {
      ...stats,
      lowBatterySensors
    };
  }
);

// Selector for low battery sensors
export const selectLowBatterySensors = createSelector(
  [selectSensors],
  (sensors) => sensors.filter(sensor => isLowBattery(sensor.battery))
);

export default sensorSlice.reducer;
