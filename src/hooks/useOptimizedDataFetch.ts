import { useRef, useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store';
import { fetchTelemetry } from '../store/telemetrySlice';

interface DataFetchParams {
  sensorIds: string[];
  timeRange: {
    start: string;
    end: string;
  };
}

/**
 * Custom hook to optimize telemetry data fetching with:
 * - Request cancellation for stale requests
 * - Throttling to prevent rapid API calls
 * - Memory of last successful request
 */
export const useOptimizedDataFetch = () => {
  const dispatch = useDispatch<AppDispatch>();
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<string>('');
  const throttleTimeoutRef = useRef<NodeJS.Timeout>();
  const requestInProgressRef = useRef<boolean>(false);
  
  const fetchData = useCallback((params: DataFetchParams, immediate = false) => {
    const requestId = `${params.sensorIds.join(',')}-${params.timeRange.start}-${params.timeRange.end}`;
    
    // Don't make the same request twice
    if (lastRequestRef.current === requestId) {

      return;
    }
    
    // Clear any pending throttled request
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
    }
    
    const executeFetch = () => {
      // Only cancel existing request if it's actually in progress and different
      if (abortControllerRef.current && requestInProgressRef.current && lastRequestRef.current !== requestId) {

        abortControllerRef.current.abort();
      }
      
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();
      lastRequestRef.current = requestId;
      requestInProgressRef.current = true;

      // Dispatch the fetch action
      dispatch(fetchTelemetry(params))
        .finally(() => {
          requestInProgressRef.current = false;
        });
    };
    
    if (immediate) {
      executeFetch();
    } else {
      // Throttle the request by 200ms to prevent rapid consecutive calls
      throttleTimeoutRef.current = setTimeout(executeFetch, 200);
    }
  }, [dispatch]);
  
  const cancelPendingRequests = useCallback(() => {

    if (abortControllerRef.current && requestInProgressRef.current) {
      abortControllerRef.current.abort();
      requestInProgressRef.current = false;
    }
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelPendingRequests();
    };
  }, [cancelPendingRequests]);
  
  return {
    fetchData,
    cancelPendingRequests
  };
};
