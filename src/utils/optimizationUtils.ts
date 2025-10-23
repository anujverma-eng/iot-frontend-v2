/**
 * Utility functions for calculating optimal target points for backend optimization
 */

// Target points configuration based on use cases
export const TARGET_POINTS_CONFIG = {
  // Base points by device type
  mobile: {
    small: 200,    // Small cards, mini charts
    medium: 500,   // Standard charts
    large: 800,    // Detailed analysis
    table: 25      // Table rows per page
  },
  desktop: {
    small: 400,    // Small cards, mini charts  
    medium: 800,   // Standard charts
    large: 1200,    // Detailed analysis
    table: 50      // Table rows per page
  }
};

// Chart type specific multipliers
export const CHART_TYPE_MULTIPLIERS = {
  'dashboard-card': 0.5,     // Smaller overview charts
  'line-chart': 1.0,         // Standard line charts
  'area-chart': 1.0,         // Standard area charts
  'scatter-plot': 1.2,       // Need more points for scatter
  'correlation': 0.8,        // Statistical analysis needs fewer points
  'distribution': 0.6,       // Histogram/distribution charts
  'trend-analysis': 1.1,     // Trend analysis needs good resolution
  'anomaly-detection': 1.0,  // Standard resolution for anomaly detection
  'comparison': 0.8          // Multi-sensor comparison (points split between sensors)
};

/**
 * Detect device type based on screen size
 */
export const getDeviceType = (): 'mobile' | 'desktop' => {
  if (typeof window === 'undefined') return 'desktop';
  return window.innerWidth < 768 ? 'mobile' : 'desktop';
};

/**
 * Calculate optimal target points for a chart
 */
export interface TargetPointsOptions {
  chartType?: keyof typeof CHART_TYPE_MULTIPLIERS;
  sensorCount?: number;
  deviceType?: 'mobile' | 'desktop';
  containerWidth?: number;
  isComparison?: boolean;
  chartSize?: 'small' | 'medium' | 'large';
}

export const calculateTargetPoints = (options: TargetPointsOptions = {}): number => {
  const {
    chartType = 'line-chart',
    sensorCount = 1,
    deviceType = getDeviceType(),
    containerWidth,
    isComparison = false,
    chartSize = 'medium'
  } = options;

  // Base points from configuration
  let basePoints = TARGET_POINTS_CONFIG[deviceType][chartSize];

  // Apply chart type multiplier
  const multiplier = CHART_TYPE_MULTIPLIERS[chartType] || 1.0;
  basePoints = Math.round(basePoints * multiplier);

  // Adjust for container width if provided
  if (containerWidth) {
    // Roughly 0.5-1 points per pixel width for smooth rendering
    const pointsPerPixel = deviceType === 'mobile' ? 0.3 : 0.5;
    const widthBasedPoints = Math.round(containerWidth * pointsPerPixel);
    
    // Use the smaller of calculated vs width-based points
    basePoints = Math.min(basePoints, widthBasedPoints);
  }

  // Adjust for multiple sensors in comparison mode
  if (isComparison && sensorCount > 1) {
    // Distribute total points among sensors, but ensure minimum per sensor
    const pointsPerSensor = Math.max(
      Math.floor(basePoints / sensorCount),
      deviceType === 'mobile' ? 50 : 100 // Minimum points per sensor
    );
    basePoints = pointsPerSensor * sensorCount;
  }

  // Apply reasonable bounds
  const minPoints = 50;
  const maxPoints = deviceType === 'mobile' ? 500 : 1000;
  
  return Math.max(minPoints, Math.min(basePoints, maxPoints));
};

/**
 * Calculate target points for different page contexts
 */
export const calculateTargetPointsForPage = (
  page: 'dashboard' | 'analytics' | 'solo-view',
  options: Omit<TargetPointsOptions, 'chartSize'> = {}
): number => {
  const pageConfig: Record<typeof page, TargetPointsOptions['chartSize']> = {
    'dashboard': 'small',     // Dashboard cards are smaller
    'analytics': 'medium',    // Analytics charts are standard size
    'solo-view': 'large'      // Solo view charts are detailed
  };

  return calculateTargetPoints({
    ...options,
    chartSize: pageConfig[page]
  });
};

/**
 * Calculate table pagination limit
 */
export const calculateTableLimit = (deviceType?: 'mobile' | 'desktop'): number => {
  const device = deviceType || getDeviceType();
  return TARGET_POINTS_CONFIG[device].table;
};

/**
 * Create optimized telemetry request parameters
 */
export interface CreateOptimizedRequestOptions {
  sensorIds: string[];
  timeRange: { start: string; end: string };
  context: {
    page: 'dashboard' | 'analytics' | 'solo-view';
    chartType?: keyof typeof CHART_TYPE_MULTIPLIERS;
    isComparison?: boolean;
    containerWidth?: number;
  };
  liveMode?: { enabled: boolean; maxReadings: number };
}

export const createOptimizedTelemetryRequest = (options: CreateOptimizedRequestOptions) => {
  const { sensorIds, timeRange, context, liveMode } = options;
  const deviceType = getDeviceType();

  const targetPoints = calculateTargetPointsForPage(context.page, {
    chartType: context.chartType,
    sensorCount: sensorIds.length,
    deviceType,
    containerWidth: context.containerWidth,
    isComparison: context.isComparison
  });

  return {
    sensorIds,
    timeRange,
    targetPoints,
    deviceType,
    liveMode
  };
};

/**
 * Create table data request parameters
 */
export interface CreateTableRequestOptions {
  sensorIds: string[];
  timeRange: { start: string; end: string };
  page?: number;
  sortBy?: 'timestamp' | 'value';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export const createTableDataRequest = (options: CreateTableRequestOptions) => {
  const { sensorIds, timeRange, page = 1, sortBy = 'timestamp', sortOrder = 'desc', search } = options;
  const limit = calculateTableLimit();

  return {
    sensorIds,
    timeRange,
    pagination: { page, limit },
    sortBy,
    sortOrder,
    search
  };
};