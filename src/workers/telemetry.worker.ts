/**
 * High-Performance Telemetry Data Worker
 * Handles up to 10M data points per sensor with TypedArray storage
 * Implements LRU cache with memory budget and per-pixel decimation
 */

// Import performance configuration constants
import { 
  MEMORY_CONFIG, 
  WORKER_CONFIG, 
  PERFORMANCE_THRESHOLDS 
} from '../constants/performance-config';

// Types for worker messages
interface SeriesData {
  seriesId: string;
  timestamps: Float64Array;
  values: Float32Array;
}

interface DecimateRequest {
  type: 'decimate';
  requestId: number;
  seriesIds: string[];
  startTs: number;
  endTs: number;
  widthPx: number;
  sync?: boolean;
}

interface RawSliceRequest {
  type: 'rawSlice';
  requestId: number;
  seriesId: string;
  startTs: number;
  endTs: number;
  maxPoints: number;
}

interface AppendRequest {
  type: 'append';
  seriesId: string;
  timestamps: Float64Array;
  values: Float32Array;
}

interface StatsRequest {
  type: 'stats';
  requestId: number;
}

interface ResetRequest {
  type: 'reset';
}

interface DecimatedPoint {
  t: number;
  v: number;
}

interface DecimateResponse {
  type: 'decimate';
  requestId: number;
  payload: Record<string, DecimatedPoint[]>;
  stats: {
    pointsProcessed: number;
    pointsReturned: number;
    processingTimeMs: number;
  };
}

interface RawSliceResponse {
  type: 'rawSlice';
  requestId: number;
  payload: DecimatedPoint[];
  stats: {
    pointsTotal: number;
    pointsReturned: number;
    processingTimeMs: number;
  };
}

interface StatsResponse {
  type: 'stats';
  requestId: number;
  payload: {
    seriesCount: number;
    totalMemoryBytes: number;
    seriesStats: Record<string, {
      pointCount: number;
      memoryBytes: number;
      lastAccessed: number;
    }>;
  };
}

// LRU Cache implementation with memory budget
class LRUSeriesCache {
  private static readonly MAX_MEMORY_BYTES = MEMORY_CONFIG.calculateMemoryBudget();
  private seriesData = new Map<string, {
    timestamps: Float64Array;
    values: Float32Array;
    lastAccessed: number;
    memoryBytes: number;
  }>();

  private calculateMemoryBytes(timestamps: Float64Array, values: Float32Array): number {
    return (timestamps.byteLength + values.byteLength);
  }

  private getTotalMemoryUsage(): number {
    let total = 0;
    for (const entry of this.seriesData.values()) {
      total += entry.memoryBytes;
    }
    return total;
  }

  private evictLeastRecentlyUsed(): void {
    if (this.seriesData.size === 0) return;

    let oldestTime = Date.now();
    let oldestSeriesId = '';

    for (const [seriesId, entry] of this.seriesData.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestSeriesId = seriesId;
      }
    }

    if (oldestSeriesId) {
      const evicted = this.seriesData.get(oldestSeriesId)!;
      this.seriesData.delete(oldestSeriesId);
    }
  }

  append(seriesId: string, newTimestamps: Float64Array, newValues: Float32Array): void {
    const now = Date.now();
    const newMemoryBytes = this.calculateMemoryBytes(newTimestamps, newValues);

    // Check if we need to evict before appending
    const wouldExceedBudget = (this.getTotalMemoryUsage() + newMemoryBytes) > LRUSeriesCache.MAX_MEMORY_BYTES;

    if (wouldExceedBudget) {
      // Evict until we have enough space
      while (this.seriesData.size > 0 && 
             (this.getTotalMemoryUsage() + newMemoryBytes) > LRUSeriesCache.MAX_MEMORY_BYTES) {
        this.evictLeastRecentlyUsed();
      }
    }

    const existing = this.seriesData.get(seriesId);
    
    if (existing) {
      // Merge with existing data
      const totalLength = existing.timestamps.length + newTimestamps.length;
      const mergedTimestamps = new Float64Array(totalLength);
      const mergedValues = new Float32Array(totalLength);

      // Copy existing data
      mergedTimestamps.set(existing.timestamps);
      mergedValues.set(existing.values);

      // Append new data
      mergedTimestamps.set(newTimestamps, existing.timestamps.length);
      mergedValues.set(newValues, existing.values.length);

      // Sort by timestamp (assuming data might come out of order)
      const combined = Array.from({ length: totalLength }, (_, i) => ({
        t: mergedTimestamps[i],
        v: mergedValues[i]
      })).sort((a, b) => a.t - b.t);

      // Update arrays with sorted data
      for (let i = 0; i < totalLength; i++) {
        mergedTimestamps[i] = combined[i].t;
        mergedValues[i] = combined[i].v;
      }

      const memoryBytes = this.calculateMemoryBytes(mergedTimestamps, mergedValues);
      this.seriesData.set(seriesId, {
        timestamps: mergedTimestamps,
        values: mergedValues,
        lastAccessed: now,
        memoryBytes
      });
    } else {
      // New series
      const memoryBytes = this.calculateMemoryBytes(newTimestamps, newValues);
      this.seriesData.set(seriesId, {
        timestamps: new Float64Array(newTimestamps),
        values: new Float32Array(newValues),
        lastAccessed: now,
        memoryBytes
      });
    }
  }

  get(seriesId: string): { timestamps: Float64Array; values: Float32Array } | null {
    const entry = this.seriesData.get(seriesId);
    if (!entry) return null;

    // Update last accessed time
    entry.lastAccessed = Date.now();
    return {
      timestamps: entry.timestamps,
      values: entry.values
    };
  }

  clear(): void {
    this.seriesData.clear();
  }

  getStats(): {
    seriesCount: number;
    totalMemoryBytes: number;
    seriesStats: Record<string, { pointCount: number; memoryBytes: number; lastAccessed: number }>;
  } {
    const seriesStats: Record<string, { pointCount: number; memoryBytes: number; lastAccessed: number }> = {};
    let totalMemoryBytes = 0;

    for (const [seriesId, entry] of this.seriesData.entries()) {
      seriesStats[seriesId] = {
        pointCount: entry.timestamps.length,
        memoryBytes: entry.memoryBytes,
        lastAccessed: entry.lastAccessed
      };
      totalMemoryBytes += entry.memoryBytes;
    }

    return {
      seriesCount: this.seriesData.size,
      totalMemoryBytes,
      seriesStats
    };
  }
}

