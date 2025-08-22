import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface SensorSettings {
  offlineTimeoutMinutes: number;
}

export interface AppSettings {
  sensors: SensorSettings;
}

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  sensors: {
    offlineTimeoutMinutes: 5, // Default to 5 minutes
  },
};

const SETTINGS_STORAGE_KEY = 'iot-app-settings';

// Helper functions for localStorage
const loadSettingsFromStorage = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error('Error loading settings from localStorage:', error);
  }
  return DEFAULT_SETTINGS;
};

const saveSettingsToStorage = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    console.log('Settings saved to localStorage:', settings);
  } catch (error) {
    console.error('Error saving settings to localStorage:', error);
  }
};

const initialState: SettingsState = {
  settings: DEFAULT_SETTINGS,
  loaded: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    loadSettings: (state) => {
      state.settings = loadSettingsFromStorage();
      state.loaded = true;
      console.log('Settings loaded from localStorage:', state.settings);
    },
    
    updateSensorSettings: (state, action: PayloadAction<Partial<SensorSettings>>) => {
      state.settings.sensors = {
        ...state.settings.sensors,
        ...action.payload,
      };
      saveSettingsToStorage(state.settings);
      console.log('Sensor settings updated:', state.settings.sensors);
    },
    
    updateAllSettings: (state, action: PayloadAction<AppSettings>) => {
      state.settings = action.payload;
      saveSettingsToStorage(state.settings);
      console.log('All settings updated:', state.settings);
    },
    
    resetSettings: (state) => {
      state.settings = DEFAULT_SETTINGS;
      saveSettingsToStorage(state.settings);
      console.log('Settings reset to defaults');
    },
  },
});

export const {
  loadSettings,
  updateSensorSettings,
  updateAllSettings,
  resetSettings,
} = settingsSlice.actions;

// Selectors
export const selectSettings = (state: { settings: SettingsState }) => state.settings.settings;
export const selectSensorSettings = (state: { settings: SettingsState }) => state.settings.settings.sensors;
export const selectOfflineTimeout = (state: { settings: SettingsState }) => state.settings.settings.sensors.offlineTimeoutMinutes;
export const selectSettingsLoaded = (state: { settings: SettingsState }) => state.settings.loaded;

export default settingsSlice.reducer;
