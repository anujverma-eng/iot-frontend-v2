import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { GatewayService } from '../api/gateway.service';
import { Gateway, GatewayStats } from '../types/gateway';
import { Sensor } from '../types/sensor';
import { RootState } from '.';

/* ─────────────────  thunks  ───────────────── */
export const fetchGateways = createAsyncThunk(
  'gateways/fetch',
  async ({ page, limit, search }: { page: number; limit: number; search: string }) => {
    const { data } = await GatewayService.getGateways(page, limit, search);
    return data;
  }
);

export const fetchGatewayStats = createAsyncThunk(
  'gateways/fetchStats',
  async () => {
    const { data } = await GatewayService.getGatewayStats();
    return data.data;
  }
);

export const createGateway = createAsyncThunk(
  'gateways/create',
  async (mac: string) => {
    const { data } = await GatewayService.create(mac);
    return data;
  }
);

export const fetchGatewayDetails = createAsyncThunk(
  'gateways/fetchDetails',
  async (id: string) => {
    const { data } = await GatewayService.getGatewayById(id);
    return data.data;
  }
);

export const fetchGatewaySensors = createAsyncThunk(
  'gateways/fetchSensors',
  async ({ id, claimed, page, limit, search, sort, dir }: {
    id: string;
    claimed: boolean;
    page: number;
    limit: number;
    search: string;
    sort?: string;
    dir: "asc" | "desc";
  }) => {
    const { data } = await GatewayService.getSensorsByGateway(id, claimed, page, limit, search, sort, dir);
    return data;
  }
);

export const updateGatewayLabel = createAsyncThunk(
  'gateways/updateLabel',
  async ({ id, label, location }: { id: string; label?: string; location?: string }) => {
    const updateData: { label?: string; location?: string } = {};
    if (label !== undefined) updateData.label = label;
    if (location !== undefined) updateData.location = location;
    
    const { data } = await GatewayService.updateGateway(id, updateData);
    return data;
  }
);

export const deleteGateway = createAsyncThunk(
  'gateways/delete',
  async (id: string) => {
    await GatewayService.deleteGateway(id);
    return { id };
  }
);

export const refreshGatewayData = createAsyncThunk(
  'gateways/refreshData',
  async ({ page, limit, search }: { page: number; limit: number; search: string }, { dispatch }) => {
    // Fetch both gateways and stats together
    const [gatewaysResult, statsResult] = await Promise.all([
      dispatch(fetchGateways({ page, limit, search })),
      dispatch(fetchGatewayStats())
    ]);
    return { gateways: gatewaysResult.payload, stats: statsResult.payload };
  }
);

/* ─────────────────  state  ─────────────────── */
interface State {
  loading: boolean;
  loaded: boolean;
  error: string | null;
  data: Gateway[];
  stats: GatewayStats | null;
  deleteLoadingIds: string[];
  pagination: {
    page: number;
    totalPages: number;
  };
  // Detail state
  detail: {
    loading: boolean;
    sensorsLoading: boolean;
    gateway: Gateway | null;
    sensors: Sensor[];
    pagination: {
      page: number;
      totalPages: number;
    };
    showClaimed: boolean;
    searchQuery: string;
    sortColumn: string | null;
    sortDirection: "asc" | "desc";
  };
}

const initial: State = {
  loading: false,
  loaded: false,
  error: null,
  data: [],
  stats: null,
  deleteLoadingIds: [],
  pagination: {
    page: 1,
    totalPages: 1
  },
  detail: {
    loading: false,
    sensorsLoading: false,
    gateway: null,
    sensors: [],
    pagination: {
      page: 1,
      totalPages: 1
    },
    showClaimed: false,
    searchQuery: "",
    sortColumn: null,
    sortDirection: "asc"
  }
};

