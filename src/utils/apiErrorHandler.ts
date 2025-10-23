/**
 * 🚨 Enhanced API Error Handling System
 * 
 * Provides comprehensive error handling for telemetry API requests:
 * - Request size analysis and validation
 * - Graceful degradation for large requests
 * - User-friendly error messages
 * - Retry mechanisms with exponential backoff
 * - Fallback strategies for failed requests
 */

import { addToast } from '@heroui/react';
import { TimeRangeValidationResult, validateTimeRange } from './timeRangeValidator';

export interface TelemetryRequestMetrics {
  requestSize: 'small' | 'medium' | 'large' | 'massive';
  estimatedPoints: number;
  timeRangeValidation: TimeRangeValidationResult;
  expectedResponseTime: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ApiErrorContext {
  endpoint: string;
  requestSize: TelemetryRequestMetrics['requestSize'];
  statusCode?: number;
  timeRange: { start: string; end: string };
  sensorIds: string[];
  attemptNumber: number;
  originalError: any;
}

export interface ApiErrorRecovery {
  canRetry: boolean;
  suggestedAction: 'retry' | 'reduce_range' | 'contact_support' | 'try_offline';
  fallbackOptions: Array<{
    type: 'smaller_range' | 'single_sensor' | 'recent_data_only' | 'try_offline';
    description: string;
    newParams?: any;
  }>;
  userMessage: string;
  technicalDetails: string;
}

/**
 * Analyze telemetry request to predict potential issues
 */
export function analyzeTelemetryRequest(params: {
  timeRange: { start: string; end: string };
  sensorIds: string[];
}): TelemetryRequestMetrics {
  const startDate = new Date(params.timeRange.start);
  const endDate = new Date(params.timeRange.end);
  const validation = validateTimeRange(startDate, endDate);
  
  let requestSize: TelemetryRequestMetrics['requestSize'] = 'small';
  let expectedResponseTime = '< 1 second';
  let riskLevel: TelemetryRequestMetrics['riskLevel'] = 'low';
  
  const estimatedPoints = (validation.estimatedDataPoints || 0) * params.sensorIds.length;
  
  if (estimatedPoints > 2000000) { // 2M+ points
    requestSize = 'massive';
    expectedResponseTime = '30-60+ seconds';
    riskLevel = 'critical';
  } else if (estimatedPoints > 500000) { // 500K+ points
    requestSize = 'large';
    expectedResponseTime = '10-30 seconds';
    riskLevel = 'high';
  } else if (estimatedPoints > 50000) { // 50K+ points
    requestSize = 'medium';
    expectedResponseTime = '3-10 seconds';
    riskLevel = 'medium';
  }
  
  
  return {
    requestSize,
    estimatedPoints,
    timeRangeValidation: validation,
    expectedResponseTime,
    riskLevel
  };
}

/**
 * Handle API errors with smart recovery suggestions
 */
export function handleTelemetryApiError(
  error: any,
  context: ApiErrorContext
): ApiErrorRecovery {
  console.error(`🚨 Telemetry API Error:`, error);
  console.error(`   Context:`, context);
  
  const statusCode = error?.response?.status || error?.status || 0;
  const errorMessage = error?.response?.data?.message || error?.message || 'Unknown error';
  
  // Determine error category and recovery strategy
  if (statusCode >= 500 && statusCode < 600) {
    return handleServerError(error, context);
  } else if (statusCode === 429) {
    return handleRateLimitError(error, context);
  } else if (statusCode === 413 || statusCode === 414) {
    return handleRequestTooLargeError(error, context);
  } else if (statusCode === 408 || error.code === 'ECONNABORTED') {
    return handleTimeoutError(error, context);
  } else if (statusCode >= 400 && statusCode < 500) {
    return handleClientError(error, context);
  } else {
    return handleNetworkError(error, context);
  }
}

/**
 * Handle server errors (5xx)
 */
function handleServerError(error: any, context: ApiErrorContext): ApiErrorRecovery {
  const isLargeRequest = context.requestSize === 'large' || context.requestSize === 'massive';
  
  const recovery: ApiErrorRecovery = {
    canRetry: context.attemptNumber < 3,
    suggestedAction: isLargeRequest ? 'reduce_range' : 'retry',
    fallbackOptions: [],
    userMessage: '',
    technicalDetails: `Server error ${error?.response?.status || 'unknown'}: ${error?.message || 'Internal server error'}`
  };
  
  if (isLargeRequest) {
    recovery.userMessage = `Server couldn't handle the large data request (${context.requestSize}). Try a smaller time range or fewer sensors.`;
    recovery.fallbackOptions = [
      {
        type: 'smaller_range',
        description: 'Reduce time range to last 7 days',
        newParams: {
          timeRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        }
      },
      {
        type: 'single_sensor',
        description: 'Load data for one sensor at a time',
        newParams: { sensorIds: [context.sensorIds[0]] }
      },
      {
        type: 'recent_data_only',
        description: 'Show only recent data (last 24 hours)',
        newParams: {
          timeRange: {
            start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        }
      }
    ];
  } else {
    recovery.userMessage = `Temporary server issue. The request will be retried automatically.`;
    recovery.fallbackOptions = [
      {
        type: 'recent_data_only',
        description: 'Try loading recent data only',
        newParams: {
          timeRange: {
            start: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        }
      }
    ];
  }
  
  return recovery;
}

/**
 * Handle rate limiting (429)
 */
function handleRateLimitError(error: any, context: ApiErrorContext): ApiErrorRecovery {
  const retryAfter = error?.response?.headers?.['retry-after'] || 60;
  
  return {
    canRetry: true,
    suggestedAction: 'retry',
    fallbackOptions: [
      {
        type: 'recent_data_only',
        description: 'Load smaller dataset to avoid rate limits',
        newParams: {
          timeRange: {
            start: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        }
      }
    ],
    userMessage: `Rate limit exceeded. Automatic retry in ${retryAfter} seconds, or try a smaller time range.`,
    technicalDetails: `Rate limit: ${retryAfter}s cooldown`
  };
}

/**
 * Handle request too large (413/414)
 */
function handleRequestTooLargeError(error: any, context: ApiErrorContext): ApiErrorRecovery {
  return {
    canRetry: false,
    suggestedAction: 'reduce_range',
    fallbackOptions: [
      {
        type: 'smaller_range',
        description: 'Reduce to maximum 7-day range',
        newParams: {
          timeRange: {
            start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        }
      },
      {
        type: 'single_sensor',
        description: 'Load one sensor at a time',
        newParams: { sensorIds: [context.sensorIds[0]] }
      }
    ],
    userMessage: `Request too large for server to handle. Please reduce the time range or number of sensors.`,
    technicalDetails: `Request size exceeded server limits (${context.requestSize})`
  };
}

/**
 * Handle timeout errors
 */
function handleTimeoutError(error: any, context: ApiErrorContext): ApiErrorRecovery {
  const isLargeRequest = context.requestSize === 'large' || context.requestSize === 'massive';
  
  return {
    canRetry: context.attemptNumber < 2,
    suggestedAction: isLargeRequest ? 'reduce_range' : 'retry',
    fallbackOptions: [
      {
        type: 'smaller_range',
        description: 'Reduce time range to prevent timeouts',
        newParams: {
          timeRange: {
            start: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            end: new Date().toISOString()
          }
        }
      }
    ],
    userMessage: `Request timed out${isLargeRequest ? ' due to large data size' : ''}. Try a smaller time range for faster loading.`,
    technicalDetails: `Timeout after ${error?.timeout || 'unknown'}ms`
  };
}

/**
 * Handle client errors (4xx)
 */
function handleClientError(error: any, context: ApiErrorContext): ApiErrorRecovery {
  return {
    canRetry: false,
    suggestedAction: 'contact_support',
    fallbackOptions: [],
    userMessage: `Invalid request. Please check your sensor selection and time range settings.`,
    technicalDetails: `Client error ${error?.response?.status}: ${error?.message}`
  };
}

/**
 * Handle network errors
 */
function handleNetworkError(error: any, context: ApiErrorContext): ApiErrorRecovery {
  return {
    canRetry: context.attemptNumber < 3,
    suggestedAction: 'retry',
    fallbackOptions: [
      {
        type: 'try_offline',
        description: 'Check cached data while offline',
        newParams: {}
      }
    ],
    userMessage: `Network connection issue. Retrying automatically, or check your internet connection.`,
    technicalDetails: `Network error: ${error?.message || 'Connection failed'}`
  };
}

/**
 * Show user-friendly error toast with recovery options
 */
export function showApiErrorToast(recovery: ApiErrorRecovery, onRetry?: () => void, onFallback?: (option: any) => void) {
  const getToastColor = () => {
    if (recovery.suggestedAction === 'contact_support') return 'danger';
    if (recovery.canRetry) return 'warning';
    return 'danger';
  };
  
  addToast({
    title: 'Data Loading Error',
    description: recovery.userMessage,
    color: getToastColor()
  });
  
  // Also log technical details for debugging
  console.group('🔧 API Error Technical Details');
  console.groupEnd();
}

/**
 * Implement exponential backoff for retries
 */
export function calculateRetryDelay(attemptNumber: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);
  
  return delay;
}

/**
 * Create safe request parameters with size limits
 */
export function createSafeRequestParams(originalParams: any): any {
  const metrics = analyzeTelemetryRequest(originalParams);
  
  if (metrics.riskLevel === 'critical' || metrics.requestSize === 'massive') {
    
    // Reduce to last 7 days max
    const safeEndDate = new Date();
    const safeStartDate = new Date(safeEndDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      ...originalParams,
      timeRange: {
        start: safeStartDate.toISOString(),
        end: safeEndDate.toISOString()
      },
      // Limit to first 3 sensors if too many
      sensorIds: originalParams.sensorIds.slice(0, 3)
    };
  }
  
  return originalParams;
}