/**
 * Feature flags for IOT Platform - Performance optimizations and experimental features
 * These flags control high-performance modes and optimization thresholds
 */

export type FeatureFlag = 
  | 'BIG_DATA_MODE'
  | 'PERFORMANCE_MONITORING'
  | 'LOD_DECIMATION'
  | 'VIRTUAL_TABLES'
  | 'WORKER_PROCESSING'
  | 'AGGRESSIVE_CACHING'
  | 'CHUNKED_INGESTION'
  | 'TYPED_ARRAYS';

export interface FeatureFlagConfig {
  enabled: boolean;
  threshold?: number;
  metadata?: Record<string, any>;
}

/**
 * Performance feature flags configuration
 * Controls when and how performance optimizations are activated
 */
export const FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  // Master flag for high-performance mode with massive datasets
  BIG_DATA_MODE: {
    enabled: true,
    threshold: 100000, // Points threshold to activate big data optimizations
    metadata: {
      description: 'Enables all performance optimizations for datasets > 100K points',
      maxPoints: 10_000_000, // 10M point target
      performance: 'critical'
    }
  },

  // Performance monitoring and metrics collection
  PERFORMANCE_MONITORING: {
    enabled: true,
    metadata: {
      collectTiming: true,
      memoryTracking: true,
      renderMetrics: true
    }
  },

  // LOD (Level of Detail) decimation system
  LOD_DECIMATION: {
    enabled: true,
    threshold: 50000, // Use decimation for datasets > 50K points
    metadata: {
      worker: true,
      pixelBased: true,
      minMaxBuckets: true
    }
  },

  // Virtual scrolling for large tables
  VIRTUAL_TABLES: {
    enabled: true,
    threshold: 25000, // Use virtualization for tables > 25K rows
    metadata: {
      height: 400,
      itemSize: 48,
      overscanCount: 5
    }
  },

  // Web Worker background processing
  WORKER_PROCESSING: {
    enabled: true,
    threshold: 10000, // Use worker for datasets > 10K points
    metadata: {
      transferableObjects: true,
      caching: true,
      fallback: true
    }
  },

  // Aggressive caching with LRU eviction
  AGGRESSIVE_CACHING: {
    enabled: true,
    metadata: {
      maxCacheSize: 300 * 1024 * 1024, // 300MB cache limit
      lruEviction: true,
      persistentCache: false
    }
  },

  // Chunked data ingestion for streaming
  CHUNKED_INGESTION: {
    enabled: true,
    threshold: 100000, // Use chunking for datasets > 100K points
    metadata: {
      chunkSize: 10000,
      batchProcessing: true,
      backpressure: true
    }
  },

  // TypedArray storage for memory efficiency
  TYPED_ARRAYS: {
    enabled: true,
    threshold: 1000, // Use TypedArrays for datasets > 1K points
    metadata: {
      float64: true,
      transferable: true,
      memoryEfficient: true
    }
  }
};

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag]?.enabled ?? false;
}

/**
 * Check if a feature should be activated based on data size
 */
export function shouldActivateFeature(flag: FeatureFlag, dataSize: number): boolean {
  const config = FEATURE_FLAGS[flag];
  if (!config?.enabled) return false;
  
  if (config.threshold !== undefined) {
    return dataSize >= config.threshold;
  }
  
  return true;
}

/**
 * Get feature flag metadata
 */
export function getFeatureMetadata(flag: FeatureFlag): Record<string, any> {
  return FEATURE_FLAGS[flag]?.metadata ?? {};
}

/**
 * Get performance thresholds for optimization decisions
 */
export const PERFORMANCE_THRESHOLDS = {
  // Chart rendering thresholds
  BASIC_SAMPLING: 1000,     // Use basic sampling above 1K points
  LOD_DECIMATION: 50000,    // Use LOD decimation above 50K points  
  WORKER_PROCESSING: 10000, // Use Web Worker above 10K points
  
  // Table rendering thresholds
  PAGINATION: 1000,         // Use pagination above 1K rows
  VIRTUAL_SCROLLING: 25000, // Use virtualization above 25K rows
  
  // Memory management thresholds
  TYPED_ARRAYS: 1000,       // Use TypedArrays above 1K points
  AGGRESSIVE_CACHE: 100000, // Use aggressive caching above 100K points
  
  // Data ingestion thresholds
  CHUNKED_LOADING: 100000,  // Use chunked loading above 100K points
  STREAMING_MODE: 1000000,  // Use streaming above 1M points
  
  // Big data mode activation
  BIG_DATA_MODE: 100000     // Activate all optimizations above 100K points
} as const;

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>();
  private static metrics = new Map<string, number[]>();

  static startTimer(label: string): void {
    if (isFeatureEnabled('PERFORMANCE_MONITORING')) {
      this.timers.set(label, performance.now());
    }
  }

  static endTimer(label: string): number {
    if (!isFeatureEnabled('PERFORMANCE_MONITORING')) return 0;
    
    const start = this.timers.get(label);
    if (start === undefined) return 0;
    
    const duration = performance.now() - start;
    this.timers.delete(label);
    
    // Store metric for averaging
    const existing = this.metrics.get(label) || [];
    existing.push(duration);
    // Keep only last 100 measurements
    if (existing.length > 100) existing.shift();
    this.metrics.set(label, existing);
    
    return duration;
  }

  static getAverageTime(label: string): number {
    const measurements = this.metrics.get(label);
    if (!measurements || measurements.length === 0) return 0;
    
    return measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
  }

  static logPerformanceMetrics(): void {
    if (!isFeatureEnabled('PERFORMANCE_MONITORING')) return;
    
    console.group('🚀 IOT Platform Performance Metrics');
    for (const [label, measurements] of this.metrics.entries()) {
      const avg = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
      const latest = measurements[measurements.length - 1];
    }
    console.groupEnd();
  }

  static clearMetrics(): void {
    this.timers.clear();
    this.metrics.clear();
  }
}