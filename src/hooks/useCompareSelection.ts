import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import { fetchOptimizedTelemetry, selectTelemetryLoading } from '../store/telemetrySlice';
import { addSelectedSensorId, removeSelectedSensorId, selectSelectedSensorIds } from '../store/sensorsSlice';
import { createOptimizedTelemetryRequest } from '../utils/optimizationUtils';

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
  const [isTimeRangeLoading, setIsTimeRangeLoading] = useState(false);
  const batchTimeoutRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeRangeRef = useRef<string>('');
  
  const { timeRange, maxSensors = 10, minSensorsForFetch = 2 } = options;

  const selectedSensorIds = useSelector(selectSelectedSensorIds);

  // Cancel any pending requests
  const cancelPendingRequests = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Clear loading states when telemetry loading completes
  useEffect(() => {
    if (!isLoading) {
      setIsTimeRangeLoading(false);
      // Only clear loading sensors when not loading, but don't clear pendingSelections here
      // pendingSelections should only be cleared after successful fetch or manual cancellation
      if (loadingSensors.size > 0) {
        setLoadingSensors(new Set());
      }
    }
  }, [isLoading, loadingSensors.size]);

  // Handle time range changes for existing sensor selections
  useEffect(() => {
    const currentTimeRangeKey = `${timeRange.start}-${timeRange.end}`;
    
    // Only trigger on time range change, not initial mount
    if (timeRangeRef.current && timeRangeRef.current !== currentTimeRangeKey) {
      // Only fetch if we have enough selected sensors
      if (selectedSensorIds.length >= minSensorsForFetch) {

        
        // Cancel any pending requests
        cancelPendingRequests();
        
        // Show loading state for time range change
        setIsTimeRangeLoading(true);
        
        // Create new abort controller
        abortControllerRef.current = new AbortController();
        
        // Fetch with new time range using optimized endpoint
        setTimeout(() => {
          const request = createOptimizedTelemetryRequest({
            sensorIds: selectedSensorIds,
            timeRange: {
              start: timeRange.start,
              end: timeRange.end
            },
            context: {
              page: 'analytics',
              chartType: 'comparison',
              isComparison: true
            },
            liveMode: undefined // Comparison mode typically doesn't use live mode
          });
          
          dispatch(fetchOptimizedTelemetry(request));
        }, 100); // Short delay to allow UI to show loading state
      }
    }
    
    timeRangeRef.current = currentTimeRangeKey;
  }, [timeRange, selectedSensorIds, minSensorsForFetch, dispatch, cancelPendingRequests]);

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
        
        // Batch the optimized telemetry fetch with minimal debounce for immediate feedback
        batchTimeoutRef.current = setTimeout(() => {
          const request = createOptimizedTelemetryRequest({
            sensorIds: newPending,
            timeRange: {
              start: timeRange.start,
              end: timeRange.end
            },
            context: {
              page: 'analytics',
              chartType: 'comparison',
              isComparison: true
            },
            liveMode: undefined // Comparison mode typically doesn't use live mode
          });
          
          dispatch(fetchOptimizedTelemetry(request));
          
          // Clear pending selections after dispatch
          setPendingSelections([]);
        }, 100); // Reduced debounce for immediate response while still preventing rapid-fire calls
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
          const request = createOptimizedTelemetryRequest({
            sensorIds: newPending,
            timeRange: {
              start: timeRange.start,
              end: timeRange.end
            },
            context: {
              page: 'analytics',
              chartType: 'comparison',
              isComparison: true
            },
            liveMode: undefined // Comparison mode typically doesn't use live mode
          });
          
          dispatch(fetchOptimizedTelemetry(request));
        }, 100); // Reduced debounce for immediate response
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
    isGlobalLoading: isLoading || isTimeRangeLoading,
    loadingSensorCount: loadingSensors.size,
    minSensorsForFetch
  };
};
