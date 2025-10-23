/**
 * Simplified Telemetry Hook - Backend Optimized
 * 
 * This hook now provides a simplified interface since backend handles optimization.
 * Maintains compatibility with existing components during migration.
 */

import { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectTelemetryData, selectMaxLiveReadings } from '../store/telemetrySlice';
import { selectIsLiveMode } from '../store/liveDataSlice';

// Simplified quality modes for backward compatibility
export type QualityMode = 'performance' | 'balanced' | 'quality';

export interface TelemetryLODConfig {
  qualityMode: QualityMode;
  maxConcurrentRequests: number;
  debounceMs: number;
  fallbackToMainThread: boolean;
}

export interface DecimatedPoint {
  t: number; // timestamp
  v: number; // value
}

export interface TelemetryStats {
  pointsProcessed: number;
  pointsReturned: number;
  processingTimeMs: number;
  memoryUsageMB: number;
  seriesCount: number;
  longTasksCount: number;
  cacheHits: number;
}

export interface UseTelemetryLODReturn {
  // Core methods (simplified - backend handles optimization)
  appendData: (seriesId: string, data: { timestamp: number; value: number }[]) => Promise<void>;
  getDecimated: (params: {
    seriesIds: string[];
    startTs: number;
    endTs: number;
    widthPx: number;
  }) => Promise<Record<string, DecimatedPoint[]>>;
  getRawSlice: (params: {
    seriesId: string;
    startTs: number;
    endTs: number;
    maxPoints?: number;
  }) => Promise<DecimatedPoint[]>;
  clearAll: () => Promise<void>;
  getStats: () => Promise<TelemetryStats>;
  
  // State (simplified for backward compatibility)
  isWorkerReady: boolean;
  isProcessing: boolean;
  error: string | null;
  stats: TelemetryStats | null;
  config: TelemetryLODConfig;
  activeRequests: number;
  
  // Config methods
  qualityMode: QualityMode;
  setQualityMode: (mode: QualityMode) => void;
  
  // Fallback indicator (always false since backend handles optimization)
  isFallbackMode: boolean;
}

/**
 * Simplified LOD Hook Implementation
 * Uses backend-optimized telemetry data from Redux store
 */
export function useTelemetryLOD(): UseTelemetryLODReturn {
  const telemetryData = useSelector(selectTelemetryData);
  const isLiveMode = useSelector(selectIsLiveMode);
  const maxLiveReadings = useSelector(selectMaxLiveReadings);
  
  const [qualityMode, setQualityMode] = useState<QualityMode>('balanced');
  const [isProcessing, setIsProcessing] = useState(false);

  const config: TelemetryLODConfig = {
    qualityMode,
    maxConcurrentRequests: 1, // Simplified since backend handles optimization
    debounceMs: 200,
    fallbackToMainThread: false
  };

  // Simplified methods that work with backend-optimized data
  const appendData = useCallback(async (seriesId: string, data: { timestamp: number; value: number }[]) => {
    // In backend-optimized approach, data is managed by Redux
    // This is a no-op for backward compatibility
  }, []);

  const getDecimated = useCallback(async (params: {
    seriesIds: string[];
    startTs: number;
    endTs: number;
    widthPx: number;
  }): Promise<Record<string, DecimatedPoint[]>> => {
    setIsProcessing(true);
    
    try {
      const result: Record<string, DecimatedPoint[]> = {};
      
      for (const seriesId of params.seriesIds) {
        if (telemetryData[seriesId] && telemetryData[seriesId].series) {
          let sensorSeries = telemetryData[seriesId].series;
          
          // Apply live mode slicing if needed
          if (isLiveMode && sensorSeries.length > maxLiveReadings) {
            sensorSeries = sensorSeries.slice(-maxLiveReadings);
          }
          
          // Filter by time range and convert format
          result[seriesId] = sensorSeries
            .filter((point: any) => {
              const timestamp = typeof point.timestamp === 'number' ? point.timestamp : new Date(point.timestamp).getTime();
              return timestamp >= params.startTs && timestamp <= params.endTs;
            })
            .map((point: any) => ({
              t: typeof point.timestamp === 'number' ? point.timestamp : new Date(point.timestamp).getTime(),
              v: point.value
            }));
        }
      }
      
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [telemetryData, isLiveMode, maxLiveReadings]);

  const getRawSlice = useCallback(async (params: {
    seriesId: string;
    startTs: number;
    endTs: number;
    maxPoints?: number;
  }): Promise<DecimatedPoint[]> => {
    setIsProcessing(true);
    
    try {
      if (!telemetryData[params.seriesId] || !telemetryData[params.seriesId].series) {
        return [];
      }
      
      let sensorSeries = telemetryData[params.seriesId].series;
      
      // Apply live mode slicing if needed
      if (isLiveMode && sensorSeries.length > maxLiveReadings) {
        sensorSeries = sensorSeries.slice(-maxLiveReadings);
      }
      
      // Filter by time range
      let result = sensorSeries
        .filter((point: any) => {
          const timestamp = typeof point.timestamp === 'number' ? point.timestamp : new Date(point.timestamp).getTime();
          return timestamp >= params.startTs && timestamp <= params.endTs;
        })
        .map((point: any) => ({
          t: typeof point.timestamp === 'number' ? point.timestamp : new Date(point.timestamp).getTime(),
          v: point.value
        }));
      
      // Apply max points limit if specified
      if (params.maxPoints && result.length > params.maxPoints) {
        const step = Math.ceil(result.length / params.maxPoints);
        result = result.filter((_: any, index: number) => index % step === 0);
      }
      
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [telemetryData, isLiveMode, maxLiveReadings]);

  const clearAll = useCallback(async () => {
    // No-op since backend manages data
  }, []);

  const getStats = useCallback(async (): Promise<TelemetryStats> => {
    const totalPoints = Object.values(telemetryData).reduce((sum, data) => sum + (data.series?.length || 0), 0);
    
    return {
      pointsProcessed: totalPoints,
      pointsReturned: totalPoints,
      processingTimeMs: 0, // Backend handles processing
      memoryUsageMB: (totalPoints * 16) / (1024 * 1024), // Rough estimate
      seriesCount: Object.keys(telemetryData).length,
      longTasksCount: 0, // No long tasks with backend optimization
      cacheHits: 0
    };
  }, [telemetryData]);

  return {
    // Core methods
    appendData,
    getDecimated,
    getRawSlice,
    clearAll,
    getStats,
    
    // State
    isWorkerReady: true, // Always ready since no Web Worker
    isProcessing,
    error: null,
    stats: null,
    config,
    activeRequests: 0,
    
    // Config methods
    qualityMode,
    setQualityMode,
    
    // Always false since backend handles optimization
    isFallbackMode: false
  };
}