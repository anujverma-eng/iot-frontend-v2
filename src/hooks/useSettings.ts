import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from './useAppDispatch';
import {
  fetchSettingsFromBackend,
  saveSettingsToBackend,
  updateSensorSettings,
  updateAllSettings,
  resetSettings,
  selectSettings,
  selectSensorSettings,
  selectOfflineTimeout,
  selectSettingsLoaded,
  selectSettingsLoading,
  selectSettingsError,
  selectSettingsErrorMessage,
  selectSettingsErrorType,
  selectHasBackendSettings,
  clearError,
  type AppSettings,
  type SensorSettings,
} from '../store/settingsSlice';

/**
 * Custom hook for managing application settings with backend synchronization
 * 
 * This hook provides:
 * - Automatic loading of settings from backend on mount
 * - Fallback to localStorage for immediate availability
 * - Automatic syncing to backend when settings change
 * - Migration from localStorage to backend
 */
export const useSettings = () => {
  const dispatch = useAppDispatch();
  
  // Selectors
  const settings = useAppSelector(selectSettings);
  const sensorSettings = useAppSelector(selectSensorSettings);
  const offlineTimeout = useAppSelector(selectOfflineTimeout);
  const isLoaded = useAppSelector(selectSettingsLoaded);
  const isLoading = useAppSelector(selectSettingsLoading);
  const error = useAppSelector(selectSettingsError);
  const errorMessage = useAppSelector(selectSettingsErrorMessage);
  const errorType = useAppSelector(selectSettingsErrorType);
  const hasBackendSettings = useAppSelector(selectHasBackendSettings);

  // Initialize settings on mount
  useEffect(() => {
    const initializeSettings = async () => {
      
      // Then try to fetch from backend
      try {
        await dispatch(fetchSettingsFromBackend()).unwrap();
        console.log('[useSettings] Settings loaded from backend successfully');
      } catch (error: any) {
        if (error?.type === 'SETTINGS_NOT_FOUND') {
          console.log('[useSettings] No backend settings found, will create on first update');
        } else {
          console.warn('[useSettings] Failed to load from backend, using localStorage fallback:', error?.message || error);
        }
      }
    };

    if (!isLoaded) {
      initializeSettings();
    }
  }, [dispatch, isLoaded]);

  // Sync to backend when settings change (debounced)
  const syncToBackend = useCallback(
    async (settingsToSync: AppSettings) => {
      try {
        await dispatch(saveSettingsToBackend(settingsToSync)).unwrap();
        console.log('[useSettings] Settings synced to backend successfully');
      } catch (error) {
        console.error('[useSettings] Failed to sync settings to backend:', error);
        // Don't throw error - keep localStorage as fallback
      }
    },
    [dispatch]
  );

  // Update sensor settings with backend sync
  const updateSensorSettingsWithSync = useCallback(
    async (newSensorSettings: Partial<SensorSettings>) => {
      // Clear "not found" error since we're about to create settings
      if (error?.type === 'SETTINGS_NOT_FOUND') {
        dispatch(clearError());
      }
      
      // Update locally first for immediate UI response
      dispatch(updateSensorSettings(newSensorSettings));
      
      // Create the full settings object for backend sync
      const updatedSettings: AppSettings = {
        sensors: {
          ...sensorSettings,
          ...newSensorSettings,
        },
      };
      
      // Sync to backend
      await syncToBackend(updatedSettings);
    },
    [dispatch, sensorSettings, syncToBackend, error?.type]
  );

  // Update all settings with backend sync
  const updateAllSettingsWithSync = useCallback(
    async (newSettings: AppSettings) => {
      // Clear "not found" error since we're about to create settings
      if (error?.type === 'SETTINGS_NOT_FOUND') {
        dispatch(clearError());
      }
      
      // Update locally first for immediate UI response
      dispatch(updateAllSettings(newSettings));
      
      // Sync to backend
      await syncToBackend(newSettings);
    },
    [dispatch, syncToBackend, error?.type]
  );

  // Reset settings with backend sync
  const resetSettingsWithSync = useCallback(async () => {
    // Clear "not found" error since we're about to create settings
    if (error?.type === 'SETTINGS_NOT_FOUND') {
      dispatch(clearError());
    }
    
    // Reset locally first
    dispatch(resetSettings());
    
    // Get the default settings for backend sync
    const defaultSettings: AppSettings = {
      sensors: {
        offlineTimeoutMinutes: 5,
      },
    };
    
    // Sync to backend
    await syncToBackend(defaultSettings);
  }, [dispatch, syncToBackend, error?.type]);

  // Clear error
  const clearSettingsError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  // Manual sync function for forced synchronization
  const forceSyncToBackend = useCallback(async () => {
    await syncToBackend(settings);
  }, [syncToBackend, settings]);

  // Refresh settings from backend
  const refreshFromBackend = useCallback(async () => {
    try {
      await dispatch(fetchSettingsFromBackend()).unwrap();
      console.log('[useSettings] Settings refreshed from backend');
    } catch (error) {
      console.error('[useSettings] Failed to refresh settings from backend:', error);
      throw error;
    }
  }, [dispatch]);

  return {
    // Settings data
    settings,
    sensorSettings,
    offlineTimeout,
    
    // Status flags
    isLoaded,
    isLoading,
    error,
    errorMessage,
    errorType,
    hasBackendSettings,
    
    // Update functions (with backend sync)
    updateSensorSettings: updateSensorSettingsWithSync,
    updateAllSettings: updateAllSettingsWithSync,
    resetSettings: resetSettingsWithSync,
    
    // Utility functions
    clearError: clearSettingsError,
    forceSyncToBackend,
    refreshFromBackend,
  };
};
