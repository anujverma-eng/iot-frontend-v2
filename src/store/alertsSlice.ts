// src/store/alertsSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AlertsService } from '../api/alerts.service';
import {
  Alert,
  AlertsListParams,
  AlertHistoryParams,
  CreateAlertRequest,
  UpdateAlertRequest,
  AlertStats,
  AlertHistory,
  Pagination
} from '../types/alert';

interface AlertsState {
  // Alert rules state
  alerts: Alert[];
  alertsLoading: boolean;
  alertsError: string | null;
  alertsPagination: Pagination;
  
  // Individual alert operations
  creatingAlert: boolean;
  updatingAlertId: string | null;
  deletingAlertId: string | null;
  togglingAlertId: string | null;
  
  // Alert statistics
  stats: AlertStats | null;
  statsLoading: boolean;
  
  // Alert history state
  history: AlertHistory[];
  historyLoading: boolean;
  historyError: string | null;
  historyPagination: Pagination;
  acknowledgingId: string | null;
}

const initialState: AlertsState = {
  alerts: [],
  alertsLoading: false,
  alertsError: null,
  alertsPagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  },
  creatingAlert: false,
  updatingAlertId: null,
  deletingAlertId: null,
  togglingAlertId: null,
  stats: null,
  statsLoading: false,
  history: [],
  historyLoading: false,
  historyError: null,
  historyPagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  },
  acknowledgingId: null
};

// Thunks
export const fetchAlerts = createAsyncThunk(
  'alerts/fetchAlerts',
  async (params: AlertsListParams = {}) => {
    return await AlertsService.listAlerts(params);
  }
);

export const fetchAlertById = createAsyncThunk(
  'alerts/fetchAlertById',
  async (id: string) => {
    return await AlertsService.getAlertById(id);
  }
);

export const createAlert = createAsyncThunk(
  'alerts/createAlert',
  async (data: CreateAlertRequest, { rejectWithValue }) => {
    try {
      return await AlertsService.createAlert(data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error?.message || error.message || 'Failed to create alert');
    }
  }
);

export const updateAlert = createAsyncThunk(
  'alerts/updateAlert',
  async ({ id, data }: { id: string; data: UpdateAlertRequest }, { rejectWithValue }) => {
    try {
      return await AlertsService.updateAlert(id, data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error?.message || error.message || 'Failed to update alert');
    }
  }
);

export const toggleAlert = createAsyncThunk(
  'alerts/toggleAlert',
  async ({ id, enabled }: { id: string; enabled: boolean }, { rejectWithValue }) => {
    try {
      return await AlertsService.toggleAlert(id, enabled);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error?.message || error.message || 'Failed to toggle alert');
    }
  }
);

export const deleteAlert = createAsyncThunk(
  'alerts/deleteAlert',
  async (id: string, { rejectWithValue }) => {
    try {
      await AlertsService.deleteAlert(id);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error?.message || error.message || 'Failed to delete alert');
    }
  }
);

export const fetchAlertStats = createAsyncThunk(
  'alerts/fetchStats',
  async () => {
    return await AlertsService.getAlertStats();
  }
);

export const fetchAlertHistory = createAsyncThunk(
  'alerts/fetchHistory',
  async (params: AlertHistoryParams = {}) => {
    return await AlertsService.getAlertHistory(params);
  }
);

