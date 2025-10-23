/**
 * ⏰ Time Range Validation System
 * 
 * Provides comprehensive time range validation with:
 * - 30-day maximum limit enforcement
 * - Progressive warnings (7 days, 14 days, 30 days)
 * - Data point estimation
 * - User-friendly suggestions and alerts
 */

export const TIME_RANGE_LIMITS = {
  MAX_DAYS: 30,
  MAX_MILLISECONDS: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
} as const;

export interface TimeRangeValidationResult {
  isValid: boolean;
  dayCount: number;
  severity: 'info' | 'warning' | 'critical' | 'error';
  message: string;
  suggestedEndDate?: Date;
  estimatedDataPoints?: number;
  estimatedMemoryMB?: number;
  performanceImpact: 'minimal' | 'moderate' | 'high' | 'severe';
}

/**
 * Validate time range and provide user feedback
 */
export function validateTimeRange(startDate: Date, endDate: Date): TimeRangeValidationResult {
  const diffMs = endDate.getTime() - startDate.getTime();
  const dayCount = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  
  // Estimate data points (assuming average 1 reading per 30 seconds)
  const readingsPerHour = 120; // 2 per minute
  const hoursInRange = diffMs / (60 * 60 * 1000);
  const estimatedDataPoints = Math.floor(hoursInRange * readingsPerHour);
  
  // Estimate memory usage (rough calculation)
  const bytesPerPoint = 200; // Timestamp + value + metadata
  const estimatedMemoryMB = (estimatedDataPoints * bytesPerPoint) / (1024 * 1024);
  
  // Determine performance impact
  let performanceImpact: TimeRangeValidationResult['performanceImpact'] = 'minimal';
  if (estimatedDataPoints > 1000000) performanceImpact = 'severe';
  else if (estimatedDataPoints > 100000) performanceImpact = 'high';
  else if (estimatedDataPoints > 10000) performanceImpact = 'moderate';
  
  if (dayCount <= 0) {
    return {
      isValid: false,
      dayCount,
      severity: 'error',
      message: 'End date must be after start date',
      estimatedDataPoints,
      estimatedMemoryMB,
      performanceImpact: 'minimal'
    };
  }
  
  if (dayCount > TIME_RANGE_LIMITS.MAX_DAYS) {
    const suggestedEndDate = new Date(startDate.getTime() + TIME_RANGE_LIMITS.MAX_MILLISECONDS);
    
    return {
      isValid: false,
      dayCount,
      severity: 'error',
      message: `Time range too large (${dayCount} days). Maximum allowed is ${TIME_RANGE_LIMITS.MAX_DAYS} days to ensure optimal performance and prevent server timeouts.`,
      suggestedEndDate,
      estimatedDataPoints,
      estimatedMemoryMB,
      performanceImpact: 'severe'
    };
  }
  
  return {
    isValid: true,
    dayCount,
    severity: 'info',
    message: `Time range: ${dayCount} days`,
    estimatedDataPoints,
    estimatedMemoryMB,
    performanceImpact
  };
}

/**
 * Create user-friendly alert component data
 */
export function createTimeRangeAlert(validation: TimeRangeValidationResult) {
  const getAlertColor = () => {
    switch (validation.severity) {
      case 'error': return 'danger';
      case 'critical': return 'warning';
      case 'warning': return 'warning';
      default: return 'primary';
    }
  };
  
  const getIcon = () => {
    switch (validation.severity) {
      case 'error': return 'lucide:alert-circle';
      case 'critical': return 'lucide:alert-triangle';
      case 'warning': return 'lucide:info';
      default: return 'lucide:calendar';
    }
  };
  
  const getPerformanceIcon = () => {
    switch (validation.performanceImpact) {
      case 'severe': return 'lucide:zap-off';
      case 'high': return 'lucide:trending-down';
      case 'moderate': return 'lucide:trending-up';
      default: return 'lucide:zap';
    }
  };
  
  return {
    color: getAlertColor(),
    icon: getIcon(),
    performanceIcon: getPerformanceIcon(),
    title: validation.severity === 'error' ? 'Invalid Time Range' : 'Time Range Notice',
    message: validation.message,
    showSuggestion: !!validation.suggestedEndDate,
    suggestedEndDate: validation.suggestedEndDate,
    estimatedDataPoints: validation.estimatedDataPoints,
    estimatedMemoryMB: validation.estimatedMemoryMB,
    performanceImpact: validation.performanceImpact,
    dayCount: validation.dayCount
  };
}

/**
 * Check if time range should trigger a warning
 */
export function shouldWarnUser(validation: TimeRangeValidationResult): boolean {
  return validation.severity === 'error';
}

/**
 * Get recommended time ranges for common use cases
 */
export function getRecommendedTimeRanges() {
  const now = new Date();
  
  return {
    lastHour: {
      label: 'Last Hour',
      start: new Date(now.getTime() - 60 * 60 * 1000),
      end: now,
      description: 'Recent real-time data'
    },
    last6Hours: {
      label: 'Last 6 Hours', 
      start: new Date(now.getTime() - 6 * 60 * 60 * 1000),
      end: now,
      description: 'Recent trends'
    },
    lastDay: {
      label: 'Last 24 Hours',
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      end: now,
      description: 'Daily patterns'
    },
    lastWeek: {
      label: 'Last 7 Days',
      start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      end: now,
      description: 'Weekly analysis'
    },
    lastMonth: {
      label: 'Last 30 Days (Max)',
      start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      end: now,
      description: 'Maximum allowed range'
    }
  };
}

/**
 * Suggest optimal time range based on data density
 */
export function suggestOptimalRange(
  totalDataPoints: number, 
  currentStart: Date, 
  currentEnd: Date
): { suggested: { start: Date; end: Date }; reason: string } | null {
  
  const currentRangeMs = currentEnd.getTime() - currentStart.getTime();
  const currentDays = currentRangeMs / (24 * 60 * 60 * 1000);
  
  // If already within good limits, no suggestion needed
  if (currentDays <= TIME_RANGE_LIMITS.MAX_DAYS && totalDataPoints <= 50000) {
    return null;
  }
  
  // Suggest based on data density
  let suggestedDays: number;
  let reason: string;
  
  if (totalDataPoints > 500000) {
    suggestedDays = 3;
    reason = "Very high data density detected. 3 days recommended for optimal performance.";
  } else if (totalDataPoints > 100000) {
    suggestedDays = 7;
    reason = "High data density detected. 1 week recommended for good performance.";
  } else if (totalDataPoints > 50000) {
    suggestedDays = 14;
    reason = "Moderate data density. 2 weeks recommended for balanced detail and performance.";
  } else {
    suggestedDays = Math.min(30, currentDays);
    reason = "Data density is manageable. Current range is acceptable.";
  }
  
  const suggestedStart = new Date(currentEnd.getTime() - (suggestedDays * 24 * 60 * 60 * 1000));
  
  return {
    suggested: {
      start: suggestedStart,
      end: currentEnd
    },
    reason
  };
}