/* ─────────────────  slice  ─────────────────── */
const gatewaySlice = createSlice({
  name: 'gateways',
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
    setDetailShowClaimed: (state, action: PayloadAction<boolean>) => {
      state.detail.showClaimed = action.payload;
      state.detail.pagination.page = 1;
      state.detail.sensors = [];
      state.detail.sensorsLoading = true;
    },
    setDetailPage: (state, action: PayloadAction<number>) => {
      state.detail.pagination.page = action.payload;
    },
    setDetailSearchQuery: (state, action: PayloadAction<string>) => {
      state.detail.searchQuery = action.payload;
      state.detail.pagination.page = 1;
    },
    setDetailSort: (state, action: PayloadAction<{ column: string | null; direction: "asc" | "desc" }>) => {
      state.detail.sortColumn = action.payload.column;
      state.detail.sortDirection = action.payload.direction;
      state.detail.pagination.page = 1;
    },
    // Update gateway presence from WebSocket
    updateGatewayPresence: (state, action: PayloadAction<{ gatewayId: string; isConnected: boolean }>) => {
      const { gatewayId, isConnected } = action.payload;
      const gateway = state.data.find(g => g._id === gatewayId);
      if (gateway) {
        gateway.isConnected = isConnected;
      }
      // Also update detail gateway if it matches
      if (state.detail.gateway && state.detail.gateway._id === gatewayId) {
        state.detail.gateway.isConnected = isConnected;
      }
    }
  },
  extraReducers: builder => {
    /* fetch gateways ------------------------------------- */
    builder.addCase(fetchGateways.pending, s => { s.loading = true; s.error = null; });
    builder.addCase(fetchGateways.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? 'Error'; });
    builder.addCase(fetchGateways.fulfilled, (s, a) => {
      s.loading = false;
      s.loaded = true;
      s.data = a.payload.data;
      s.pagination.totalPages = a.payload.pagination.totalPages;
    });

    /* fetch stats ------------------------------------- */
    builder.addCase(fetchGatewayStats.pending, s => { s.loading = true; s.error = null; });
    builder.addCase(fetchGatewayStats.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? 'Error'; });
    builder.addCase(fetchGatewayStats.fulfilled, (s, a) => {
      s.loading = false;
      s.stats = a.payload;
    });

    /* create gateway ------------------------------------- */
    builder.addCase(createGateway.pending, s => { s.loading = true; s.error = null; });
    builder.addCase(createGateway.rejected, (s, a) => { s.loading = false; s.error = a.error.message ?? 'Error'; });
    builder.addCase(createGateway.fulfilled, (s, a) => {
      s.loading = false;
      s.data.push(a.payload);
    });

    /* fetch details ------------------------------------- */
    builder.addCase(fetchGatewayDetails.pending, (state) => {
      state.detail.loading = true;
      state.error = null;
    });
    builder.addCase(fetchGatewayDetails.rejected, (state, action) => {
      state.detail.loading = false;
      state.error = action.error.message ?? 'Error';
    });
    builder.addCase(fetchGatewayDetails.fulfilled, (state, action) => {
      state.detail.loading = false;
      state.detail.gateway = action.payload;
    });

    /* fetch sensors ------------------------------------- */
    builder.addCase(fetchGatewaySensors.pending, (state) => {
      state.detail.sensorsLoading = true;
      state.error = null;
    });
    builder.addCase(fetchGatewaySensors.rejected, (state, action) => {
      state.detail.sensorsLoading = false;
      state.error = action.error.message ?? 'Error';
    });
    builder.addCase(fetchGatewaySensors.fulfilled, (state, action) => {
      state.detail.sensorsLoading = false;
      state.detail.sensors = action.payload.data;
      state.detail.pagination.totalPages = action.payload.pagination.totalPages;
    });

    /* update label ------------------------------------- */
    builder.addCase(updateGatewayLabel.pending, (state) => {
      state.detail.loading = true;
      state.error = null;
    });
    builder.addCase(updateGatewayLabel.rejected, (state, action) => {
      state.detail.loading = false;
      state.error = action.error.message ?? 'Error';
    });
    builder.addCase(updateGatewayLabel.fulfilled, (state, action) => {
      state.detail.loading = false;
      // Update the detail state
      if (state.detail.gateway) {
        state.detail.gateway = {
          ...state.detail.gateway,
          label: action.payload.label
        };
      }
      // Update in the main list
      const index = state.data.findIndex(g => g._id === action.payload._id);
      if (index !== -1) {
        state.data[index] = {
          ...state.data[index],
          label: action.payload.label
        };
      }
    });

    /* delete gateway ------------------------------------- */
    builder.addCase(deleteGateway.pending, (state, action) => {
      const gatewayId = action.meta.arg;
      state.deleteLoadingIds.push(gatewayId);
      state.error = null;
    });
    builder.addCase(deleteGateway.rejected, (state, action) => {
      const gatewayId = action.meta.arg;
      state.deleteLoadingIds = state.deleteLoadingIds.filter(id => id !== gatewayId);
      state.error = action.error.message ?? 'Error deleting gateway';
    });
    builder.addCase(deleteGateway.fulfilled, (state, action) => {
      const gatewayId = action.payload.id;
      state.deleteLoadingIds = state.deleteLoadingIds.filter(id => id !== gatewayId);
      
      // Find the gateway being deleted to update stats optimistically
      const deletedGateway = state.data.find(gateway => gateway._id === gatewayId);
      
      // Remove gateway from the list
      state.data = state.data.filter(gateway => gateway._id !== gatewayId);
      
      // Optimistically update stats if they exist
      if (state.stats && deletedGateway) {
        state.stats.totalGateways = Math.max(0, state.stats.totalGateways - 1);
        // Only decrease liveGateways if the deleted gateway was active
        if (deletedGateway.status === 'active') {
          state.stats.liveGateways = Math.max(0, state.stats.liveGateways - 1);
        }
      }
    });

    /* refresh gateway data ------------------------------------- */
    builder.addCase(refreshGatewayData.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(refreshGatewayData.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message ?? 'Error refreshing data';
    });
    builder.addCase(refreshGatewayData.fulfilled, (state) => {
      state.loading = false;
      // Data is already updated by the individual thunks
    });
  },
});

export const { 
  clear, 
  setPage,
  clearDetail,
  setDetailShowClaimed,
  setDetailPage,
  setDetailSearchQuery,
  setDetailSort,
  updateGatewayPresence
} = gatewaySlice.actions;
export default gatewaySlice.reducer;

/* small selector helpers */
export const selectGateways = (st: RootState) => st.gateways.data;
export const selectGatewayStats = (st: RootState) => st.gateways.stats;
export const selectGatewayPagination = (st: RootState) => st.gateways.pagination;
export const gatewaysIsBusy = (st: RootState) => st.gateways.loading;
export const selectDeleteLoadingIds = (st: RootState) => st.gateways.deleteLoadingIds;

// Detail selectors
export const selectGatewayDetail = (st: RootState) => st.gateways.detail.gateway;
export const selectGatewaySensors = (st: RootState) => st.gateways.detail.sensors;
export const selectGatewayDetailPagination = (st: RootState) => st.gateways.detail.pagination;
export const selectGatewayDetailFilters = (st: RootState) => ({
  showClaimed: st.gateways.detail.showClaimed,
  searchQuery: st.gateways.detail.searchQuery,
  sortColumn: st.gateways.detail.sortColumn,
  sortDirection: st.gateways.detail.sortDirection
});
export const gatewayDetailIsBusy = (st: RootState) => st.gateways.detail.loading;
export const gatewaySensorsIsBusy = (st: RootState) => st.gateways.detail.sensorsLoading;