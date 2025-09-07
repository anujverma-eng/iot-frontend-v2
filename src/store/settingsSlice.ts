import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SettingsService, SettingsResponse } from '../api/settings.service';

export interface SensorSettings {
  offlineTimeoutMinutes: number;
}

export interface AppSettings {
  sensors: SensorSettings;
}

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  loading: boolean;
  error: {
    type: 'SETTINGS_NOT_FOUND' | 'API_ERROR' | 'CREATE_ERROR' | 'UPDATE_ERROR' | 'UNKNOWN_ERROR';
    message: string;
  } | null;
  backendSettings: SettingsResponse | null;
}

const DEFAULT_SETTINGS: AppSettings = {
  sensors: {
    offlineTimeoutMinutes: 5, // Default to 5 minutes
  },
};

const SETTINGS_STORAGE_KEY = 'iot-app-settings';

// Helper function to convert backend response to frontend format
const convertBackendToFrontend = (backendSettings: SettingsResponse): AppSettings => ({
  sensors: {
    offlineTimeoutMinutes: backendSettings.sensorOfflineTimeOut,
  },
});

// Helper function to convert frontend format to backend request
const convertFrontendToBackend = (frontendSettings: AppSettings) => ({
  sensorOfflineTimeOut: frontendSettings.sensors.offlineTimeoutMinutes,
});

// Async thunks for backend API operations
export const fetchSettingsFromBackend = createAsyncThunk(
  'settings/fetchFromBackend',
  async (_, { rejectWithValue, getState }) => {
    try {
      const state = getState() as any;
      const activeOrgReady = state.activeOrg?.orgId && state.activeOrg?.status === 'ready';
      
      if (!activeOrgReady) {
        return rejectWithValue({
          type: 'API_ERROR',
          message: 'Cannot fetch settings: active organization not ready',
        });
      }

      const backendSettings = await SettingsService.getSettings();

      return backendSettings;
    } catch (error: any) {
      // Handle 500 errors specifically - likely org context missing
      if (error.response?.status === 500) {
        console.error('[Settings] 500 error - checking request headers:', {
          'X-Org-Id': error.config?.headers?.['X-Org-Id'] || 'NOT_SET',
          'Authorization': error.config?.headers?.Authorization ? 'PRESENT' : 'MISSING',
          url: error.config?.url,
        });
        
        return rejectWithValue({
          type: 'API_ERROR',
          message: 'Server error - organization context may be missing. Please try again.',
        });
      }

      // Handle specific error types
      if (error.message?.startsWith('SETTINGS_NOT_FOUND:')) {
        return rejectWithValue({
          type: 'SETTINGS_NOT_FOUND',
          message: 'No settings found for your organization. Settings will be created when you make your first change.',
        });
      }
      
      if (error.message?.startsWith('API_ERROR:')) {
        return rejectWithValue({
          type: 'API_ERROR',
          message: error.message.replace('API_ERROR: ', ''),
        });
      }
      
      // Generic error handling
      return rejectWithValue({
        type: 'UNKNOWN_ERROR',
        message: error.message || 'Failed to fetch settings from server',
      });
    }
  }
);

export const createSettingsInBackend = createAsyncThunk(
  'settings/createInBackend',
  async (settings: AppSettings, { rejectWithValue }) => {
    try {

      const request = convertFrontendToBackend(settings);
      const backendSettings = await SettingsService.createSettings(request);

      return backendSettings;
    } catch (error: any) {

      if (error.message?.startsWith('CREATE_FAILED:')) {
        return rejectWithValue({
          type: 'CREATE_ERROR',
          message: error.message.replace('CREATE_FAILED: ', ''),
        });
      }
      
      return rejectWithValue({
        type: 'UNKNOWN_ERROR',
        message: error.message || 'Failed to create settings',
      });
    }
  }
);

export const updateSettingsInBackend = createAsyncThunk(
  'settings/updateInBackend',
  async (settings: AppSettings, { rejectWithValue }) => {
    try {

      const request = convertFrontendToBackend(settings);
      const backendSettings = await SettingsService.updateSettings(request);

      return backendSettings;
    } catch (error: any) {

      if (error.message?.startsWith('UPDATE_FAILED:')) {
        return rejectWithValue({
          type: 'UPDATE_ERROR',
          message: error.message.replace('UPDATE_FAILED: ', ''),
        });
      }
      
      return rejectWithValue({
        type: 'UNKNOWN_ERROR',
        message: error.message || 'Failed to update settings',
      });
    }
  }
);

// Helper function to save settings to backend (create or update)
export const saveSettingsToBackend = createAsyncThunk(
  'settings/saveToBackend',
  async (settings: AppSettings, { dispatch, getState, rejectWithValue }) => {
    try {
      const state = getState() as { settings: SettingsState };
      const hasBackendSettings = state.settings.backendSettings !== null;
      
      if (hasBackendSettings) {
        // Update existing settings
        return await dispatch(updateSettingsInBackend(settings)).unwrap();
      } else {
        // Create new settings
        return await dispatch(createSettingsInBackend(settings)).unwrap();
      }
    } catch (error: any) {

      // Pass through the structured error from create/update
      if (error?.type) {
        return rejectWithValue(error);
      }
      
      return rejectWithValue({
        type: 'UNKNOWN_ERROR',
        message: error.message || 'Failed to save settings',
      });
    }
  }
);