export const acknowledgeAlert = createAsyncThunk(
  'alerts/acknowledgeAlert',
  async (historyId: string, { rejectWithValue }) => {
    try {
      return await AlertsService.acknowledgeAlert(historyId);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.error?.message || error.message || 'Failed to acknowledge alert');
    }
  }
);

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    clearAlertsError: (state) => {
      state.alertsError = null;
    },
    clearHistoryError: (state) => {
      state.historyError = null;
    },
    setAlertsPage: (state, action: PayloadAction<number>) => {
      state.alertsPagination.page = action.payload;
    },
    setHistoryPage: (state, action: PayloadAction<number>) => {
      state.historyPagination.page = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch alerts
    builder.addCase(fetchAlerts.pending, (state) => {
      state.alertsLoading = true;
      state.alertsError = null;
    });
    builder.addCase(fetchAlerts.fulfilled, (state, action) => {
      state.alertsLoading = false;
      state.alerts = action.payload.data;
      state.alertsPagination = action.payload.pagination;
    });
    builder.addCase(fetchAlerts.rejected, (state, action) => {
      state.alertsLoading = false;
      state.alertsError = action.error.message || 'Failed to fetch alerts';
    });

    // Create alert
    builder.addCase(createAlert.pending, (state) => {
      state.creatingAlert = true;
      state.alertsError = null;
    });
    builder.addCase(createAlert.fulfilled, (state, action) => {
      state.creatingAlert = false;
      state.alerts.unshift(action.payload);
      state.alertsPagination.total += 1;
    });
    builder.addCase(createAlert.rejected, (state, action) => {
      state.creatingAlert = false;
      state.alertsError = action.payload as string;
    });

    // Update alert
    builder.addCase(updateAlert.pending, (state, action) => {
      state.updatingAlertId = action.meta.arg.id;
      state.alertsError = null;
    });
    builder.addCase(updateAlert.fulfilled, (state, action) => {
      state.updatingAlertId = null;
      const index = state.alerts.findIndex(a => a._id === action.payload._id);
      if (index !== -1) {
        state.alerts[index] = action.payload;
      }
    });
    builder.addCase(updateAlert.rejected, (state, action) => {
      state.updatingAlertId = null;
      state.alertsError = action.payload as string;
    });

    // Toggle alert
    builder.addCase(toggleAlert.pending, (state, action) => {
      state.togglingAlertId = action.meta.arg.id;
    });
    builder.addCase(toggleAlert.fulfilled, (state, action) => {
      state.togglingAlertId = null;
      const index = state.alerts.findIndex(a => a._id === action.payload._id);
      if (index !== -1) {
        state.alerts[index] = action.payload;
      }
    });
    builder.addCase(toggleAlert.rejected, (state, action) => {
      state.togglingAlertId = null;
      state.alertsError = action.payload as string;
    });

    // Delete alert
    builder.addCase(deleteAlert.pending, (state, action) => {
      state.deletingAlertId = action.meta.arg;
    });
    builder.addCase(deleteAlert.fulfilled, (state, action) => {
      state.deletingAlertId = null;
      state.alerts = state.alerts.filter(a => a._id !== action.payload);
      state.alertsPagination.total = Math.max(0, state.alertsPagination.total - 1);
    });
    builder.addCase(deleteAlert.rejected, (state, action) => {
      state.deletingAlertId = null;
      state.alertsError = action.payload as string;
    });

    // Fetch stats
    builder.addCase(fetchAlertStats.pending, (state) => {
      state.statsLoading = true;
    });
    builder.addCase(fetchAlertStats.fulfilled, (state, action) => {
      state.statsLoading = false;
      state.stats = action.payload;
    });
    builder.addCase(fetchAlertStats.rejected, (state) => {
      state.statsLoading = false;
    });

    // Fetch history
    builder.addCase(fetchAlertHistory.pending, (state) => {
      state.historyLoading = true;
      state.historyError = null;
    });
    builder.addCase(fetchAlertHistory.fulfilled, (state, action) => {
      state.historyLoading = false;
      state.history = action.payload.data;
      state.historyPagination = action.payload.pagination;
    });
    builder.addCase(fetchAlertHistory.rejected, (state, action) => {
      state.historyLoading = false;
      state.historyError = action.error.message || 'Failed to fetch alert history';
    });

    // Acknowledge alert
    builder.addCase(acknowledgeAlert.pending, (state, action) => {
      state.acknowledgingId = action.meta.arg;
    });
    builder.addCase(acknowledgeAlert.fulfilled, (state, action) => {
      state.acknowledgingId = null;
      const index = state.history.findIndex(h => h._id === action.payload._id);
      if (index !== -1) {
        state.history[index] = action.payload;
      }
    });
    builder.addCase(acknowledgeAlert.rejected, (state, action) => {
      state.acknowledgingId = null;
      state.historyError = action.payload as string;
    });
  }
});

export const { clearAlertsError, clearHistoryError, setAlertsPage, setHistoryPage } = alertsSlice.actions;

// Selectors
export const selectAlerts = (state: any) => state.alerts.alerts;
export const selectAlertsLoading = (state: any) => state.alerts.alertsLoading;
export const selectAlertsError = (state: any) => state.alerts.alertsError;
export const selectAlertsPagination = (state: any) => state.alerts.alertsPagination;
export const selectCreatingAlert = (state: any) => state.alerts.creatingAlert;
export const selectUpdatingAlertId = (state: any) => state.alerts.updatingAlertId;
export const selectDeletingAlertId = (state: any) => state.alerts.deletingAlertId;
export const selectTogglingAlertId = (state: any) => state.alerts.togglingAlertId;
export const selectAlertStats = (state: any) => state.alerts.stats;
export const selectAlertStatsLoading = (state: any) => state.alerts.statsLoading;
export const selectAlertHistory = (state: any) => state.alerts.history;
export const selectHistoryLoading = (state: any) => state.alerts.historyLoading;
export const selectHistoryError = (state: any) => state.alerts.historyError;
export const selectHistoryPagination = (state: any) => state.alerts.historyPagination;
export const selectAcknowledgingId = (state: any) => state.alerts.acknowledgingId;

export default alertsSlice.reducer;
