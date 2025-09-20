// src/hooks/useLiveDataConnection.ts
import { useEffect, useRef } from 'react';
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
  
  // Add organization status selectors
  const activeOrgStatus = useSelector((state: any) => state.activeOrg?.status);
  const activeOrgId = useSelector((state: any) => state.activeOrg?.orgId);
  
  // Track if initial auto-connect has been attempted
  const hasAttemptedAutoConnect = useRef(false);

  useEffect(() => {

    // Only auto-connect once when organization context is ready and we haven't attempted yet
    if (activeOrgStatus === 'ready' && activeOrgId && !hasAttemptedAutoConnect.current) {
      // Simple auto-connect on app start  
      const timer = setTimeout(() => {

        if (!isLiveMode && !isConnecting && !hasAttemptedAutoConnect.current) {
          hasAttemptedAutoConnect.current = true; // Mark as attempted
          dispatch(initializeLiveConnection());
        } else {
        }
      }, 2000); // Give app time to load
      
      return () => {
        clearTimeout(timer);
      };
    } else {
    }
  }, [dispatch, activeOrgStatus, activeOrgId]); // Remove isLiveMode and isConnecting from dependencies

  return {
    isLiveMode,
    isConnecting,
    connectionError
  };
};
