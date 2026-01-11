import { useRef, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import { fetchOptimizedTelemetry } from '../store/telemetrySlice';
import { selectIsLiveMode } from '../store/liveDataSlice';
import { selectMaxLiveReadings } from '../store/telemetrySlice';
import { createOptimizedTelemetryRequest, CreateOptimizedRequestOptions } from '../utils/optimizationUtils';

interface DataFetchParams {
  sensorIds: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
  pageContext?: 'analytics' | 'solo-view' | 'dashboard';
  chartType?: string;
}

/**
 * Custom hook to optimize telemetry data fetching with:
 * - Request cancellation for stale requests
 * - Throttling to prevent rapid API calls
 * - Memory of last successful request
 * - Backend optimization with proper context
 */
export const useOptimizedDataFetch = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isLiveMode = useSelector(selectIsLiveMode);
  const maxLiveReadings = useSelector(selectMaxLiveReadings);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<string>('');
  const throttleTimeoutRef = useRef<NodeJS.Timeout>();
  const requestInProgressRef = useRef<boolean>(false);
  
  const fetchData = useCallback((params: DataFetchParams, immediate = false) => {
    // In live mode, add +1 minute buffer to end time to account for network latency
    // This ensures we don't miss any readings due to timing differences
    const endTime = isLiveMode 
      ? new Date(params.timeRange.end.getTime() + (5 * 60 * 1000)) // +5 minute buffer for live mode
      : params.timeRange.end;
    
    // Create optimized request with context
    const optimizedRequest = createOptimizedTelemetryRequest({
      sensorIds: params.sensorIds,
      timeRange: {
        start: params.timeRange.start.toISOString(),
        end: endTime.toISOString()
      },
      context: {
        page: params.pageContext || 'analytics',
        chartType: (params.chartType as any) || 'line-chart',
      },
      liveMode: isLiveMode ? { enabled: true, maxReadings: Math.min(maxLiveReadings, 100) } : undefined
    });
    
    // Include isLiveMode in requestId to differentiate live vs offline requests
    // This ensures switching modes triggers a new API call with correct liveMode parameter
    const requestId = `${params.sensorIds.join(',')}-${params.timeRange.start.toISOString()}-${params.timeRange.end.toISOString()}-${params.pageContext || 'analytics'}-${isLiveMode ? 'live' : 'offline'}`;
    
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

      // Dispatch the optimized fetch action
      dispatch(fetchOptimizedTelemetry(optimizedRequest))
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
  }, [dispatch, isLiveMode, maxLiveReadings]);
  
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
