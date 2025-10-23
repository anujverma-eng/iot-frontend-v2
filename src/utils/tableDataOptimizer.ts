/**
 * 🚀 Table Data Optimization System
 * 
 * Optimizes large datasets for table display and download:
 * - Smart sampling strategies (latest, distributed, statistical)
 * - Progressive loading with chunked processing
 * - Memory-efficient data management
 * - Performance monitoring and metrics
 */

export interface TableOptimizationConfig {
  maxRowsForInstantDisplay: number;
  maxRowsForDownload: number;
  chunkSize: number;
  samplingStrategy: 'latest' | 'distributed' | 'statistical';
}

export const TABLE_OPTIMIZATION_CONFIG: TableOptimizationConfig = {
  maxRowsForInstantDisplay: 1000,    // Show max 1000 rows in UI instantly
  maxRowsForDownload: Number.MAX_SAFE_INTEGER, // Allow full data download
  chunkSize: 500,                    // Process in chunks of 500
  samplingStrategy: 'distributed'     // Distribute samples across time range
};

export interface OptimizedTableData {
  displayData: any[];           // Optimized for table display
  downloadData: any[];          // Full unoptimized data for download
  totalOriginalRows: number;
  isOptimized: boolean;         // Only refers to display data
  optimizationApplied: string;
  samplingRatio: number;        // Only for display data
  processingTimeMs: number;
  memoryEstimateMB: number;
}

/**
 * Optimizes table data for display and download
 */
export function optimizeTableData(
  rawData: any[], 
  config: Partial<TableOptimizationConfig> = {}
): OptimizedTableData {
  const startTime = performance.now();
  const opts = { ...TABLE_OPTIMIZATION_CONFIG, ...config };
  const totalRows = rawData.length;
  
  
  // Calculate memory estimate (rough approximation)
  const avgRowSize = estimateRowSize(rawData[0] || {});
  const memoryEstimate = (totalRows * avgRowSize) / (1024 * 1024); // MB
  
  // If data is small enough, no optimization needed
  if (totalRows <= opts.maxRowsForInstantDisplay) {
    const processingTime = performance.now() - startTime;
    return {
      displayData: rawData,
      downloadData: rawData,
      totalOriginalRows: totalRows,
      isOptimized: false,
      optimizationApplied: 'none',
      samplingRatio: 1,
      processingTimeMs: processingTime,
      memoryEstimateMB: memoryEstimate
    };
  }
  
  // Optimize display data
  const displayData = optimizeForDisplay(rawData, opts);
  
  // Optimize download data (larger limit)
  const downloadData = optimizeForDownload(rawData, opts);
  
  const displayRatio = displayData.length / totalRows;
  const processingTime = performance.now() - startTime;
  
  
  return {
    displayData,
    downloadData, 
    totalOriginalRows: totalRows,
    isOptimized: true,
    optimizationApplied: opts.samplingStrategy,
    samplingRatio: displayRatio,
    processingTimeMs: processingTime,
    memoryEstimateMB: memoryEstimate
  };
}

/**
 * Optimize data for table display (aggressive sampling)
 */
function optimizeForDisplay(data: any[], config: TableOptimizationConfig): any[] {
  const targetRows = config.maxRowsForInstantDisplay;
  
  if (data.length <= targetRows) return data;
  
  switch (config.samplingStrategy) {
    case 'latest':
      // Show latest N rows
      return data.slice(-targetRows);
      
    case 'distributed':
      // Distribute samples across entire time range
      return distributeDataPoints(data, targetRows);
      
    case 'statistical':
      // Keep statistical significant points (peaks, valleys, trends)
      return statisticalSampling(data, targetRows);
      
    default:
      return distributeDataPoints(data, targetRows);
  }
}

/**
 * Prepare data for download (no optimization - full data)
 */
function optimizeForDownload(data: any[], config: TableOptimizationConfig): any[] {
  // Always return full data for download
  return data;
}

