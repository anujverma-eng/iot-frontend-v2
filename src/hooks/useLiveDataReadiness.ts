import { useEffect, useRef, useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { 
  selectIsLiveMode, 
  selectIsConnecting 
} from '../store/liveDataSlice';
import { selectTelemetryData } from '../store/telemetrySlice';

/**
 * Hook to track when we should wait for live data before showing charts
 * This prevents the flickering issue where API data is shown first, then replaced by live data
 */
export const useLiveDataReadiness = (sensorId: string | null, isOfflineSensorFilter = false) => {
  // IMMEDIATE log to ensure hook is called
  console.log('[useLiveDataReadiness] 🚨 HOOK ENTRY POINT - Called!', {
    sensorId,
    isOfflineSensorFilter,
    timestamp: new Date().toISOString()
  });
  
  const isLiveMode = useSelector(selectIsLiveMode);
  const isConnecting = useSelector(selectIsConnecting);
  const telemetryData = useSelector(selectTelemetryData);
  
  console.log('[useLiveDataReadiness] 🔄 Hook called with:', {
    sensorId,
    isOfflineSensorFilter,
    isLiveMode,
    isConnecting,
    telemetryDataKeys: Object.keys(telemetryData),
    timestamp: new Date().toISOString()
  });
  
  // Track states for the current sensor
  const [currentSensorId, setCurrentSensorId] = useState<string | null>(null);
  const [shouldShowLoader, setShouldShowLoader] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  // Maximum time to wait for live data before falling back to API
  const LIVE_DATA_TIMEOUT = 4000; // 4 seconds
  
  // Check if we already have live data for the current sensor
  const hasLiveData = useMemo(() => {
    const result = sensorId && telemetryData[sensorId]?.isLive && telemetryData[sensorId]?.series?.length > 0;
    console.log('[useLiveDataReadiness] 📊 hasLiveData check:', {
      sensorId,
      exists: sensorId ? !!telemetryData[sensorId] : false,
      isLive: sensorId ? telemetryData[sensorId]?.isLive : false,
      seriesLength: sensorId ? telemetryData[sensorId]?.series?.length : 0,
      result,
      timestamp: new Date().toISOString()
    });
    return result;
  }, [sensorId, telemetryData]);
  
  // Reset everything when sensor changes
  useEffect(() => {
    console.log('[useLiveDataReadiness] 🔄 Sensor change effect triggered:', {
      currentSensorId,
      newSensorId: sensorId,
      hasChanged: currentSensorId !== sensorId,
      timestamp: new Date().toISOString()
    });
    
    if (currentSensorId !== sensorId) {
      console.log('[useLiveDataReadiness] 🎯 Sensor changed:', { 
        from: currentSensorId, 
        to: sensorId,
        isLiveMode,
        isOfflineSensorFilter,
        hasLiveData,
        timestamp: new Date().toISOString()
      });
      
      setCurrentSensorId(sensorId);
      setShouldShowLoader(false);
      setHasTimedOut(false);
      
      console.log('[useLiveDataReadiness] 🧹 States reset for new sensor');
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        console.log('[useLiveDataReadiness] ⏰ Clearing existing timeout');
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      
      // Only start waiting if we have a sensor, (live mode is on OR connecting), not filtering offline, and no existing live data
      if (sensorId && (isLiveMode || isConnecting) && !isOfflineSensorFilter && !hasLiveData) {
        console.log('[useLiveDataReadiness] 🚀 Starting to wait for live data for new sensor:', {
          sensorId,
          conditions: {
            hasSensorId: !!sensorId,
            isLiveMode,
            isConnecting,
            notOfflineFilter: !isOfflineSensorFilter,
            noLiveDataYet: !hasLiveData
          },
          timestamp: new Date().toISOString()
        });
        
        setShouldShowLoader(true);
        console.log('[useLiveDataReadiness] 📱 Loader enabled');
        
        // Set timeout to fall back to API data
        timeoutRef.current = setTimeout(() => {
          console.log('[useLiveDataReadiness] ⏱️ TIMEOUT reached for sensor:', {
            sensorId,
            timeoutDuration: LIVE_DATA_TIMEOUT,
            timestamp: new Date().toISOString()
          });
          setShouldShowLoader(false);
          setHasTimedOut(true);
          console.log('[useLiveDataReadiness] 🔄 Loader disabled, timeout flag set');
        }, LIVE_DATA_TIMEOUT);
        
        console.log('[useLiveDataReadiness] ⏰ Timeout set for', LIVE_DATA_TIMEOUT, 'ms');
      } else {
        console.log('[useLiveDataReadiness] ❌ NOT starting live data wait:', {
          sensorId: !!sensorId,
          isLiveMode,
          isConnecting,
          isOfflineSensorFilter,
          hasLiveData,
          conditions: {
            hasSensorId: !!sensorId,
            isLiveMode,
            isConnecting,
            notOfflineFilter: !isOfflineSensorFilter,
            noLiveDataYet: !hasLiveData
          }
        });
      }
    }
  }, [sensorId, currentSensorId, isLiveMode, isOfflineSensorFilter, hasLiveData]);
  
  // Stop waiting when we receive live data
  useEffect(() => {
    console.log('[useLiveDataReadiness] 📡 Live data check effect:', {
      shouldShowLoader,
      hasLiveData,
      sensorId,
      timestamp: new Date().toISOString()
    });
    
    if (shouldShowLoader && hasLiveData) {
      console.log('[useLiveDataReadiness] 🎉 RECEIVED live data for sensor:', {
        sensorId,
        wasWaiting: shouldShowLoader,
        timestamp: new Date().toISOString()
      });
      setShouldShowLoader(false);
      setHasTimedOut(false);
      console.log('[useLiveDataReadiness] 🔄 Loader disabled, timeout cleared');
      
      // Clear timeout since we got live data
      if (timeoutRef.current) {
        console.log('[useLiveDataReadiness] ⏰ Clearing timeout - live data received');
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }
  }, [shouldShowLoader, hasLiveData, sensorId]);
  
  // Monitor live connection starting
  useEffect(() => {
    console.log('[useLiveDataReadiness] 🔗 Connection state effect:', {
      isConnecting,
      sensorId,
      shouldShowLoader,
      hasLiveData,
      timestamp: new Date().toISOString()
    });

    // If connection is starting and we have a sensor but no live data yet, start waiting
    if (isConnecting && sensorId && !isOfflineSensorFilter && !hasLiveData && !shouldShowLoader) {
      console.log('[useLiveDataReadiness] 🚀 Connection starting - enabling loader for live data wait');
      setShouldShowLoader(true);
      
      // Set timeout to fall back to API data
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        console.log('[useLiveDataReadiness] ⏱️ TIMEOUT reached during connection:', {
          sensorId,
          timeoutDuration: LIVE_DATA_TIMEOUT,
          timestamp: new Date().toISOString()
        });
        setShouldShowLoader(false);
        setHasTimedOut(true);
        console.log('[useLiveDataReadiness] 🔄 Loader disabled due to connection timeout');
      }, LIVE_DATA_TIMEOUT);
    }
  }, [isConnecting, sensorId, isOfflineSensorFilter, hasLiveData, shouldShowLoader]);
  
  // Reset when live mode is disabled
  useEffect(() => {
    console.log('[useLiveDataReadiness] 🔄 Live mode effect:', {
      isLiveMode,
      timestamp: new Date().toISOString()
    });
    
    if (!isLiveMode) {
      console.log('[useLiveDataReadiness] 🔴 Live mode disabled, resetting all states');
      setShouldShowLoader(false);
      setHasTimedOut(false);
      if (timeoutRef.current) {
        console.log('[useLiveDataReadiness] ⏰ Clearing timeout - live mode disabled');
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }
  }, [isLiveMode]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // Determine what action to take
  const shouldWaitForLiveData = shouldShowLoader;
  const shouldFetchApiData = (!isLiveMode && !isConnecting) || // Not in live mode and not connecting
                            isOfflineSensorFilter || // Filtering offline sensors
                            hasTimedOut || // Timed out waiting
                            hasLiveData || // Already have live data
                            !sensorId || // No sensor selected
                            !shouldShowLoader; // Not currently waiting
  
  console.log('[useLiveDataReadiness] 📋 FINAL State summary:', {
    sensorId,
    shouldWaitForLiveData,
    shouldFetchApiData,
    shouldShowLoading: shouldShowLoader,
    hasLiveData,
    hasTimedOut,
    isLiveMode,
    isConnecting,
    isOfflineSensorFilter,
    currentSensorId,
    conditions: {
      notLiveModeAndNotConnecting: !isLiveMode && !isConnecting,
      offlineFilter: isOfflineSensorFilter,
      timedOut: hasTimedOut,
      hasLiveData,
      noSensorSelected: !sensorId,
      notWaiting: !shouldShowLoader
    },
    timestamp: new Date().toISOString()
  });
  
  return {
    shouldWaitForLiveData,
    hasReceivedLiveData: hasLiveData,
    shouldShowLoading: shouldShowLoader,
    shouldFetchApiData
  };
};
