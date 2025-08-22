// src/hooks/useLiveDataConnection.ts
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import { 
  initializeLiveConnection, 
  selectIsLiveMode, 
  selectIsConnecting,
  selectConnectionError 
} from '../store/liveDataSlice';

/**
 * Hook to automatically manage live data connection
 * This should be used at the app level to ensure centralized connection management
 */
export const useLiveDataConnection = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isLiveMode = useSelector(selectIsLiveMode);
  const isConnecting = useSelector(selectIsConnecting);
  const connectionError = useSelector(selectConnectionError);

  useEffect(() => {
    console.log('[useLiveDataConnection] Auto-connecting on app start...');
    
    // Simple auto-connect on app start  
    const timer = setTimeout(() => {
      console.log('[useLiveDataConnection] Timer triggered - attempting auto-connect...');
      console.log('[useLiveDataConnection] Current state:', { isLiveMode, isConnecting });
      
      if (!isLiveMode && !isConnecting) {
        console.log('[useLiveDataConnection] Starting auto-connect...');
        dispatch(initializeLiveConnection());
      } else {
        console.log('[useLiveDataConnection] Skipping auto-connect - already live or connecting');
      }
    }, 2000); // Give app time to load
    
    return () => {
      console.log('[useLiveDataConnection] Cleaning up timer');
      clearTimeout(timer);
    };
  }, []); // Run once on mount

  return {
    isLiveMode,
    isConnecting,
    connectionError
  };
};
