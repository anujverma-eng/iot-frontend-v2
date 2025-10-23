import http from "./http";
import {
  TelemetryQueryParams,
  SensorTelemetryResponse,
} from "../types/telemetry";

// New interfaces for optimized API
export interface OptimizedTelemetryRequest {
  sensorIds: string[];
  timeRange: {
    start: string;
    end: string;
  };
  targetPoints: number;
  deviceType: 'mobile' | 'desktop';
  liveMode?: {
    enabled: boolean;
    maxReadings: number;
  };
}

export interface OptimizedTelemetryResponse {
  data: SensorTelemetryResponse[];
}

export interface TableDataRequest {
  sensorIds: string[];
  timeRange: {
    start: string;
    end: string;
  };
  pagination: {
    page: number;
    limit: number;
  };
  sortBy?: 'timestamp' | 'value';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedTelemetryResponse {
  data: SensorTelemetryResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
  summary: {
    min: number;
    max: number;
    avg: number;
    totalDataPoints: number;
  };
}

// New interfaces for bulk export APIs
export interface EstimateExportRequest {
  sensorIds: string[];
  timeRange: {
    start: string;
    end: string;
  };
  includeMetadata?: boolean;
}

export interface EstimateExportResponse {
  status: number;
  success: boolean;
  message: string;
  data: {
    success: boolean;
    totalRecords: number;
    estimatedDuration: string;
    estimatedSizeKB: number;
    recommendedBatchSize: number;
    performanceNote: string;
    recommendation: "stream" | "background";
  };
  from: string;
  error: null | string;
}

export interface StreamExportRequest {
  sensorIds: string[];
  timeRange: {
    start: string;
    end: string;
  };
  format?: "csv" | "json" | "jsonl";
  batchSize?: number;
  maxRecords?: number;
  includeMetadata?: boolean;
  filename?: string;
}

/**
 * Enhanced telemetry service with backend optimization support
 */
export const TelemetryService = {
  /**
   * POST /telemetry/query (EXISTING - for backward compatibility)
   * Returns `data: SensorTelemetryResponse[]`
   */
  async query(params: TelemetryQueryParams): Promise<SensorTelemetryResponse[]> {
    const res = await http.post("/telemetry/query", params);
    /** expecting envelope { status, success, data, … } */
    return res.data.data as SensorTelemetryResponse[];
  },

  /**
   * POST /telemetry/query/optimized (NEW - for charts)
   * Returns optimized data based on target points and device type
   */
  async getOptimized(params: OptimizedTelemetryRequest): Promise<SensorTelemetryResponse[]> {
    const res = await http.post("/telemetry/query/optimized", params);
    return res.data.data as SensorTelemetryResponse[];
  },

  /**
   * POST /telemetry/table-data (NEW - for tables with pagination)
   * Returns paginated raw data for table display
   */
  async getTableData(params: TableDataRequest): Promise<PaginatedTelemetryResponse> {
    const res = await http.post("/telemetry/table-data", params);
    
    // Handle API response wrapper structure
    // API returns: { status, success, message, data: [...], pagination: {...} }
    if (res.data && res.data.data && res.data.pagination) {
      return {
        data: res.data.data,
        pagination: {
          currentPage: res.data.pagination.currentPage,
          totalPages: res.data.pagination.totalPages,
          totalRecords: res.data.pagination.totalRecords,
          hasNext: res.data.pagination.hasNext,
          hasPrev: res.data.pagination.hasPrev,
          limit: res.data.pagination.limit
        },
        summary: res.data.summary || {
          min: 0,
          max: 0,
          avg: 0,
          totalDataPoints: res.data.pagination.totalRecords || 0
        }
      } as PaginatedTelemetryResponse;
    }
    
    // Fallback to direct response if structure is different
    return res.data as PaginatedTelemetryResponse;
  },

  /**
   * POST /telemetry/export/estimate (NEW - for export estimation)
   * Returns dataset size and duration estimates before export
   */
  async estimateExport(params: EstimateExportRequest): Promise<EstimateExportResponse> {
    params.includeMetadata = false;
    const res = await http.post("/telemetry/export/estimate", params);
    return res.data as EstimateExportResponse;
  },

  /**
   * POST /telemetry/export/stream (NEW - for streaming bulk export)
   * Downloads complete raw dataset as streaming file with progress tracking
   */
  async streamExport(
    params: StreamExportRequest, 
    onProgress?: (progress: number, loaded: number, total?: number) => void,
    estimatedSizeKB?: number,
    estimatedDurationMs?: number,
    abortSignal?: AbortSignal
  ): Promise<Blob> {
    console.log('🚀 Starting streamExport with progress callback:', !!onProgress);
    
    let fallbackInterval: NodeJS.Timeout | null = null;
    let startTime = Date.now();
    let hasRealProgress = false;
    params.includeMetadata = false;
    
    // Setup fallback progress based on estimation
    if (onProgress && estimatedSizeKB && estimatedDurationMs) {
      console.log('⏱️ Setting up fallback progress timer');
      fallbackInterval = setInterval(() => {
        if (!hasRealProgress) {
          const elapsed = Date.now() - startTime;
          const estimatedProgress = Math.min(90, Math.round((elapsed / estimatedDurationMs) * 100));
          const estimatedLoaded = Math.round((estimatedSizeKB * 1024 * estimatedProgress) / 100);
          console.log(`⏱️ Fallback progress: ${estimatedProgress}% (${estimatedLoaded} bytes estimated)`);
          onProgress(estimatedProgress, estimatedLoaded, estimatedSizeKB * 1024);
        }
      }, 500);
    }
    
    let res;
    try {
      res = await http.post("/telemetry/export/stream", params, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/octet-stream, text/csv, application/json',
        },
        signal: abortSignal, // Add abort signal for cancellation
        onDownloadProgress: (progressEvent) => {
          console.log('📊 Real progress event received:', progressEvent);
          if (onProgress) {
            hasRealProgress = true;
            if (fallbackInterval) {
              clearInterval(fallbackInterval);
              fallbackInterval = null;
            }
            
            const { loaded, total, lengthComputable } = progressEvent;
            console.log(`📈 Real progress: ${loaded} bytes loaded, total: ${total}, lengthComputable: ${lengthComputable}`);
            
            let percentCompleted: number;
            
            if (lengthComputable && total && total > 0) {
              // Server provided Content-Length, use accurate percentage
              percentCompleted = Math.round((loaded * 100) / total);
              console.log(`✅ Using accurate progress: ${percentCompleted}% (${loaded}/${total})`);
            } else {
              // No Content-Length header, use size-based estimation
              // Show progressive percentage based on data size without hitting 100%
              const sizeInMB = loaded / (1024 * 1024);
              if (sizeInMB < 1) {
                percentCompleted = Math.min(30, Math.round(sizeInMB * 30)); // 0-1MB = 0-30%
              } else if (sizeInMB < 5) {
                percentCompleted = Math.min(60, 30 + Math.round((sizeInMB - 1) * 7.5)); // 1-5MB = 30-60%
              } else if (sizeInMB < 10) {
                percentCompleted = Math.min(80, 60 + Math.round((sizeInMB - 5) * 4)); // 5-10MB = 60-80%
              } else {
                percentCompleted = Math.min(90, 80 + Math.round((sizeInMB - 10) * 1)); // 10MB+ = 80-90%
              }
              console.log(`⏱️ Using size-based progress estimation: ${percentCompleted}% (${sizeInMB.toFixed(2)}MB downloaded)`);
            }
            
            onProgress(percentCompleted, loaded, total);
          }
        },
        timeout: 0, // No timeout for streaming downloads - let it run as long as needed
        validateStatus: function (status) {
          // Accept both 200 and 201 status codes
          return status >= 200 && status < 300;
        },
        // Add response interceptor options for better stream handling
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    } catch (error: any) {
      // Clean up fallback timer on error
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
      
      // Handle specific network errors related to streaming
      if (error.code === 'ERR_NETWORK' || error.message.includes('ERR_CONTENT_LENGTH_MISMATCH')) {
        console.error('🚨 Stream download failed due to content length mismatch or network error');
        throw new Error('Download failed due to network issues. Please try again with a smaller time range or check your connection.');
      }
      
      // Re-throw other errors
      throw error;
    }
    
    // Clean up fallback timer and set final progress
    if (fallbackInterval) {
      clearInterval(fallbackInterval);
    }
    if (onProgress) {
      onProgress(100, res.data.size || 0, res.data.size || 0);
    }
    
    console.log('✅ Download completed, blob size:', res.data.size);
    
    // Check if response is an error (JSON) instead of file blob
    if (res.data.type === 'application/json') {
      const text = await res.data.text();
      const errorData = JSON.parse(text);
      throw new Error(errorData.error || 'Export failed');
    }
    
    return res.data as Blob;
  },
};

export default TelemetryService;
