/**
 * High-Performance Telemetry Hook with Level-of-Detail (LOD)
 * Manages Web Worker lifecycle, request versioning, debouncing, and cancellation
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { WORKER_CONFIG, PERFORMANCE_THRESHOLDS, UI_CONFIG, ENVIRONMENT_CONFIG } from '../constants/performance-config';

// Quality modes for user-controlled performance vs fidelity
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
  // Core methods
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
  
  // State
  isWorkerReady: boolean;
  isProcessing: boolean;
  error: string | null;
  stats: TelemetryStats | null;
  config: TelemetryLODConfig;
  activeRequests: number;
  
  // Config methods
  qualityMode: QualityMode;
  setQualityMode: (mode: QualityMode) => void;
  
  // Fallback indicator
  isFallbackMode: boolean;
}

// Default configuration based on quality mode
const getConfigForQualityMode = (mode: QualityMode): Partial<TelemetryLODConfig> => {
  switch (mode) {
    case 'performance':
      return {
        maxConcurrentRequests: 1,
        debounceMs: 300,
      };
    case 'balanced':
      return {
        maxConcurrentRequests: 2,
        debounceMs: UI_CONFIG.DEBOUNCE_STANDARD_MS,
      };
    case 'quality':
      return {
        maxConcurrentRequests: 3,
        debounceMs: 100,
      };
  }
};

// Performance observer for long tasks
class PerformanceMonitor {
  private longTasksCount = 0;
  private observer: PerformanceObserver | null = null;

  constructor() {
    if ('PerformanceObserver' in window && 'observe' in PerformanceObserver.prototype) {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.longTasksCount++;
              console.warn(`⚠️ Long task detected: ${entry.duration}ms`);
            }
          }
        });
        this.observer.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        console.warn('⚠️ PerformanceObserver not supported for longtask');
      }
    }
  }

  getLongTasksCount(): number {
    return this.longTasksCount;
  }

  reset(): void {
    this.longTasksCount = 0;
  }

  dispose(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}

// Main-thread fallback implementation
class MainThreadFallback {
  private seriesData = new Map<string, { timestamps: number[]; values: number[] }>();

  appendData(seriesId: string, data: { timestamp: number; value: number }[]): void {
    const existing = this.seriesData.get(seriesId) || { timestamps: [], values: [] };
    
    // Append new data
    for (const point of data) {
      existing.timestamps.push(point.timestamp);
      existing.values.push(point.value);
    }
    
    // Sort by timestamp
    const combined = existing.timestamps.map((t, i) => ({ t, v: existing.values[i] }))
      .sort((a, b) => a.t - b.t);
    
    existing.timestamps = combined.map(p => p.t);
    existing.values = combined.map(p => p.v);
    
    this.seriesData.set(seriesId, existing);
    
    // Limit points to prevent memory issues (stride sampling)
    if (existing.timestamps.length > PERFORMANCE_THRESHOLDS.LOD_DECIMATION) {
      const step = Math.ceil(existing.timestamps.length / PERFORMANCE_THRESHOLDS.TABLE_VIRTUALIZATION);
      const sampled: { timestamps: number[]; values: number[] } = { timestamps: [], values: [] };
      
      for (let i = 0; i < existing.timestamps.length; i += step) {
        sampled.timestamps.push(existing.timestamps[i]);
        sampled.values.push(existing.values[i]);
      }
      
      this.seriesData.set(seriesId, sampled);
      console.warn(`⚠️ Fallback: Sampled series ${seriesId} from ${existing.timestamps.length} to ${sampled.timestamps.length} points`);
    }
  }

  getDecimated(
    seriesIds: string[],
    startTs: number,
    endTs: number,
    widthPx: number
  ): Record<string, DecimatedPoint[]> {
    const result: Record<string, DecimatedPoint[]> = {};
    // NEW: Respect ultra-high precision requests (8K width = show ALL points)
    const maxPts = widthPx >= WORKER_CONFIG.MAX_PIXEL_WIDTH ? 
      Infinity : // Ultra-high precision: No limit, show ALL points
      Math.min(10000, widthPx * 4); // High precision: 4 points per pixel max
    
    for (const seriesId of seriesIds) {
      const series = this.seriesData.get(seriesId);
      if (!series) {
        result[seriesId] = [];
        continue;
      }
      
      // Simple time range filtering
      const points: DecimatedPoint[] = [];
      for (let i = 0; i < series.timestamps.length; i++) {
        const t = series.timestamps[i];
        if (t >= startTs && t <= endTs) {
          points.push({ t, v: series.values[i] });
        }
      }
      
      // Simple stride sampling if too many points
      if (points.length > maxPts) {
        const step = Math.ceil(points.length / maxPts);
        const sampled: DecimatedPoint[] = [];
        
        for (let i = 0; i < points.length; i += step) {
          sampled.push(points[i]);
        }
        
        // Always include last point
        if (points.length > 0 && (points.length - 1) % step !== 0) {
          sampled.push(points[points.length - 1]);
        }
        
        result[seriesId] = sampled;
      } else {
        result[seriesId] = points;
      }
    }
    
    return result;
  }

  clearAll(): void {
    this.seriesData.clear();
  }

  getStats(): { seriesCount: number; totalPoints: number } {
    let totalPoints = 0;
    for (const series of this.seriesData.values()) {
      totalPoints += series.timestamps.length;
    }
    
    return {
      seriesCount: this.seriesData.size,
      totalPoints
    };
  }
}

export function useTelemetryLOD(initialConfig?: Partial<TelemetryLODConfig>): UseTelemetryLODReturn {
  // Configuration state
  const [qualityMode, setQualityMode] = useState<QualityMode>('balanced');
  const config: TelemetryLODConfig = {
    qualityMode,
    maxConcurrentRequests: UI_CONFIG.MAX_CONCURRENT_REQUESTS,
    debounceMs: UI_CONFIG.DEBOUNCE_STANDARD_MS,
    fallbackToMainThread: false,
    ...getConfigForQualityMode(qualityMode),
    ...initialConfig,
  };

  // State
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);

  // Refs
  const workerRef = useRef<Worker | null>(null);
  const reqSeqRef = useRef(0);
  const pendingRequests = useRef(new Map<number, { resolve: any; reject: any }>());
  const debounceTimeouts = useRef(new Map<string, NodeJS.Timeout>());
  const performanceMonitor = useRef<PerformanceMonitor | null>(null);
  const fallbackProcessor = useRef<MainThreadFallback | null>(null);

  // Initialize worker and performance monitoring
  useEffect(() => {
    let mounted = true;

    const initializeWorker = async () => {
      try {
        // Initialize performance monitor
        performanceMonitor.current = new PerformanceMonitor();
        
        // Initialize fallback processor
        fallbackProcessor.current = new MainThreadFallback();

        // Try to create worker with environment-aware file extension
        const isDev = import.meta.env.DEV;
        const workerPath = isDev 
          ? '../workers/telemetry.worker.ts'  // Development: Load TypeScript directly
          : '../workers/telemetry.worker.js'; // Production: Load compiled JavaScript
        
        console.log(`🔧 Loading telemetry worker: ${workerPath} (${isDev ? 'development' : 'production'} mode)`);
        
        const worker = new Worker(
          new URL(workerPath, import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = (event) => {
          const { type, requestId, payload, stats: workerStats, error: workerError } = event.data;

          if (type === 'error') {
            console.error('❌ Worker error:', workerError);
            setError(workerError);
            
            // Reject pending request
            const pending = pendingRequests.current.get(requestId);
            if (pending) {
              pending.reject(new Error(workerError));
              pendingRequests.current.delete(requestId);
            }
            return;
          }

          // Handle responses
          const pending = pendingRequests.current.get(requestId);
          if (!pending) return; // Request was cancelled or timed out

          pending.resolve({ payload, stats: workerStats });
          pendingRequests.current.delete(requestId);

          // Update processing state
          if (pendingRequests.current.size === 0) {
            setIsProcessing(false);
          }

          // Update stats if provided
          if (workerStats) {
            setStats(prev => ({
              ...prev,
              ...workerStats,
              longTasksCount: performanceMonitor.current?.getLongTasksCount() || 0,
              memoryUsageMB: prev?.memoryUsageMB || 0,
              seriesCount: prev?.seriesCount || 0,
            }));
          }
        };

        worker.onerror = (event) => {
          console.error('❌ Worker initialization error:', event);
          console.error(`❌ Failed to load worker from: ${workerPath}`);
          setError(`Worker failed to initialize: ${event.message || 'Unknown error'}`);
          setIsFallbackMode(true);
        };

        // Test worker with a simple message
        worker.postMessage({ type: 'stats', requestId: -1 });

        if (mounted) {
          workerRef.current = worker;
          setIsWorkerReady(true);
          setError(null);
          console.log(`🚀 Telemetry Worker initialized successfully (${isDev ? 'dev' : 'prod'} mode)`);
        }

      } catch (err) {
        console.error('❌ Failed to initialize telemetry worker:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize worker');
          setIsFallbackMode(true);
        }
      }
    };

    initializeWorker();

    return () => {
      mounted = false;
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (performanceMonitor.current) {
        performanceMonitor.current.dispose();
        performanceMonitor.current = null;
      }
      // Clear pending requests
      for (const { reject } of pendingRequests.current.values()) {
        reject(new Error('Component unmounted'));
      }
      pendingRequests.current.clear();
      // Clear debounce timeouts
      for (const timeout of debounceTimeouts.current.values()) {
        clearTimeout(timeout);
      }
      debounceTimeouts.current.clear();
    };
  }, []);

  // Generic method to send requests to worker with versioning
  const sendWorkerRequest = useCallback(async (
    message: any,
    timeoutMs = 30000
  ): Promise<any> => {
    // Use fallback if in fallback mode
    if (isFallbackMode || !isWorkerReady || !workerRef.current) {
      throw new Error('Worker not available, using fallback');
    }

    const requestId = ++reqSeqRef.current;
    const messageWithId = { ...message, requestId };

    setIsProcessing(true);

    return new Promise((resolve, reject) => {
      // Store request
      pendingRequests.current.set(requestId, { resolve, reject });

      // Set timeout
      const timeout = setTimeout(() => {
        pendingRequests.current.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Override resolve/reject to clear timeout
      const originalResolve = resolve;
      const originalReject = reject;
      
      pendingRequests.current.set(requestId, {
        resolve: (result: any) => {
          clearTimeout(timeout);
          originalResolve(result);
        },
        reject: (error: any) => {
          clearTimeout(timeout);
          originalReject(error);
        }
      });

      // Send message
      try {
        workerRef.current!.postMessage(messageWithId);
      } catch (err) {
        pendingRequests.current.delete(requestId);
        clearTimeout(timeout);
        reject(err);
      }
    });
  }, [isFallbackMode, isWorkerReady]);

  // Append data method
  const appendData = useCallback(async (
    seriesId: string,
    data: { timestamp: number; value: number }[]
  ): Promise<void> => {
    if (data.length === 0) return;

    try {
      if (isFallbackMode || !isWorkerReady) {
        // Use fallback
        fallbackProcessor.current?.appendData(seriesId, data);
        return;
      }

      // Convert to TypedArrays for worker
      const timestamps = new Float64Array(data.map(p => p.timestamp));
      const values = new Float32Array(data.map(p => p.value));

      await sendWorkerRequest({
        type: 'append',
        seriesId,
        timestamps,
        values
      });

    } catch (err) {
      console.error(`❌ Failed to append data for series ${seriesId}:`, err);
      // Fallback on error
      fallbackProcessor.current?.appendData(seriesId, data);
      setIsFallbackMode(true);
    }
  }, [isFallbackMode, isWorkerReady, sendWorkerRequest]);

  // Get decimated data with debouncing
  const getDecimated = useCallback(async (params: {
    seriesIds: string[];
    startTs: number;
    endTs: number;
    widthPx: number;
  }): Promise<Record<string, DecimatedPoint[]>> => {
    const { seriesIds, startTs, endTs, widthPx } = params;
    const debounceKey = `decimate-${seriesIds.join(',')}-${startTs}-${endTs}-${widthPx}`;

    // Cancel previous debounced request
    const existingTimeout = debounceTimeouts.current.get(debounceKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(async () => {
        debounceTimeouts.current.delete(debounceKey);
        
        try {
          console.log(`🎯 LOD decimation requested: series=${seriesIds.length}, range=${new Date(startTs).toLocaleTimeString()}-${new Date(endTs).toLocaleTimeString()}, width=${widthPx}px`);
          
          if (isFallbackMode || !isWorkerReady) {
            console.log('⚡ Using fallback processor (worker not ready)');
            const result = fallbackProcessor.current?.getDecimated(seriesIds, startTs, endTs, widthPx) || {};
            resolve(result);
            return;
          }

          console.log('🔄 Sending decimation request to worker...');
          const startTime = performance.now();
          
          const { payload } = await sendWorkerRequest({
            type: 'decimate',
            seriesIds,
            startTs,
            endTs,
            widthPx,
            sync: true
          });

          const processingTime = Math.round(performance.now() - startTime);
          const totalPoints = Object.values(payload).reduce((sum: number, points) => sum + (Array.isArray(points) ? points.length : 0), 0);
          console.log(`✅ Worker decimation complete: ${totalPoints} points in ${processingTime}ms`);

          resolve(payload);
        } catch (err) {
          console.error('❌ Decimation failed:', err);
          // Fallback on error
          try {
            const result = fallbackProcessor.current?.getDecimated(seriesIds, startTs, endTs, widthPx) || {};
            setIsFallbackMode(true);
            resolve(result);
          } catch (fallbackErr) {
            reject(fallbackErr);
          }
        }
      }, config.debounceMs);

      debounceTimeouts.current.set(debounceKey, timeout);
    });
  }, [isFallbackMode, isWorkerReady, sendWorkerRequest, config.debounceMs]);

  // Get raw slice for zoomed views
  const getRawSlice = useCallback(async (params: {
    seriesId: string;
    startTs: number;
    endTs: number;
    maxPoints?: number;
  }): Promise<DecimatedPoint[]> => {
    const { seriesId, startTs, endTs, maxPoints = 20000 } = params;

    try {
      if (isFallbackMode || !isWorkerReady) {
        // Use fallback - just return decimated data
        const result = fallbackProcessor.current?.getDecimated([seriesId], startTs, endTs, maxPoints) || {};
        return result[seriesId] || [];
      }

      const { payload } = await sendWorkerRequest({
        type: 'rawSlice',
        seriesId,
        startTs,
        endTs,
        maxPoints
      });

      return payload;
    } catch (err) {
      console.error(`❌ Raw slice failed for series ${seriesId}:`, err);
      // Fallback
      const result = fallbackProcessor.current?.getDecimated([seriesId], startTs, endTs, maxPoints) || {};
      setIsFallbackMode(true);
      return result[seriesId] || [];
    }
  }, [isFallbackMode, isWorkerReady, sendWorkerRequest]);

  // Clear all data
  const clearAll = useCallback(async (): Promise<void> => {
    try {
      fallbackProcessor.current?.clearAll();
      
      if (!isFallbackMode && isWorkerReady) {
        await sendWorkerRequest({ type: 'reset' });
      }
    } catch (err) {
      console.error('❌ Failed to clear all data:', err);
    }
  }, [isFallbackMode, isWorkerReady, sendWorkerRequest]);

  // Get stats
  const getStats = useCallback(async (): Promise<TelemetryStats> => {
    try {
      if (isFallbackMode || !isWorkerReady) {
        const fallbackStats = fallbackProcessor.current?.getStats() || { seriesCount: 0, totalPoints: 0 };
        return {
          pointsProcessed: fallbackStats.totalPoints,
          pointsReturned: fallbackStats.totalPoints,
          processingTimeMs: 0,
          memoryUsageMB: (fallbackStats.totalPoints * 12) / (1024 * 1024), // Rough estimate
          seriesCount: fallbackStats.seriesCount,
          longTasksCount: performanceMonitor.current?.getLongTasksCount() || 0,
          cacheHits: 0,
        };
      }

      const { payload } = await sendWorkerRequest({ type: 'stats' });
      
      return {
        pointsProcessed: 0,
        pointsReturned: 0,
        processingTimeMs: 0,
        memoryUsageMB: payload.totalMemoryBytes / (1024 * 1024),
        seriesCount: payload.seriesCount,
        longTasksCount: performanceMonitor.current?.getLongTasksCount() || 0,
        cacheHits: payload.cacheHits || 0,
      };
    } catch (err) {
      console.error('❌ Failed to get stats:', err);
      return {
        pointsProcessed: 0,
        pointsReturned: 0,
        processingTimeMs: 0,
        memoryUsageMB: 0,
        seriesCount: 0,
        longTasksCount: 0,
        cacheHits: 0,
      };
    }
  }, [isFallbackMode, isWorkerReady, sendWorkerRequest]);

  return {
    // Core methods
    appendData,
    getDecimated,
    getRawSlice,
    clearAll,
    getStats,

    // State
    isWorkerReady,
    isProcessing,
    error,
    stats,
    config,
    activeRequests: pendingRequests.current.size,

    // Config methods
    qualityMode,
    setQualityMode,

    // Fallback indicator
    isFallbackMode,
  };
}
