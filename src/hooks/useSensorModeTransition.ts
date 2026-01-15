import { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsLiveMode } from '../store/liveDataSlice';
import { 
  selectSensorHistoricalMode, 
  selectMaxLiveReadings,
  fetchOptimizedTelemetry 
} from '../store/telemetrySlice';
import { selectFilters } from '../store/sensorsSlice';
import { createOptimizedTelemetryRequest } from '../utils/optimizationUtils';
import { AppDispatch } from '../store';

type PageContext = 'analytics' | 'solo-view' | 'dashboard';
type ChartType = 'dashboard-card' | 'line-chart' | 'area-chart' | 'scatter-plot' | 'correlation' | 'distribution' | 'trend-analysis' | 'anomaly-detection' | 'comparison';

interface UseSensorModeTransitionOptions {
  sensorId: string | null;
  pageContext: PageContext;
  chartType?: ChartType;
  /** If true, the hook will not trigger any data fetches (useful for embedded views) */
  disabled?: boolean;
}

/**
 * Hook to handle sensor mode transitions between live and historical modes
 * Automatically fetches the appropriate data when mode changes:
 * - Live → Historical: Fetches historical data for the selected time range
 * - Historical → Live: Fetches recent data (end + 5min buffer) then MQTT appends new readings
 */
export const useSensorModeTransition = ({
  sensorId,
  pageContext,
  chartType = 'line-chart',
  disabled = false,
}: UseSensorModeTransitionOptions) => {
  const dispatch = useDispatch<AppDispatch>();
  
  const globalIsLiveMode = useSelector(selectIsLiveMode);
  const sensorHistoricalMode = useSelector(selectSensorHistoricalMode);
  const maxLiveReadings = useSelector(selectMaxLiveReadings);
  const filters = useSelector(selectFilters);
  
  // Track previous mode for the specific sensor
  const previousModeRef = useRef<{ sensorId: string | null; isHistorical: boolean } | null>(null);
  
  // Calculate current effective mode for this sensor
  const isCurrentSensorInHistoricalMode = sensorId ? (sensorHistoricalMode[sensorId] || false) : false;
  const isCurrentSensorLive = globalIsLiveMode && !isCurrentSensorInHistoricalMode;
  
  // Fetch historical data for the sensor
  const fetchHistoricalData = useCallback((targetSensorId: string) => {
    const request = createOptimizedTelemetryRequest({
      sensorIds: [targetSensorId],
      timeRange: {
        start: filters.timeRange.start.toISOString(),
        end: filters.timeRange.end.toISOString(),
      },
      context: {
        page: pageContext,
        chartType: chartType,
        isComparison: false,
      },
      // No liveMode - fetch pure historical data
      liveMode: undefined,
    });
    
    dispatch(fetchOptimizedTelemetry(request));
  }, [dispatch, filters.timeRange, pageContext, chartType]);
  
  // Fetch recent data for live mode (with buffer to prevent gaps)
  const fetchLiveInitialData = useCallback((targetSensorId: string) => {
    // When switching to live mode, fetch recent data with end time + 5 minute buffer
    // This ensures we get the latest readings before MQTT starts appending
    const now = new Date();
    const endWithBuffer = new Date(now.getTime() + 5 * 60 * 1000); // +5 minute buffer
    
    const request = createOptimizedTelemetryRequest({
      sensorIds: [targetSensorId],
      timeRange: {
        start: filters.timeRange.start.toISOString(),
        end: endWithBuffer.toISOString(),
      },
      context: {
        page: pageContext,
        chartType: chartType,
        isComparison: false,
      },
      liveMode: { enabled: true, maxReadings: maxLiveReadings },
    });
    
    dispatch(fetchOptimizedTelemetry(request));
  }, [dispatch, filters.timeRange, pageContext, chartType, maxLiveReadings]);
  
  // Detect mode transitions and trigger appropriate data fetches
  useEffect(() => {
    if (disabled || !sensorId) {
      previousModeRef.current = null;
      return;
    }
    
    const prevMode = previousModeRef.current;
    const currentIsHistorical = isCurrentSensorInHistoricalMode;
    
    // Update ref for next comparison
    previousModeRef.current = { sensorId, isHistorical: currentIsHistorical };
    
    // Skip if this is the first render or sensor changed (let other effects handle initial load)
    if (!prevMode || prevMode.sensorId !== sensorId) {
      return;
    }
    
    // Detect transition: Live → Historical
    if (!prevMode.isHistorical && currentIsHistorical) {
      // User switched to historical mode - fetch historical data
      fetchHistoricalData(sensorId);
    }
    // Detect transition: Historical → Live
    else if (prevMode.isHistorical && !currentIsHistorical) {
      // User switched back to live mode - fetch recent data with buffer
      fetchLiveInitialData(sensorId);
    }
    
  }, [sensorId, isCurrentSensorInHistoricalMode, disabled, fetchHistoricalData, fetchLiveInitialData]);
  
  return {
    isLiveMode: isCurrentSensorLive,
    isHistoricalMode: isCurrentSensorInHistoricalMode,
    globalIsLiveMode,
    fetchHistoricalData,
    fetchLiveInitialData,
  };
};