// Global cache instance
const cache = new LRUSeriesCache();

// Binary search for timestamp range
function findTimeRange(timestamps: Float64Array, startTs: number, endTs: number): { start: number; end: number } {
  const len = timestamps.length;
  if (len === 0) return { start: 0, end: 0 };

  // Binary search for start index
  let left = 0, right = len - 1;
  let startIdx = 0;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (timestamps[mid] >= startTs) {
      startIdx = mid;
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // Binary search for end index
  left = startIdx;
  right = len - 1;
  let endIdx = startIdx;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (timestamps[mid] <= endTs) {
      endIdx = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return { start: startIdx, end: endIdx + 1 }; // end is exclusive
}

// Per-pixel min-max decimation with shared bucket boundaries
function decimateSeries(
  seriesData: Record<string, { timestamps: Float64Array; values: Float32Array }>,
  startTs: number,
  endTs: number,
  widthPx: number
): Record<string, DecimatedPoint[]> {
  const result: Record<string, DecimatedPoint[]> = {};
  
  // Calculate shared bucket size and max points
  const duration = endTs - startTs;
  
  // NEW: Ultra-high precision mode - show ALL points (no decimation)
  if (widthPx >= WORKER_CONFIG.MAX_PIXEL_WIDTH) {
    // Return ALL points in time range without any decimation
    for (const [seriesId, data] of Object.entries(seriesData)) {
      const { timestamps, values } = data;
      const range = findTimeRange(timestamps, startTs, endTs);
      
      const points: DecimatedPoint[] = [];
      for (let i = range.start; i < range.end; i++) {
        points.push({ t: timestamps[i], v: values[i] });
      }
      result[seriesId] = points;
    }
    
    return result;
  }
  
  // Calculate decimation parameters for lower precision modes
  const bucketMs = Math.max(1, Math.floor(duration / widthPx));
  const maxPts = Math.max(WORKER_CONFIG.MIN_CHUNK_SIZE * 2, widthPx * WORKER_CONFIG.HIGH_PRECISION_MULTIPLIER);

  for (const [seriesId, data] of Object.entries(seriesData)) {
    const { timestamps, values } = data;
    const range = findTimeRange(timestamps, startTs, endTs);
    
    if (range.start >= range.end) {
      result[seriesId] = [];
      continue;
    }

    const sliceLength = range.end - range.start;
    
    // Smart decimation: If data fits within maxPts, return as-is (no decimation needed)
    if (sliceLength <= maxPts) {
      const points: DecimatedPoint[] = [];
      for (let i = range.start; i < range.end; i++) {
        points.push({ t: timestamps[i], v: values[i] });
      }
      result[seriesId] = points;
      continue;
    }

    // Perform min-max decimation with shared buckets
    const points: DecimatedPoint[] = [];
    let currentBucketStart = startTs;

    while (currentBucketStart < endTs) {
      const bucketEnd = Math.min(currentBucketStart + bucketMs, endTs);
      const bucketRange = findTimeRange(timestamps, currentBucketStart, bucketEnd);

      if (bucketRange.start < bucketRange.end) {
        let minVal = values[bucketRange.start];
        let maxVal = values[bucketRange.start];
        let minTime = timestamps[bucketRange.start];
        let maxTime = timestamps[bucketRange.start];

        // Find min and max in this bucket
        for (let i = bucketRange.start; i < bucketRange.end; i++) {
          const val = values[i];
          if (val < minVal) {
            minVal = val;
            minTime = timestamps[i];
          }
          if (val > maxVal) {
            maxVal = val;
            maxTime = timestamps[i];
          }
        }

        // Add min then max (unless they're the same point)
        if (minTime === maxTime) {
          points.push({ t: minTime, v: minVal });
        } else {
          // Always add min first for consistent ordering
          if (minTime < maxTime) {
            points.push({ t: minTime, v: minVal });
            points.push({ t: maxTime, v: maxVal });
          } else {
            points.push({ t: maxTime, v: maxVal });
            points.push({ t: minTime, v: minVal });
          }
        }
      }

      currentBucketStart = bucketEnd;
    }

    result[seriesId] = points;
  }

  return result;
}

// Handle raw slice requests for zoomed views
function getRawSlice(
  seriesId: string,
  startTs: number,
  endTs: number,
  maxPoints: number
): DecimatedPoint[] {
  const seriesData = cache.get(seriesId);
  if (!seriesData) return [];

  const { timestamps, values } = seriesData;
  const range = findTimeRange(timestamps, startTs, endTs);
  
  if (range.start >= range.end) return [];

  const sliceLength = range.end - range.start;
  const points: DecimatedPoint[] = [];

  if (sliceLength <= maxPoints) {
    // Return all points in range
    for (let i = range.start; i < range.end; i++) {
      points.push({ t: timestamps[i], v: values[i] });
    }
  } else {
    // Sample evenly to stay under maxPoints
    const step = Math.ceil(sliceLength / maxPoints);
    for (let i = range.start; i < range.end; i += step) {
      points.push({ t: timestamps[i], v: values[i] });
    }
    
    // Always include the last point
    if ((range.end - 1) % step !== 0) {
      points.push({ t: timestamps[range.end - 1], v: values[range.end - 1] });
    }
  }

  return points;
}

// Feature detection for transferable objects
let supportsTransferables = true;
try {
  const testBuffer = new ArrayBuffer(8);
  // Test if we can transfer the buffer
  const testData = { test: true, buffer: testBuffer };
  // In worker context, postMessage signature is different
  (self as any).postMessage(testData, [testBuffer]);
  if (testBuffer.byteLength !== 0) {
    supportsTransferables = false;
  }
} catch (e) {
  supportsTransferables = false;
}

// Message handler
self.onmessage = (event: MessageEvent) => {
  const startTime = performance.now();
  
  try {
    const message = event.data;

    switch (message.type) {
      case 'reset': {
        cache.clear();
        self.postMessage({ type: 'reset', success: true });
        break;
      }

      case 'append': {
        const { seriesId, timestamps, values } = message as AppendRequest;
        cache.append(seriesId, timestamps, values);
        self.postMessage({ type: 'append', success: true, seriesId });
        break;
      }

      case 'decimate': {
        const { requestId, seriesIds, startTs, endTs, widthPx } = message as DecimateRequest;
        
        // Gather series data
        const seriesData: Record<string, { timestamps: Float64Array; values: Float32Array }> = {};
        let totalPointsProcessed = 0;
        
        for (const seriesId of seriesIds) {
          const data = cache.get(seriesId);
          if (data) {
            seriesData[seriesId] = data;
            const range = findTimeRange(data.timestamps, startTs, endTs);
            totalPointsProcessed += range.end - range.start;
          }
        }

        // Perform decimation
        const decimated = decimateSeries(seriesData, startTs, endTs, widthPx);
        
        // Count returned points
        let totalPointsReturned = 0;
        for (const points of Object.values(decimated)) {
          totalPointsReturned += points.length;
        }

        const processingTime = performance.now() - startTime;

        const response: DecimateResponse = {
          type: 'decimate',
          requestId,
          payload: decimated,
          stats: {
            pointsProcessed: totalPointsProcessed,
            pointsReturned: totalPointsReturned,
            processingTimeMs: Math.round(processingTime * 100) / 100
          }
        };

        self.postMessage(response);
        break;
      }

      case 'rawSlice': {
        const { requestId, seriesId, startTs, endTs, maxPoints } = message as RawSliceRequest;
        
        const seriesData = cache.get(seriesId);
        const totalPoints = seriesData ? seriesData.timestamps.length : 0;
        
        const rawPoints = getRawSlice(seriesId, startTs, endTs, maxPoints);
        const processingTime = performance.now() - startTime;

        const response: RawSliceResponse = {
          type: 'rawSlice',
          requestId,
          payload: rawPoints,
          stats: {
            pointsTotal: totalPoints,
            pointsReturned: rawPoints.length,
            processingTimeMs: Math.round(processingTime * 100) / 100
          }
        };

        self.postMessage(response);
        break;
      }

      case 'stats': {
        const { requestId } = message as StatsRequest;
        const stats = cache.getStats();
        
        const response: StatsResponse = {
          type: 'stats',
          requestId,
          payload: stats
        };

        self.postMessage(response);
        break;
      }

      default: {
        break;
      }
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      requestId: event.data.requestId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Worker initialized silently for optimal performance
