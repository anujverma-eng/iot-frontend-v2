/**
 * 🚀 Centralized Chart Data Hook - Backend Optimized
 * 
 * This hook now uses backend optimization instead of client-side processing.
 * It provides the same interface but with backend-optimized data.
 * 
 * Benefits:
 * ✅ Eliminated client-side processing overhead
 * ✅ Consistent backend optimization across all charts
 * ✅ Reduced memory usage and processing time
 * ✅ Better scalability for large datasets
 */

import React from 'react';
import { useSelector } from 'react-redux';
import { ChartConfig } from '../types/sensor';
import { 
  selectTelemetryData, 
  selectTelemetryLoading,
} from '../store/telemetrySlice';

export interface OptimizedChartData {
  // Raw data (for reference)
  originalData: Array<{ timestamp: number; value: number }>;
  originalCount: number;
  
  // Optimized data (for rendering)
  optimizedData: Array<{ timestamp: number; value: number }>;
  optimizedCount: number;
  
  // Optimization stats
  decimationRatio: number;
  processingTimeMs: number;
  optimizationLevel: string;
  
  // Data quality indicators
  hasData: boolean;
  isProcessing: boolean;
  memoryFootprintMB: number;
}

export interface UseOptimizedChartDataOptions {
  enableWorkerProcessing?: boolean;
  qualityMode?: 'performance' | 'balanced' | 'quality';
  forceOptimization?: boolean;
}

export function useOptimizedChartData(
  config: ChartConfig | null,
  options: UseOptimizedChartDataOptions = {}
): OptimizedChartData {
  // Get telemetry data from Redux (already optimized by backend)
  const telemetryData = useSelector(selectTelemetryData);
  const isLoading = useSelector(selectTelemetryLoading);

  // Process backend-optimized data
  const optimizedResult = React.useMemo(() => {
    const startTime = performance.now();
    
    // Handle loading state
    if (isLoading) {
      return {
        originalData: [],
        originalCount: 0,
        optimizedData: [],
        optimizedCount: 0,
        decimationRatio: 1,
        processingTimeMs: 0,
        optimizationLevel: 'BACKEND_OPTIMIZED',
        hasData: false,
        isProcessing: true,
        memoryFootprintMB: 0
      };
    }

    // Handle no config case
    if (!config || !config.series || config.series.length === 0) {
      return {
        originalData: [],
        originalCount: 0,
        optimizedData: [],
        optimizedCount: 0,
        decimationRatio: 1,
        processingTimeMs: 0,
        optimizationLevel: 'NONE',
        hasData: false,
        isProcessing: false,
        memoryFootprintMB: 0
      };
    }

    // Use the series data directly from config (already optimized)
    // NOTE: Live mode slicing is already handled by the parent component (solo-view.tsx, analytics.tsx)
    // based on per-sensor historical mode. Do NOT slice again here based on global isLiveMode
    // as that would incorrectly limit data for sensors that are in historical/offline mode.
    let seriesData = config.series || [];
    
    if (!seriesData.length) {
      return {
        originalData: [],
        originalCount: 0,
        optimizedData: [],
        optimizedCount: 0,
        decimationRatio: 1,
        processingTimeMs: 0,
        optimizationLevel: 'NO_DATA',
        hasData: false,
        isProcessing: false,
        memoryFootprintMB: 0
      };
    }
    
    // Data is already in the right format, just ensure timestamp is number
    const optimizedData = seriesData.map(point => ({
      timestamp: typeof point.timestamp === 'number' ? point.timestamp : new Date(point.timestamp).getTime(),
      value: point.value
    }));
    
    const processingTime = performance.now() - startTime;
    const optimizedCount = optimizedData.length;
    
    // Backend data is already optimized, so original count is estimated based on data density
    const originalCount = optimizedCount; // Backend already did the optimization
    
    // Estimate memory footprint
    const memoryFootprintMB = (optimizedCount * (8 + 4 + 8)) / (1024 * 1024); // timestamp + value + overhead

    const result = {
      originalData: optimizedData, // Backend-optimized data is our "original"
      originalCount,
      optimizedData,
      optimizedCount,
      decimationRatio: 1, // Backend already optimized
      processingTimeMs: processingTime,
      optimizationLevel: 'BACKEND_OPTIMIZED',
      hasData: optimizedCount > 0,
      isProcessing: false,
      memoryFootprintMB
    };

    // Log minimal processing time since backend did the heavy lifting
    if (processingTime > 10) {
    }

    return result;
  }, [config, telemetryData, isLoading]);

  return optimizedResult;
}

// Utility function to create optimized config from result
export function createOptimizedChartConfig(
  baseConfig: ChartConfig,
  optimizedData: OptimizedChartData
): ChartConfig {
  return {
    ...baseConfig,
    series: optimizedData.optimizedData
  };
}