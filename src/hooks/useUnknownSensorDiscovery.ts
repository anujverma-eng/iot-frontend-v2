import { useEffect, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { fetchSensorDetails } from '../store/sensorsSlice';
import { clearUnknownSensor } from '../store/telemetrySlice';
import { useAppDispatch } from './useAppDispatch';

/**
 * Hook to handle auto-discovery of unknown sensors with rate limiting
 * This hook monitors the telemetry state for unknown sensor MACs and 
 * attempts to fetch their details in the background
 */
export const useUnknownSensorDiscovery = () => {
  const dispatch = useAppDispatch();
  
  // Use stable selectors to minimize re-renders
  const { unknownSensors, isLiveMode } = useSelector((state: RootState) => ({
    unknownSensors: state.telemetry.unknownSensors,
    isLiveMode: state.telemetry.isLiveMode
  }));
  
  // Track sensors currently being processed to prevent duplicates
  const processingRef = useRef(new Set<string>());
  const processedRef = useRef(new Set<string>());
  
  // Create a stable reference to unknownSensors to prevent unnecessary re-renders
  const unknownSensorsString = useMemo(() => JSON.stringify(unknownSensors), [unknownSensors]);

  useEffect(() => {
    console.log(`[useUnknownSensorDiscovery] Hook triggered - isLiveMode: ${isLiveMode}, unknownSensors:`, unknownSensors);
    
    // Only process unknown sensors in live mode
    if (!isLiveMode || unknownSensors.length === 0) {
      return;
    }

    console.log(`[useUnknownSensorDiscovery] Processing ${unknownSensors.length} unknown sensors:`, unknownSensors);

    // Process sensors one by one with delay to prevent API spam
    const processSensorSequentially = async (sensors: string[]) => {
      for (const mac of sensors) {
        // Skip if already processed or currently processing
        if (processingRef.current.has(mac) || processedRef.current.has(mac)) {
          console.log(`[useUnknownSensorDiscovery] Skipping ${mac} - already processed or processing`);
          continue;
        }

        // Mark as processing
        processingRef.current.add(mac);
        
        try {
          console.log(`[useUnknownSensorDiscovery] Attempting to fetch details for unknown sensor: ${mac}`);
          
          // Attempt to fetch sensor details
          const result = await dispatch(fetchSensorDetails(mac));
          
          // If successful, remove from unknown list
          if (fetchSensorDetails.fulfilled.match(result)) {
            console.log(`[useUnknownSensorDiscovery] Successfully discovered sensor: ${mac}`);
            dispatch(clearUnknownSensor(mac));
            processedRef.current.add(mac);
          } else if (fetchSensorDetails.rejected.match(result)) {
            // If failed, also remove from list to avoid repeated attempts
            console.log(`[useUnknownSensorDiscovery] Failed to discover sensor ${mac}, removing from list:`, result.error);
            dispatch(clearUnknownSensor(mac));
            processedRef.current.add(mac);
          }
        } catch (error) {
          console.error(`[useUnknownSensorDiscovery] Error processing unknown sensor ${mac}:`, error);
          // Remove from list on error to prevent repeated failures
          dispatch(clearUnknownSensor(mac));
          processedRef.current.add(mac);
        } finally {
          // Remove from processing set
          processingRef.current.delete(mac);
        }

        // Add delay between requests to prevent API spam
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };

    // Filter out sensors that are already being processed or have been processed
    const sensorsToProcess = unknownSensors.filter(
      mac => !processingRef.current.has(mac) && !processedRef.current.has(mac)
    );

    if (sensorsToProcess.length > 0) {
      processSensorSequentially(sensorsToProcess);
    }
  }, [dispatch, unknownSensorsString, isLiveMode]); // Use string comparison for unknownSensors

  return {
    unknownSensorsCount: unknownSensors.length,
    isProcessing: unknownSensors.length > 0,
  };
};