/**
 * Distribute data points evenly across time range
 */
function distributeDataPoints(data: any[], targetCount: number): any[] {
  if (data.length <= targetCount) return data;
  
  const step = data.length / targetCount;
  const result = [];
  
  // Always include first point
  result.push(data[0]);
  
  // Sample points at regular intervals
  for (let i = 1; i < targetCount - 1; i++) {
    const index = Math.floor(i * step);
    result.push(data[index]);
  }
  
  // Always include last point
  if (data.length > 1) {
    result.push(data[data.length - 1]);
  }
  
  return result;
}

/**
 * Statistical sampling - keep important data points
 */
function statisticalSampling(data: any[], targetCount: number): any[] {
  if (data.length <= targetCount) return data;
  
  const bucketSize = Math.floor(data.length / targetCount);
  const result = [];
  
  
  for (let i = 0; i < targetCount; i++) {
    const bucketStart = i * bucketSize;
    const bucketEnd = Math.min((i + 1) * bucketSize, data.length);
    const bucket = data.slice(bucketStart, bucketEnd);
    
    if (bucket.length > 0) {
      // Find min, max, and median values in bucket
      const sortedByValue = bucket.sort((a, b) => a.value - b.value);
      const minPoint = sortedByValue[0];
      const maxPoint = sortedByValue[sortedByValue.length - 1];
      const medianPoint = sortedByValue[Math.floor(sortedByValue.length / 2)];
      
      // Choose the most representative point (prefer extremes for visibility)
      if (Math.abs(maxPoint.value - minPoint.value) > 0.1) {
        // Significant variation - keep the extreme that's more different from neighbors
        result.push(maxPoint.value > medianPoint.value ? maxPoint : minPoint);
      } else {
        // Small variation - keep median
        result.push(medianPoint);
      }
    }
  }
  
  return result;
}

/**
 * Chunk data for progressive processing
 */
export function processDataInChunks<T>(
  data: T[], 
  chunkSize: number, 
  processor: (chunk: T[]) => T[]
): Promise<T[]> {
  return new Promise((resolve) => {
    const result: T[] = [];
    let currentIndex = 0;
    
    
    function processNextChunk() {
      const chunk = data.slice(currentIndex, currentIndex + chunkSize);
      if (chunk.length === 0) {
        resolve(result);
        return;
      }
      
      const processedChunk = processor(chunk);
      result.push(...processedChunk);
      currentIndex += chunkSize;
      
      // Use setTimeout to avoid blocking UI
      setTimeout(processNextChunk, 0);
    }
    
    processNextChunk();
  });
}

/**
 * Estimate memory size of a data row
 */
function estimateRowSize(sampleRow: any): number {
  if (!sampleRow) return 200; // Default estimate
  
  let size = 0;
  
  for (const key in sampleRow) {
    const value = sampleRow[key];
    
    // Estimate size based on type
    if (typeof value === 'string') {
      size += value.length * 2; // Unicode characters
    } else if (typeof value === 'number') {
      size += 8; // 64-bit numbers
    } else if (typeof value === 'boolean') {
      size += 1;
    } else if (value instanceof Date) {
      size += 8;
    } else {
      size += 50; // Object overhead
    }
  }
  
  return size + 100; // Add object overhead
}

/**
 * Create table data with proper formatting for display
 */
export function formatTableData(rawSeries: Array<{ timestamp: number; value: number }>): any[] {
  return rawSeries.map((point, index) => ({
    id: index,
    timestamp: point.timestamp,
    value: point.value,
    formattedTime: new Date(point.timestamp).toLocaleString(),
    formattedDate: new Date(point.timestamp).toLocaleDateString(),
    formattedTimeOnly: new Date(point.timestamp).toLocaleTimeString(),
    isoString: new Date(point.timestamp).toISOString(),
    rawTimestamp: point.timestamp
  }));
}