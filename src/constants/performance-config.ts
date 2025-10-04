/**
 * Performance Configuration Constants
 * Centralized performance thresholds and optimization parameters
 */

// Dataset size thresholds for optimization activation
export const PERFORMANCE_THRESHOLDS = {
  // Basic optimizations
  BASIC_OPTIMIZATION: 1000,        // 1K points - TypedArrays, basic caching
  ENHANCED_PROCESSING: 10000,     // 10K points - Worker processing begins (increased)
  LOD_DECIMATION: 20000,          // 20K points - Level-of-detail decimation
  BIG_DATA_MODE: 30000,          // 30K points - All optimizations active
  MASSIVE_DATASET: 100000,       // 1lakh points - Streaming mode, aggressive caching
  
  // Table rendering thresholds
  TABLE_PAGINATION: 500,          // 500 rows - Use pagination
  TABLE_VIRTUALIZATION: 25000,    // 25K rows - Use virtual scrolling
  
  // Memory management thresholds
  MEMORY_AGGRESSIVE_MODE: 100000, // 100K points - Aggressive memory management
  
  // Chart rendering optimization points - CORRECTED for optimal chart performance
  CHART_BASIC_SAMPLING: 1000,     // 1K points - Start smart decimation
  CHART_WORKER_PROCESSING: 5000,  // 5K points - Use Web Worker  
  CHART_FULL_DECIMATION: 10000,   // 10K points - Full decimation system
} as const;

// Memory configuration
export const MEMORY_CONFIG = {
  // Default memory budget (300MB)
  DEFAULT_MEMORY_BUDGET: 300 * 1024 * 1024,
  
  // Memory budget calculation based on device capabilities
  calculateMemoryBudget(): number {
    if (typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
      const deviceMemoryGB = (navigator as any).deviceMemory || 4;
      
      // Allocate memory budget based on device capabilities
      if (deviceMemoryGB >= 8) {
        return 500 * 1024 * 1024; // 500MB for high-end devices
      } else if (deviceMemoryGB >= 4) {
        return 300 * 1024 * 1024; // 300MB for mid-range devices  
      } else {
        return 150 * 1024 * 1024; // 150MB for low-end devices
      }
    }
    
    // Fallback to default if device memory detection unavailable
    return this.DEFAULT_MEMORY_BUDGET;
  },
  
  // Memory limits for different components
  WORKER_CACHE_LIMIT: () => MEMORY_CONFIG.calculateMemoryBudget() * 0.8, // 80% of budget
  CHART_DATA_LIMIT: () => MEMORY_CONFIG.calculateMemoryBudget() * 0.1,   // 10% of budget
  TABLE_DATA_LIMIT: () => MEMORY_CONFIG.calculateMemoryBudget() * 0.1,   // 10% of budget
} as const;

// UI interaction configuration
export const UI_CONFIG = {
  // Debounce settings for different interaction types
  DEBOUNCE_FAST_MS: 100,          // Fast interactions (hover, etc.)
  DEBOUNCE_STANDARD_MS: 200,      // Standard interactions (brush, zoom)
  DEBOUNCE_SLOW_MS: 500,          // Slow interactions (search, filter)
  
  // Request management
  MAX_CONCURRENT_REQUESTS: 3,     // Maximum parallel worker requests
  REQUEST_TIMEOUT_MS: 10000,      // 10 second timeout for worker requests
} as const;

// Worker processing configuration
export const WORKER_CONFIG = {
  // Chunk size for processing large datasets
  CHUNK_SIZE: 10000,              // Process 10K points per chunk
  MAX_CHUNK_SIZE: 50000,          // Maximum chunk size
  MIN_CHUNK_SIZE: 1000,           // Minimum chunk size
  
  // Batch processing parameters
  BATCH_TIMEOUT_MS: 16,           // 16ms - one frame at 60fps
  MAX_BATCH_SIZE: 100000,         // Maximum points in one batch
  
  // Decimation parameters - UPDATED for maximum point utilization
  MIN_PIXEL_WIDTH: 800,           // Minimum pixel width for decimation
  MAX_PIXEL_WIDTH: 8000,          // Maximum pixel width (8K displays for ultra precision)
  DEFAULT_PIXEL_WIDTH: 1920,      // Default pixel width (Full HD)
  
  // Chart capability constants - based on screen sizes and performance
  MOBILE_CHART_WIDTH: 350,            // Typical mobile chart width
  TABLET_CHART_WIDTH: 600,             // Typical tablet chart width  
  DESKTOP_CHART_WIDTH: 800,            // Typical desktop chart width
  LARGE_DESKTOP_CHART_WIDTH: 1200,     // Large desktop chart width
  
  HIGH_PRECISION_MULTIPLIER: 4,       // 4 points per pixel for high precision
  
  // Performance multipliers for different scenarios
  OPTIMAL_POINTS_PER_PIXEL: 2,         // Sweet spot for performance + clarity
  MAX_POINTS_PER_PIXEL: 4,             // Maximum before performance degrades
  HIGH_PERFORMANCE_POINTS_PER_PIXEL: 1.5, // Conservative for smooth interactions
  ULTRA_PERFORMANCE_POINTS_PER_PIXEL: 1,  // Maximum performance mode
} as const;