const saveSettingsToStorage = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

  } catch (error) {

  }
};

const clearSettingsFromStorage = (): void => {
  try {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);

  } catch (error) {

  }
};

const initialState: SettingsState = {
  settings: DEFAULT_SETTINGS,
  loaded: false,
  loading: false,
  error: null,
  backendSettings: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    
    // Update sensor settings locally (will be synced to backend automatically)
    updateSensorSettings: (state, action: PayloadAction<Partial<SensorSettings>>) => {
      state.settings.sensors = {
        ...state.settings.sensors,
        ...action.payload,
      };
      // Save to localStorage as fallback
      saveSettingsToStorage(state.settings);

    },
    
    // Update all settings locally (will be synced to backend automatically)
    updateAllSettings: (state, action: PayloadAction<AppSettings>) => {
      state.settings = action.payload;
      // Save to localStorage as fallback
      saveSettingsToStorage(state.settings);

    },
    
    // Reset settings to defaults
    resetSettings: (state) => {
      state.settings = DEFAULT_SETTINGS;
      // Save to localStorage as fallback
      saveSettingsToStorage(state.settings);

    },

    // Clear any error state
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch settings from backend
    builder
      .addCase(fetchSettingsFromBackend.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettingsFromBackend.fulfilled, (state, action) => {
        state.loading = false;
        state.backendSettings = action.payload;
        state.settings = convertBackendToFrontend(action.payload);
        state.loaded = true;
        // Clear localStorage since we now have backend settings
        clearSettingsFromStorage();

      })
      .addCase(fetchSettingsFromBackend.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as {
          type: 'SETTINGS_NOT_FOUND' | 'API_ERROR' | 'CREATE_ERROR' | 'UPDATE_ERROR' | 'UNKNOWN_ERROR';
          message: string;
        };
        // If settings not found, we'll create them when user updates
        if (state.error?.type === 'SETTINGS_NOT_FOUND') {

        } else {

        }
      });

    // Create settings in backend
    builder
      .addCase(createSettingsInBackend.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSettingsInBackend.fulfilled, (state, action) => {
        state.loading = false;
        state.backendSettings = action.payload;
        state.settings = convertBackendToFrontend(action.payload);
        // Clear localStorage since we now have backend settings
        clearSettingsFromStorage();

      })
      .addCase(createSettingsInBackend.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as {
          type: 'SETTINGS_NOT_FOUND' | 'API_ERROR' | 'CREATE_ERROR' | 'UPDATE_ERROR' | 'UNKNOWN_ERROR';
          message: string;
        };

      });

    // Update settings in backend
    builder
      .addCase(updateSettingsInBackend.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateSettingsInBackend.fulfilled, (state, action) => {
        state.loading = false;
        state.backendSettings = action.payload;
        state.settings = convertBackendToFrontend(action.payload);
        // Clear localStorage since we now have backend settings
        clearSettingsFromStorage();

      })
      .addCase(updateSettingsInBackend.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as {
          type: 'SETTINGS_NOT_FOUND' | 'API_ERROR' | 'CREATE_ERROR' | 'UPDATE_ERROR' | 'UNKNOWN_ERROR';
          message: string;
        };

      });

    // Save settings to backend (create or update)
    builder
      .addCase(saveSettingsToBackend.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveSettingsToBackend.fulfilled, (state, action) => {
        state.loading = false;
        state.backendSettings = action.payload;
        state.settings = convertBackendToFrontend(action.payload);
        // Clear localStorage since we now have backend settings
        clearSettingsFromStorage();

      })
      .addCase(saveSettingsToBackend.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as {
          type: 'SETTINGS_NOT_FOUND' | 'API_ERROR' | 'CREATE_ERROR' | 'UPDATE_ERROR' | 'UNKNOWN_ERROR';
          message: string;
        };

      });
  },
});

export const {
  updateSensorSettings,
  updateAllSettings,
  resetSettings,
  clearError,
} = settingsSlice.actions;

// Selectors
export const selectSettings = (state: { settings: SettingsState }) => state.settings.settings;
export const selectSensorSettings = (state: { settings: SettingsState }) => state.settings.settings.sensors;
export const selectOfflineTimeout = (state: { settings: SettingsState }) => state.settings.settings.sensors.offlineTimeoutMinutes;
export const selectSettingsLoaded = (state: { settings: SettingsState }) => state.settings.loaded;
export const selectSettingsLoading = (state: { settings: SettingsState }) => state.settings.loading;
export const selectSettingsError = (state: { settings: SettingsState }) => state.settings.error;
export const selectSettingsErrorMessage = (state: { settings: SettingsState }) => state.settings.error?.message;
export const selectSettingsErrorType = (state: { settings: SettingsState }) => state.settings.error?.type;
export const selectBackendSettings = (state: { settings: SettingsState }) => state.settings.backendSettings;
export const selectHasBackendSettings = (state: { settings: SettingsState }) => state.settings.backendSettings !== null;

export default settingsSlice.reducer;
