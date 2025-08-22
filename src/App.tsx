// src/App.tsx
import { useEffect } from 'react';
import { AppRouter } from './router';
import { useAppDispatch, useAppSelector } from './hooks/useAppDispatch';
import { loadSettings, selectOfflineTimeout } from './store/settingsSlice';
import { offlineDetectionService } from './services/offlineDetectionService';

export default function App() {
  const dispatch = useAppDispatch();
  const offlineTimeout = useAppSelector(selectOfflineTimeout);

  useEffect(() => {
    // Initialize settings first
    dispatch(loadSettings());
  }, [dispatch]);

  useEffect(() => {
    // Initialize offline detection service with current settings
    const getSettings = () => ({ 
      offlineTimeoutMinutes: offlineTimeout || 10 // Default to 10 minutes if not loaded
    });
    
    offlineDetectionService.initialize(dispatch, getSettings);

    // Cleanup on unmount
    return () => {
      offlineDetectionService.cleanup();
    };
  }, [dispatch, offlineTimeout]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">
        <AppRouter />
      </main>
    </div>
  );
}
