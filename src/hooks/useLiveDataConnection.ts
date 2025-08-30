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

    // Auto-connect on app start with proper timing
    const timer = setTimeout(() => {

      if (!isLiveMode && !isConnecting) {

        dispatch(initializeLiveConnection());
      } else {

      }
    }, 1500); // Reduced to 1.5s to align with data fetching logic
    
    return () => {

      clearTimeout(timer);
    };
  }, []); // Run once on mount

  return {
    isLiveMode,
    isConnecting,
    connectionError
  };
};
