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

  const isLiveMode = useSelector(selectIsLiveMode);
  const isConnecting = useSelector(selectIsConnecting);
  const telemetryData = useSelector(selectTelemetryData);

  // Track states for the current sensor
  const [currentSensorId, setCurrentSensorId] = useState<string | null>(null);
  const [shouldShowLoader, setShouldShowLoader] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  // Maximum time to wait for live data before falling back to API
  const LIVE_DATA_TIMEOUT = 3000; // Reduced to 3 seconds for better UX
  
  // Check if we already have live data for the current sensor
  const hasLiveData = useMemo(() => {
    const result = sensorId && telemetryData[sensorId]?.isLive && telemetryData[sensorId]?.series?.length > 0;

    return result;
  }, [sensorId, telemetryData]);
  
  // Reset everything when sensor changes
  useEffect(() => {

    if (currentSensorId !== sensorId) {

      setCurrentSensorId(sensorId);
      setShouldShowLoader(false);
      setHasTimedOut(false);

      // Clear any existing timeout
      if (timeoutRef.current) {

        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      
      // Only start waiting if we have a sensor, (live mode is on OR connecting), not filtering offline, and no existing live data
      if (sensorId && (isLiveMode || isConnecting) && !isOfflineSensorFilter && !hasLiveData) {

        setShouldShowLoader(true);

        // Set timeout to fall back to API data
        timeoutRef.current = setTimeout(() => {

          setShouldShowLoader(false);
          setHasTimedOut(true);

        }, LIVE_DATA_TIMEOUT);

      } else {

      }
    }
  }, [sensorId, currentSensorId, isLiveMode, isOfflineSensorFilter, hasLiveData]);
  
  // Stop waiting when we receive live data
  useEffect(() => {

    if (shouldShowLoader && hasLiveData) {

      setShouldShowLoader(false);
      setHasTimedOut(false);

      // Clear timeout since we got live data
      if (timeoutRef.current) {

        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }
  }, [shouldShowLoader, hasLiveData, sensorId]);
  
  // Monitor live connection starting
  useEffect(() => {

    // If connection is starting and we have a sensor but no live data yet, start waiting
    if (isConnecting && sensorId && !isOfflineSensorFilter && !hasLiveData && !shouldShowLoader) {

      setShouldShowLoader(true);
      
      // Set timeout to fall back to API data
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {

        setShouldShowLoader(false);
        setHasTimedOut(true);

      }, LIVE_DATA_TIMEOUT);
    }
  }, [isConnecting, sensorId, isOfflineSensorFilter, hasLiveData, shouldShowLoader]);
  
  // Reset when live mode is disabled
  useEffect(() => {

    if (!isLiveMode) {

      setShouldShowLoader(false);
      setHasTimedOut(false);
      if (timeoutRef.current) {

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
                            hasLiveData || // Already have live data (allow API calls for historical data)
                            !sensorId; // No sensor selected

  // Note: Removed !shouldShowLoader condition to allow API calls even while showing live loader
  // This enables fetching limited historical data while waiting for live data

  const result = {
    shouldWaitForLiveData,
    hasReceivedLiveData: hasLiveData,
    shouldShowLoading: shouldShowLoader,
    shouldFetchApiData
  };

  return result;
};