// Performance monitoring configuration
export const MONITORING_CONFIG = {
  // Timing thresholds for performance warnings
  SLOW_OPERATION_THRESHOLD_MS: 100,   // Warn if operation takes > 100ms
  VERY_SLOW_THRESHOLD_MS: 500,        // Critical warning if > 500ms
  
  // Memory monitoring
  MEMORY_WARNING_THRESHOLD: 0.8,      // Warn at 80% of memory budget
  MEMORY_CRITICAL_THRESHOLD: 0.95,    // Critical at 95% of memory budget
  
  // Metric collection limits
  MAX_METRIC_SAMPLES: 100,            // Keep last 100 measurements
  METRIC_CLEANUP_THRESHOLD: 1000,     // Clean up after 1000 operations
} as const;

// Environment-specific configuration
export const ENVIRONMENT_CONFIG = {
  // Development vs production settings
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // Feature flags for different environments
  ENABLE_VERBOSE_LOGGING: process.env.NODE_ENV === 'development',
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_MEMORY_MONITORING: true,
  
  // Build system configuration
  WORKER_FILE_EXTENSION: '.worker.js', // Use .js extension for production
  
  // Runtime feature detection
  supportsWorkers: typeof Worker !== 'undefined',
  supportsTransferables: (() => {
    try {
      const testBuffer = new ArrayBuffer(8);
      return testBuffer.byteLength === 8;
    } catch {
      return false;
    }
  })(),
} as const;

// Export utility functions
export const getThresholdForDataSize = (dataSize: number): string => {
  if (dataSize >= PERFORMANCE_THRESHOLDS.MASSIVE_DATASET) return 'MASSIVE_DATASET';
  if (dataSize >= PERFORMANCE_THRESHOLDS.BIG_DATA_MODE) return 'BIG_DATA_MODE';  
  if (dataSize >= PERFORMANCE_THRESHOLDS.LOD_DECIMATION) return 'LOD_DECIMATION';
  if (dataSize >= PERFORMANCE_THRESHOLDS.ENHANCED_PROCESSING) return 'ENHANCED_PROCESSING';
  if (dataSize >= PERFORMANCE_THRESHOLDS.BASIC_OPTIMIZATION) return 'BASIC_OPTIMIZATION';
  return 'STANDARD';
};

export const shouldUseOptimization = (dataSize: number, threshold: keyof typeof PERFORMANCE_THRESHOLDS): boolean => {
  return dataSize >= PERFORMANCE_THRESHOLDS[threshold];
};

// NEW: Smart decimation based on chart physical capabilities
export const calculateOptimalPointsForChart = (dataSize: number, chartWidthPx: number = 800): number => {
  // Chart performance sweet spots
  const optimalPointsPerPixel = 2;     // 2 points per pixel for clarity
  const maxPointsPerPixel = 4;         // Maximum before performance degrades
  const minDisplayPoints = 100;        // Always show at least 100 points
  
  // Calculate based on chart width
  const baseOptimalPoints = chartWidthPx * optimalPointsPerPixel;
  const maxOptimalPoints = chartWidthPx * maxPointsPerPixel;
  
  // Smart decision logic
  if (dataSize <= minDisplayPoints) {
    return dataSize; // Show all points for very small datasets
  } else if (dataSize <= baseOptimalPoints) {
    return dataSize; // Show all points if within optimal range
  } else if (dataSize <= maxOptimalPoints) {
    return Math.max(baseOptimalPoints, Math.floor(dataSize * 0.8)); // Light decimation
  } else {
    return baseOptimalPoints; // Decimate to optimal point density
  }
};

// Calculate decimation step for a given target
export const calculateDecimationStep = (dataSize: number, targetPoints: number): number => {
  if (dataSize <= targetPoints) return 1;
  return Math.ceil(dataSize / targetPoints);
};

// Get decimation info for debugging
export const getDecimationInfo = (dataSize: number, chartWidth: number = 800) => {
  const optimalPoints = calculateOptimalPointsForChart(dataSize, chartWidth);
  const step = calculateDecimationStep(dataSize, optimalPoints);
  const ratio = dataSize / optimalPoints;
  
  return {
    originalPoints: dataSize,
    optimalPoints,
    decimationStep: step,
    decimationRatio: ratio,
    chartWidth,
    pointsPerPixel: optimalPoints / chartWidth,
    shouldDecimate: dataSize > optimalPoints
  };
};