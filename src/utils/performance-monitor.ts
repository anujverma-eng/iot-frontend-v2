/**
 * Instance-based Performance Monitor
 * Provides memory-safe performance tracking with proper cleanup
 */

import { MONITORING_CONFIG, ENVIRONMENT_CONFIG } from '../constants/performance-config';

export interface PerformanceMetric {
  label: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceStats {
  label: string;
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastDuration: number;
  samples: number;
}

/**
 * Instance-based performance monitor that avoids static state issues
 */
export class PerformanceMonitor {
  private timers = new Map<string, number>();
  private metrics = new Map<string, PerformanceMetric[]>();
  private isEnabled: boolean;

  constructor(enabled: boolean = true) {
    this.isEnabled = enabled;
  }

  /**
   * Start timing an operation
   */
  startTimer(label: string, metadata?: Record<string, any>): void {
    if (!this.isEnabled) return;
    
    this.timers.set(label, performance.now());
    
    // Store metadata for later use
    if (metadata) {
      const key = `${label}_metadata`;
      this.timers.set(key, metadata as any);
    }
  }

  /**
   * End timing and record the duration
   */
  endTimer(label: string): number {
    if (!this.isEnabled) return 0;
    
    const start = this.timers.get(label);
    if (start === undefined) return 0;
    
    const duration = performance.now() - start;
    const metadata = this.timers.get(`${label}_metadata`) as Record<string, any> | undefined;
    
    // Clean up timers
    this.timers.delete(label);
    this.timers.delete(`${label}_metadata`);
    
    // Record the metric
    this.recordMetric({
      label,
      duration,
      timestamp: Date.now(),
      metadata
    });
    
    // Log slow operations in development
    if (duration > MONITORING_CONFIG.SLOW_OPERATION_THRESHOLD_MS) {
      const level = duration > MONITORING_CONFIG.VERY_SLOW_THRESHOLD_MS ? 'warn' : 'info';
      console[level](`⚠️ Slow operation: ${label} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }

  /**
   * Record a metric manually
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.isEnabled) return;
    
    const existing = this.metrics.get(metric.label) || [];
    existing.push(metric);
    
    // Keep only the last N measurements to prevent memory leaks
    if (existing.length > MONITORING_CONFIG.MAX_METRIC_SAMPLES) {
      existing.shift();
    }
    
    this.metrics.set(metric.label, existing);
    
    // Periodic cleanup to prevent unbounded growth
    if (existing.length % MONITORING_CONFIG.METRIC_CLEANUP_THRESHOLD === 0) {
      this.cleanupOldMetrics();
    }
  }

  /**
   * Get statistics for a specific metric
   */
  getStats(label: string): PerformanceStats | null {
    const measurements = this.metrics.get(label);
    if (!measurements || measurements.length === 0) return null;
    
    const durations = measurements.map(m => m.duration);
    const totalTime = durations.reduce((sum, time) => sum + time, 0);
    
    return {
      label,
      count: measurements.length,
      totalTime,
      averageTime: totalTime / measurements.length,
      minTime: Math.min(...durations),
      maxTime: Math.max(...durations),
      lastDuration: durations[durations.length - 1],
      samples: measurements.length
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): Record<string, PerformanceStats> {
    const stats: Record<string, PerformanceStats> = {};
    
    for (const label of this.metrics.keys()) {
      const stat = this.getStats(label);
      if (stat) {
        stats[label] = stat;
      }
    }
    
    return stats;
  }

  /**
   * Log performance metrics to console
   */
  logMetrics(filter?: string): void {
    if (!this.isEnabled) return;
    
    const stats = this.getAllStats();
    const filteredStats = filter 
      ? Object.fromEntries(Object.entries(stats).filter(([key]) => key.includes(filter)))
      : stats;
    
    if (Object.keys(filteredStats).length === 0) {
      console.log('📊 No performance metrics available' + (filter ? ` for filter: ${filter}` : ''));
      return;
    }
    
    console.group('🚀 Performance Metrics' + (filter ? ` (${filter})` : ''));
    
    for (const [label, stat] of Object.entries(filteredStats)) {
      const avgTime = stat.averageTime.toFixed(2);
      const lastTime = stat.lastDuration.toFixed(2);
      const samples = stat.samples;
      
      console.log(`${label}: ${lastTime}ms (avg: ${avgTime}ms, samples: ${samples})`);
      
      // Show warning for consistently slow operations
      if (stat.averageTime > MONITORING_CONFIG.SLOW_OPERATION_THRESHOLD_MS) {
        console.warn(`  ⚠️ Consistently slow operation (avg: ${avgTime}ms)`);
      }
    }
    
    console.groupEnd();
  }

  /**
   * Clean up old metrics to prevent memory leaks
   */
  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [label, measurements] of this.metrics.entries()) {
      const filtered = measurements.filter(m => m.timestamp > cutoffTime);
      
      if (filtered.length === 0) {
        this.metrics.delete(label);
      } else if (filtered.length !== measurements.length) {
        this.metrics.set(label, filtered);
      }
    }
  }

  /**
   * Clear all metrics and timers
   */
  clear(): void {
    this.timers.clear();
    this.metrics.clear();
  }

  /**
   * Enable or disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo(): Record<string, number> {
    const info: Record<string, number> = {
      activeTimers: this.timers.size,
      metricLabels: this.metrics.size,
      totalMetrics: Array.from(this.metrics.values()).reduce((sum, arr) => sum + arr.length, 0)
    };

    // Add browser memory info if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      info.usedJSHeapSize = memory.usedJSHeapSize;
      info.totalJSHeapSize = memory.totalJSHeapSize;
      info.jsHeapSizeLimit = memory.jsHeapSizeLimit;
    }

    return info;
  }

  /**
   * Create a scoped timer that automatically cleans up
   */
  createScopedTimer(label: string, metadata?: Record<string, any>) {
    this.startTimer(label, metadata);
    
    return {
      end: () => this.endTimer(label),
      // Support for using with try/finally or async operations
      [Symbol.dispose]: () => this.endTimer(label)
    };
  }
}

/**
 * Global performance monitor instance for convenience
 * Can be replaced with your own instance if needed
 */
export const globalPerformanceMonitor = new PerformanceMonitor(
  ENVIRONMENT_CONFIG.ENABLE_PERFORMANCE_MONITORING ?? true
);

/**
 * Utility function for timing async operations
 */
export async function timeAsyncOperation<T>(
  monitor: PerformanceMonitor,
  label: string,
  operation: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<{ result: T; duration: number }> {
  monitor.startTimer(label, metadata);
  
  try {
    const result = await operation();
    const duration = monitor.endTimer(label);
    return { result, duration };
  } catch (error) {
    monitor.endTimer(label);
    throw error;
  }
}

/**
 * Utility function for timing synchronous operations
 */
export function timeSyncOperation<T>(
  monitor: PerformanceMonitor,
  label: string,
  operation: () => T,
  metadata?: Record<string, any>
): { result: T; duration: number } {
  monitor.startTimer(label, metadata);
  
  try {
    const result = operation();
    const duration = monitor.endTimer(label);
    return { result, duration };
  } catch (error) {
    monitor.endTimer(label);
    throw error;
  }
}