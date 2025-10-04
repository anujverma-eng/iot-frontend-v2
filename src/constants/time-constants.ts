/**
 * Time Constants for Chart Formatting and Precision
 * Centralized time-related thresholds and calculations
 */

// Time duration constants in milliseconds
export const TIME_CONSTANTS = {
  // Basic time units
  SECOND_MS: 1000,
  MINUTE_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
  DAY_MS: 24 * 60 * 60 * 1000,
  WEEK_MS: 7 * 24 * 60 * 60 * 1000,
  
  // Chart precision thresholds - UPDATED for progressive zoom
  ZOOM_HIGH_PRECISION_THRESHOLD: 30 * 60 * 1000,    // 30 minutes - show EVERY point (no decimation)
  ZOOM_MEDIUM_PRECISION_THRESHOLD: 6 * 60 * 60 * 1000, // 6 hours - show maximum possible points
  ZOOM_LOW_PRECISION_THRESHOLD: 3 * 24 * 60 * 60 * 1000, // 3 days - use balanced decimation
  // Legacy for compatibility
  HIGH_PRECISION_THRESHOLD: 60 * 60 * 1000,
  MEDIUM_PRECISION_THRESHOLD: 24 * 60 * 60 * 1000,
  LOW_PRECISION_THRESHOLD: 7 * 24 * 60 * 60 * 1000
} as const;

// Chart formatting utilities
export const TIME_FORMATTING = {
  // Format time duration in milliseconds to human readable string
  formatDuration: (durationMs: number): string => {
    if (durationMs < TIME_CONSTANTS.MINUTE_MS) {
      return `${Math.round(durationMs / TIME_CONSTANTS.SECOND_MS)}s`;
    } else if (durationMs < TIME_CONSTANTS.HOUR_MS) {
      return `${(durationMs / TIME_CONSTANTS.MINUTE_MS).toFixed(1)}m`;
    } else if (durationMs < TIME_CONSTANTS.DAY_MS) {
      return `${(durationMs / TIME_CONSTANTS.HOUR_MS).toFixed(1)}h`;
    } else {
      return `${(durationMs / TIME_CONSTANTS.DAY_MS).toFixed(1)}d`;
    }
  },
  
  // Get precision level based on time window
  getPrecisionLevel: (windowDurationMs: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'OVERVIEW' => {
    if (windowDurationMs < TIME_CONSTANTS.HIGH_PRECISION_THRESHOLD) {
      return 'HIGH';
    } else if (windowDurationMs < TIME_CONSTANTS.MEDIUM_PRECISION_THRESHOLD) {
      return 'MEDIUM';
    } else if (windowDurationMs < TIME_CONSTANTS.LOW_PRECISION_THRESHOLD) {
      return 'LOW';
    } else {
      return 'OVERVIEW';
    }
  },
  
  // Get chart width for precision level - UPDATED for maximum points
  getChartWidthForPrecision: (precision: 'HIGH' | 'MEDIUM' | 'LOW' | 'OVERVIEW'): number => {
    switch (precision) {
      case 'HIGH': return 8000;   // 8K resolution - show MAXIMUM points possible
      case 'MEDIUM': return 4000; // 4K resolution - show as many points as possible
      case 'LOW': return 2000;    // 2K resolution - balanced approach
      case 'OVERVIEW': return 1200; // HD+ resolution for overview
      default: return 1920;       // Default Full HD
    }
  },
  
  // NEW: Calculate maximum points based on zoom window and chart capabilities
  getMaxPointsForZoom: (windowDurationMs: number, chartWidthPx: number = 1920): number => {
    if (windowDurationMs < TIME_CONSTANTS.ZOOM_HIGH_PRECISION_THRESHOLD) {
      // High precision: Show EVERY point (no limit)
      return Infinity;
    } else if (windowDurationMs < TIME_CONSTANTS.ZOOM_MEDIUM_PRECISION_THRESHOLD) {
      // Medium precision: Show maximum chart can handle smoothly
      return chartWidthPx * 4; // 4 points per pixel for ultra-smooth rendering
    } else if (windowDurationMs < TIME_CONSTANTS.ZOOM_LOW_PRECISION_THRESHOLD) {
      // Low precision: Show optimal balance
      return chartWidthPx * 2; // 2 points per pixel
    } else {
      // Overview: Conservative for performance
      return Math.max(800, chartWidthPx); // At least 800 points, or 1 per pixel
    }
  }
} as const;

// Export utility functions
export const convertToMinutes = (durationMs: number): number => durationMs / TIME_CONSTANTS.MINUTE_MS;
export const convertToHours = (durationMs: number): number => durationMs / TIME_CONSTANTS.HOUR_MS;
export const convertToDays = (durationMs: number): number => durationMs / TIME_CONSTANTS.DAY_MS;

// Legacy precision checks
export const isHighPrecisionWindow = (durationMs: number): boolean => 
  durationMs < TIME_CONSTANTS.HIGH_PRECISION_THRESHOLD;
  
export const isMediumPrecisionWindow = (durationMs: number): boolean => 
  durationMs < TIME_CONSTANTS.MEDIUM_PRECISION_THRESHOLD;
  
export const isLowPrecisionWindow = (durationMs: number): boolean => 
  durationMs < TIME_CONSTANTS.LOW_PRECISION_THRESHOLD;

// NEW: Zoom-specific precision detection
export const isZoomHighPrecision = (durationMs: number): boolean => 
  durationMs < TIME_CONSTANTS.ZOOM_HIGH_PRECISION_THRESHOLD;
  
export const isZoomMediumPrecision = (durationMs: number): boolean => 
  durationMs < TIME_CONSTANTS.ZOOM_MEDIUM_PRECISION_THRESHOLD;
  
export const isZoomLowPrecision = (durationMs: number): boolean => 
  durationMs < TIME_CONSTANTS.ZOOM_LOW_PRECISION_THRESHOLD;

// Get zoom precision level
export const getZoomPrecisionLevel = (durationMs: number): 'ULTRA_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OVERVIEW' => {
  if (durationMs < TIME_CONSTANTS.ZOOM_HIGH_PRECISION_THRESHOLD) return 'ULTRA_HIGH';
  if (durationMs < TIME_CONSTANTS.ZOOM_MEDIUM_PRECISION_THRESHOLD) return 'HIGH';
  if (durationMs < TIME_CONSTANTS.ZOOM_LOW_PRECISION_THRESHOLD) return 'MEDIUM';
  return 'OVERVIEW';
};