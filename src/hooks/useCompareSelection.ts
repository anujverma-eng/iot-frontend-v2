import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import { fetchTelemetry, selectTelemetryLoading } from '../store/telemetrySlice';
import { addSelectedSensorId, removeSelectedSensorId } from '../store/sensorsSlice';

interface CompareSelectionOptions {
  timeRange: {
    start: string;
    end: string;
  };
  maxSensors?: number;
  minSensorsForFetch?: number; // Minimum sensors required before fetching data
}

/**
 * Hook to manage sensor selection for comparison mode with optimized loading states
 */
export const useCompareSelection = (options: CompareSelectionOptions) => {
  const dispatch = useDispatch<AppDispatch>();
  const isLoading = useSelector(selectTelemetryLoading);
  
  const [loadingSensors, setLoadingSensors] = useState<Set<string>>(new Set());
  const [pendingSelections, setPendingSelections] = useState<string[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const { timeRange, maxSensors = 10, minSensorsForFetch = 2 } = options;

  // Clear loading states when telemetry loading completes
  useEffect(() => {
    if (!isLoading && pendingSelections.length > 0) {
      setLoadingSensors(new Set());
      setPendingSelections([]);
    }
  }, [isLoading, pendingSelections.length]);

  // Cancel any pending requests
  const cancelPendingRequests = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const addSensorToComparison = useCallback((sensorId: string) => {
    // Cancel any existing requests first
    cancelPendingRequests();
    
    // Add to redux state immediately for UI responsiveness
    dispatch(addSelectedSensorId(sensorId));
    
    // Update pending selections for batching
    setPendingSelections(prev => {
      const newPending = [...prev, sensorId];
      
      // Only show loading and fetch if we have enough sensors
      if (newPending.length >= minSensorsForFetch) {
        // Create new abort controller
        abortControllerRef.current = new AbortController();
        
        // Delay loading state significantly to allow UI to update selection feedback first
        setTimeout(() => {
          setLoadingSensors(new Set(newPending));
        }, 200); // Increased delay to ensure UI renders selection state first
        
        // Batch the telemetry fetch with debounce for stability
        batchTimeoutRef.current = setTimeout(() => {
          dispatch(fetchTelemetry({
            sensorIds: newPending,
            timeRange
          }));
        }, 750); // Increased debounce for better UI responsiveness
      }
      
      return newPending;
    });
  }, [dispatch, timeRange, minSensorsForFetch, cancelPendingRequests]);

  const removeSensorFromComparison = useCallback((sensorId: string) => {
    // Cancel any pending requests
    cancelPendingRequests();
    
    // Remove from redux state immediately for UI responsiveness
    dispatch(removeSelectedSensorId(sensorId));
    
    // Remove from loading state immediately
    setLoadingSensors(prev => {
      const newSet = new Set(prev);
      newSet.delete(sensorId);
      return newSet;
    });
    
    // Remove from pending selections
    setPendingSelections(prev => {
      const newPending = prev.filter(id => id !== sensorId);
      
      // If we still have enough sensors, trigger new fetch
      if (newPending.length >= minSensorsForFetch) {
        // Delay loading state to allow UI to update first
        setTimeout(() => {
          setLoadingSensors(new Set(newPending));
        }, 200); // Increased delay to ensure UI renders selection state first
        
        // Create new abort controller
        abortControllerRef.current = new AbortController();
        
        batchTimeoutRef.current = setTimeout(() => {
          dispatch(fetchTelemetry({
            sensorIds: newPending,
            timeRange
          }));
        }, 750);
      } else {
        // Not enough sensors, clear loading states immediately
        setLoadingSensors(new Set());
      }
      
      return newPending;
    });
  }, [dispatch, minSensorsForFetch, cancelPendingRequests]);

  const isSensorLoading = useCallback((sensorId: string) => {
    return loadingSensors.has(sensorId);
  }, [loadingSensors]);

  const canAddMoreSensors = useCallback((currentCount: number) => {
    return currentCount < maxSensors;
  }, [maxSensors]);

  const shouldShowComparison = useCallback((currentCount: number) => {
    return currentCount >= minSensorsForFetch;
  }, [minSensorsForFetch]);

  // Cleanup timeout and abort controller on unmount
  useEffect(() => {
    return () => {
      cancelPendingRequests();
    };
  }, [cancelPendingRequests]);

  return {
    addSensorToComparison,
    removeSensorFromComparison,
    isSensorLoading,
    canAddMoreSensors,
    shouldShowComparison,
    isGlobalLoading: isLoading,
    loadingSensorCount: loadingSensors.size,
    minSensorsForFetch
  };
};
