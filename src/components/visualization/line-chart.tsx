import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { useSelector } from "react-redux";
import {
  Area,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumericValue } from "../../utils/numberUtils";
import { ChartConfig, MultiSeriesConfig } from "../../types/sensor";
import { selectMaxLiveReadings } from "../../store/telemetrySlice";
import { useBreakpoints } from "../../hooks/use-media-query";
import { useTelemetryLOD } from "../../hooks/useTelemetryLOD";
import { 
  isFeatureEnabled, 
  shouldActivateFeature, 
  PerformanceMonitor 
} from "../../constants/feature-flags";
import { 
  PERFORMANCE_THRESHOLDS, 
  WORKER_CONFIG,
  calculateOptimalPointsForChart,
  calculateDecimationStep,
  getDecimationInfo
} from "../../constants/performance-config";
import { 
  TIME_CONSTANTS, 
  TIME_FORMATTING, 
  convertToMinutes, 
  convertToHours, 
  convertToDays,
  getZoomPrecisionLevel,
  isZoomHighPrecision,
  isZoomMediumPrecision
} from "../../constants/time-constants";

interface LineChartProps {
  config: ChartConfig | MultiSeriesConfig;
  isMultiSeries?: boolean;
  onDownloadCSV?: () => void;
  onZoomChange?: (isZoomed: boolean) => void;
  isLiveMode?: boolean; // New prop to conditionally disable brush for live data
  // Removed onBrushChange - brush is for visual selection only, not data loading
}

export const LineChart: React.FC<LineChartProps> = ({
  config,
  isMultiSeries = false,
  onDownloadCSV,
  onZoomChange,
  isLiveMode = false, // Default to false for backward compatibility
}) => {

  // LOD System for high-performance rendering (always initialize to avoid hook order issues)
  const lodSystem = useTelemetryLOD();

  // Add clear check for empty data
  const hasData = isMultiSeries ? config.series?.some((s: any) => s.data?.length > 0) : config.series?.length > 0;

    const { isMobile, isTablet, isLandscape, isSmallScreen, isMobileLandscape, isMobileLandscapeShort, isMobileDevice } =
      useBreakpoints();

  // Get current max live readings setting
  const maxLiveReadings = useSelector(selectMaxLiveReadings);
  
  // Debug logging for live mode
  React.useEffect(() => {
    if (isLiveMode) {

    }
  }, [maxLiveReadings, isLiveMode]);

  // Early returns MUST happen before any hooks to avoid Rules of Hooks violations
  // Check for empty data first
  if (!hasData) {
    return (
      <div className="h-full w-full flex items-center justify-center flex-col">
        <Icon icon="lucide:calendar-x" className="text-default-300 mb-2" width={32} height={32} />
        <p className="text-default-500">No data available for the selected time range</p>
      </div>
    );
  }

  // Check for empty multi-series data
  if (isMultiSeries) {
    const multiConfig = config as MultiSeriesConfig;
    if (
      !multiConfig.series ||
      multiConfig.series.length === 0 ||
      multiConfig.series.every((s) => !s.data || s.data.length === 0)
    ) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-2 mx-auto" width={32} height={32} />
            <p className="text-default-500">No data available for selected sensors</p>
          </div>
        </div>
      );
    }
  } else {
    // Check for empty single-series data
    const singleConfig = config as ChartConfig;
    if (!singleConfig.series || singleConfig.series.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-2 mx-auto" width={32} height={32} />
            <p className="text-default-500">No data available for this sensor</p>
          </div>
        </div>
      );
    }
  }

  // Now ALL hooks can be declared safely after early returns
  // Enhanced data optimization with aggressive sampling for massive datasets
  const optimizeDataForRendering = React.useCallback((data: any[]) => {
    if (!data || data.length === 0) return data;
    
    const isMobile = window.innerWidth < 768;
    const dataSize = data.length;
    
    // NEW: Smart sampling based on chart capabilities - use MORE points when possible
    if (dataSize > PERFORMANCE_THRESHOLDS.BIG_DATA_MODE) {
      // Calculate target based on screen size and device capabilities
      const screenWidth = window.innerWidth;
      let targetPoints;
      
      if (isMobile) {
        targetPoints = Math.min(800, screenWidth * 0.5); // 0.5 points per pixel on mobile
      } else if (screenWidth >= 2560) {
        targetPoints = 2000; // 4K+ displays can handle more points
      } else if (screenWidth >= 1920) {
        targetPoints = 1500; // Full HD displays
      } else {
        targetPoints = 1000; // Smaller displays
      }
      
      const step = Math.ceil(dataSize / targetPoints);
      console.log(`🚀 Chart: Smart aggressive sampling ${dataSize.toLocaleString()} → ${targetPoints} points (step: ${step}) [Screen: ${screenWidth}px]`);
      
      // Use stride sampling but ensure first and last points are included
      const sampled = [];
      sampled.push(data[0]); // Always include first point
      
      for (let i = step; i < dataSize - 1; i += step) {
        sampled.push(data[i]);
      }
      
      sampled.push(data[dataSize - 1]); // Always include last point
      return sampled;
    }
    
    // NEW: Smart decimation based on chart physical capabilities
    if (dataSize > PERFORMANCE_THRESHOLDS.CHART_BASIC_SAMPLING) {
      const screenWidth = window.innerWidth;
      const chartWidth = isMobile ? 
        Math.min(WORKER_CONFIG.MOBILE_CHART_WIDTH, screenWidth * 0.9) : // Mobile: 90% of screen
        Math.min(WORKER_CONFIG.DESKTOP_CHART_WIDTH, screenWidth * 0.6); // Desktop: 60% of screen
      
      // Calculate optimal points for this chart size
      const optimalPoints = calculateOptimalPointsForChart(dataSize, chartWidth);
      const decimationInfo = getDecimationInfo(dataSize, chartWidth);
      
      console.log(`🎯 Smart Chart Decimation: ${dataSize.toLocaleString()} → ${optimalPoints.toLocaleString()} points`);
      console.log(`📊 Chart Analysis: ${chartWidth}px width, ${decimationInfo.pointsPerPixel.toFixed(2)} pts/pixel, step: ${decimationInfo.decimationStep}`);
      
      if (decimationInfo.shouldDecimate) {
        const step = decimationInfo.decimationStep;
        
        // Always include first and last points + use stride sampling
        const sampledData = [];
        sampledData.push(data[0]); // Always include first point
        
        for (let i = step; i < dataSize - 1; i += step) {
          sampledData.push(data[i]);
        }
        
        sampledData.push(data[dataSize - 1]); // Always include last point
        
        console.log(`✅ Decimation complete: ${sampledData.length.toLocaleString()} points (${(dataSize/sampledData.length).toFixed(1)}:1 ratio)`);
        return sampledData;
      } else {
        console.log(`✅ No decimation needed: Dataset fits chart optimally`);
        return data;
      }
    }
    
    // Mobile-specific optimization for smaller datasets
    if (dataSize > 500 && isMobile) {
      const mobileChartWidth = Math.min(WORKER_CONFIG.MOBILE_CHART_WIDTH, window.innerWidth * 0.9);
      const optimalPoints = Math.min(dataSize, mobileChartWidth * WORKER_CONFIG.OPTIMAL_POINTS_PER_PIXEL);
      const step = Math.ceil(dataSize / optimalPoints);
      
      console.log(`📱 Mobile optimization: ${dataSize} → ${optimalPoints} points (step: ${step})`);
      return data.filter((_, index) => index % step === 0);
    }
    
    return data;
  }, []);

  // Track zoom and brush state
  const [zoomDomain, setZoomDomain] = React.useState<{ x: [number, number]; y: [number, number] } | null>(null);
  const [brushDomain, setBrushDomain] = React.useState<{ startIndex?: number; endIndex?: number }>({});
  const [isZoomedIn, setIsZoomedIn] = React.useState(false);
  const [isInitialBrushSetup, setIsInitialBrushSetup] = React.useState(true);

  // Enhanced date formatting functions with performance optimization
  const formatTooltipDate = React.useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }, []);

  // Throttled tooltip interactions for big data mode
  const shouldThrottleTooltip = React.useMemo(() => {
    return shouldActivateFeature('BIG_DATA_MODE', config.series?.length || 0);
  }, [config.series?.length]);

  const throttledTooltipProps = React.useMemo(() => {
    if (!shouldThrottleTooltip) {
      // Standard tooltip for smaller datasets
      return {
        animationDuration: 150,
        allowEscapeViewBox: { x: false, y: false }
      };
    }

    // Throttled tooltip for big data mode
    return {
      animationDuration: 0, // Disable animation for performance
      allowEscapeViewBox: { x: false, y: false },
      // Reduced update frequency for smoother interaction
      isAnimationActive: false
    };
  }, [shouldThrottleTooltip]);

  const formatBrushDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const isMobile = window.innerWidth < 640; // sm breakpoint
    
    // For brush selection, show more detailed info based on time span
    const timeSpan = timeSpanInfo.type;
    
    if (isMobile) {
      // More compact format for mobile
      switch (timeSpan) {
        case 'minutes':
        case 'hours':
          return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
        case 'hourly':
        case 'daily':
          return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            hour12: false
          });
        default:
          return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            hour12: false
          });
      }
    }
    
    // Desktop format with more detail
    switch (timeSpan) {
      case 'minutes':
      case 'hours':
        // For short time spans, show full date and time
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      case 'hourly':
        // For hourly view, show date and hour:minute
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      case 'daily':
        // For daily view, show date and hour
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          hour12: false
        });
      case 'weekly':
        // For weekly view, show date and time
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
      case 'monthly':
      default:
        // For monthly view, show date and time
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
    }
  };

  // Notify parent about zoom state changes
  React.useEffect(() => {
    if (onZoomChange) {
      onZoomChange(isZoomedIn);
    }
  }, [isZoomedIn, onZoomChange]);

  const handleDownloadCSV = () => {
    if (!onDownloadCSV) return;
    onDownloadCSV();
  };

  // Prepare data for single or multi-series with optimization
  const chartData = React.useMemo(() => {
    let rawData: any[] = [];
    
    if (isMultiSeries) {
      const multiConfig = config as MultiSeriesConfig;
      if (multiConfig.series.length === 0 || multiConfig.series[0].data.length === 0) return [];

      // Calculate total points for performance monitoring
      const totalPoints = multiConfig.series.reduce((sum, s) => sum + (s.data?.length || 0), 0);
      
      if (totalPoints > PERFORMANCE_THRESHOLDS.LOD_DECIMATION) {
        console.log(`🚀 Line Chart: Processing ${totalPoints.toLocaleString()} multi-series points across ${multiConfig.series.length} sensors`);
      }

      // Optimized timestamp mapping for multi-series data
      const timestampMap: Record<number, Record<string, number>> = {};

      multiConfig.series.forEach((series) => {
        series.data.forEach((point) => {
          if (!timestampMap[point.timestamp]) {
            timestampMap[point.timestamp] = {};
          }
          timestampMap[point.timestamp][series.id] = point.value;
        });
      });

      // Convert the map to an array of objects efficiently
      const timestamps = Object.keys(timestampMap).map(Number).sort((a, b) => a - b);
      rawData = timestamps.map(timestamp => ({
        timestamp,
        ...timestampMap[timestamp],
      }));
    } else {
      const singleConfig = config as ChartConfig;
      rawData = singleConfig.series || [];
      
      // Debug logging for live data updates

    }

    // Apply data optimization for large datasets
    return optimizeDataForRendering(rawData);
  }, [config, isMultiSeries, optimizeDataForRendering]);

  // Window state for zoom-based decimation
  const [windowTs, setWindowTs] = React.useState<[number, number] | null>(null);
  const [isProcessingDecimation, setIsProcessingDecimation] = React.useState(false);
  
  // Enhanced data with Worker decimation for massive datasets
  const enhancedChartData = React.useMemo(() => {
    const totalPoints = chartData.length;
    const shouldUseLOD = totalPoints > 5000;
    
    if (shouldUseLOD && lodSystem.isWorkerReady) {
      console.log(`🚀 LOD System ready for ${totalPoints.toLocaleString()} data points - Worker decimation available`);
    } else if (shouldUseLOD && !lodSystem.isWorkerReady) {
      console.log(`⏳ LOD system initializing for ${totalPoints.toLocaleString()} data points...`);
    }
    
    // For now, return the optimized data (Worker integration below)
    return chartData;
  }, [chartData, lodSystem.isWorkerReady]);
  
  // Worker-based decimation for massive datasets
  const [workerDecimatedData, setWorkerDecimatedData] = React.useState<any[] | null>(null);
  
  React.useEffect(() => {
    const processWithWorker = async () => {
      const totalPoints = chartData.length;
      const shouldUseWorker = totalPoints > PERFORMANCE_THRESHOLDS.LOD_DECIMATION && lodSystem.isWorkerReady;
      
      if (!shouldUseWorker) {
        setWorkerDecimatedData(null);
        return;
      }
      
      try {
        setIsProcessingDecimation(true);
        
        // Prepare data for Worker
        const timestamps = new Float64Array(chartData.map(p => p.timestamp));
        const values = new Float32Array(chartData.map(p => p.value));
        
        // Send to Worker
        await lodSystem.appendData('chart-series', chartData);
        
        // Enhanced precision based on zoom window
        let startTs, endTs, widthPx;
        
        if (windowTs) {
          // Zoomed view - PROGRESSIVE PRECISION: More zoom = More detail
          [startTs, endTs] = windowTs;
          const windowDurationMs = endTs - startTs;
          const precisionLevel = getZoomPrecisionLevel(windowDurationMs);
          
          if (isZoomHighPrecision(windowDurationMs)) {
            // ULTRA HIGH PRECISION: Use maximum possible resolution
            widthPx = WORKER_CONFIG.MAX_PIXEL_WIDTH; // 8K resolution - show EVERY point
            console.log(`🚀 ULTRA-HIGH precision processing: ${convertToMinutes(windowDurationMs).toFixed(1)}min window → ${widthPx}px resolution (NO decimation)`);
          } else if (isZoomMediumPrecision(windowDurationMs)) {
            // HIGH PRECISION: Show maximum points chart can handle
            widthPx = Math.min(WORKER_CONFIG.MAX_PIXEL_WIDTH, (window.innerWidth || 1920) * 4); // 4x screen width
            console.log(`� HIGH precision processing: ${convertToHours(windowDurationMs).toFixed(1)}h window → ${widthPx}px resolution (4 pts/pixel)`);
          } else if (windowDurationMs < TIME_CONSTANTS.ZOOM_LOW_PRECISION_THRESHOLD) {
            // MEDIUM PRECISION: Balanced approach  
            widthPx = Math.min(4000, (window.innerWidth || 1920) * 2); // 2x screen width
            console.log(`� MEDIUM precision processing: ${convertToDays(windowDurationMs).toFixed(1)}d window → ${widthPx}px resolution (2 pts/pixel)`);
          } else {
            // LOW PRECISION: Performance focused
            widthPx = Math.max(1200, window.innerWidth || 1920); // At least HD+
            console.log(`� LOW precision processing: ${convertToDays(windowDurationMs).toFixed(1)}d window → ${widthPx}px resolution (1 pt/pixel)`);
          }
        } else {
          // Full dataset view - use responsive width
          startTs = Math.min(...timestamps);
          endTs = Math.max(...timestamps);
          widthPx = Math.max(1200, (window.innerWidth || 1920)); // Responsive but minimum HD+
          console.log(`🌐 Full dataset processing: ${totalPoints.toLocaleString()} points → ${widthPx}px resolution (overview mode)`);
        }
        
        const decimated = await lodSystem.getDecimated({
          seriesIds: ['chart-series'],
          startTs,
          endTs,
          widthPx
        });
        
        const decimatedPoints = decimated['chart-series'] || [];
        const formattedData = decimatedPoints.map(p => ({ timestamp: p.t, value: p.v }));
        
        console.log(`📊 Worker decimated ${totalPoints.toLocaleString()} → ${formattedData.length.toLocaleString()} points`);
        setWorkerDecimatedData(formattedData);
        
      } catch (error) {
        console.error('Worker decimation failed:', error);
        setWorkerDecimatedData(null);
      } finally {
        setIsProcessingDecimation(false);
      }
    };
    
    processWithWorker();
  }, [chartData, windowTs, lodSystem.isWorkerReady, lodSystem.appendData, lodSystem.getDecimated]);

  // Final data selection: Worker decimation > basic optimization
  const finalChartData = React.useMemo(() => {
    PerformanceMonitor.startTimer('chart-data-final-selection');
    
    let result;
    // Use Worker-decimated data if available and processing is complete
    if (workerDecimatedData && !isProcessingDecimation) {
      console.log(`✅ Using Worker-decimated data: ${workerDecimatedData.length.toLocaleString()} points`);
      result = workerDecimatedData;
    } else {
      // Fall back to basic optimization
      result = enhancedChartData;
    }
    
    // Performance monitoring and logging for massive datasets
    const processingTime = PerformanceMonitor.endTimer('chart-data-final-selection');
    
    if (isFeatureEnabled('PERFORMANCE_MONITORING') && result && result.length > PERFORMANCE_THRESHOLDS.LOD_DECIMATION) {
      console.log(`🚀 LineChart high-performance mode: ${result.length.toLocaleString()} points processed in ${processingTime.toFixed(2)}ms`);
      
      if (shouldActivateFeature('BIG_DATA_MODE', config.series?.length || 0)) {
        console.log(`📊 Big Data Mode active for ${(config.series?.length || 0).toLocaleString()} total points`);
      }
    }
    
    return result;
  }, [workerDecimatedData, enhancedChartData, isProcessingDecimation, config.series?.length]);
  
  // Add moving average calculation
  const chartDataWithMA = React.useMemo(() => {

    if (!finalChartData || finalChartData.length === 0) return finalChartData;

    if (isMultiSeries || !(config as ChartConfig).showMovingAverage) {
      return finalChartData;
    }

    // Define a type that includes movingAverage
    type MovingAverageDataPoint = { timestamp: number; value: number; movingAverage?: number };
    const typedChartData = finalChartData as Array<{ timestamp: number; value: number }>;
    const result: MovingAverageDataPoint[] = typedChartData.map((point) => ({ ...point }));

    for (let i = 0; i < result.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = Math.max(0, i - 10 + 1); j <= i; j++) {
        sum += result[j].value;
        count++;
      }

      result[i].movingAverage = sum / count;
    }

    return result;
  }, [finalChartData, config, isMultiSeries]);

  const orderedData = React.useMemo(
    () => {
      PerformanceMonitor.startTimer('chart-data-sorting');
      
      let sortedData;
      
      // Optimization: Skip sorting if data is already ordered (common case for time series)
      if (shouldActivateFeature('BIG_DATA_MODE', chartDataWithMA.length)) {
        // Check if data is already sorted for performance
        let isAlreadySorted = true;
        for (let i = 1; i < chartDataWithMA.length && i < PERFORMANCE_THRESHOLDS.BASIC_OPTIMIZATION; i++) { // Sample first chunk for gap detection
          if (chartDataWithMA[i].timestamp < chartDataWithMA[i - 1].timestamp) {
            isAlreadySorted = false;
            break;
          }
        }
        
        if (isAlreadySorted) {
          console.log(`⚡ Skipping sort - data already ordered (${chartDataWithMA.length.toLocaleString()} points)`);
          sortedData = chartDataWithMA;
        } else {
          // Use native sort which is typically optimized (Timsort/Introsort)
          sortedData = [...chartDataWithMA].sort((a, b) => a.timestamp - b.timestamp);
        }
      } else {
        // Standard sorting for smaller datasets
        sortedData = [...chartDataWithMA].sort((a, b) => a.timestamp - b.timestamp);
      }
      
      const sortTime = PerformanceMonitor.endTimer('chart-data-sorting');
      if (isFeatureEnabled('PERFORMANCE_MONITORING') && chartDataWithMA.length > PERFORMANCE_THRESHOLDS.ENHANCED_PROCESSING) {
        console.log(`📊 Data sorting: ${chartDataWithMA.length.toLocaleString()} points in ${sortTime.toFixed(2)}ms`);
      }

      return sortedData;
    },
    [chartDataWithMA]
  );

  // Use a stable key based on data characteristics rather than forcing re-mounts
  const chartKey = React.useMemo(() => {
    // --- REVISED CHART KEY LOGIC ---
    // The key must be stable for a given sensor. It should NOT change with every new data point.
    // We'll use properties from the config that don't change per reading.
    const stableKey = `recharts-line-${config.type}-${config.unit}`;

    return stableKey;
    // --- END REVISED LOGIC ---
  }, [config.type, config.unit]); // Only change when sensor type/unit changes

  // Initialize brush domain when data changes (but don't trigger brush change callback)
  React.useEffect(() => {
    if (orderedData.length > 0 && brushDomain.startIndex === undefined) {
      setBrushDomain({
        startIndex: 0,
        endIndex: orderedData.length - 1
      });
      setIsInitialBrushSetup(true);
    }
  }, [orderedData.length, brushDomain.startIndex]);

  // Handle brush change with window-based optimization
  const handleBrushChange = React.useCallback((brushData: any) => {
    if (!brushData || !orderedData.length) return;
    
    const { startIndex, endIndex } = brushData;
    
    // Update brush domain immediately for visual feedback
    setBrushDomain({ startIndex, endIndex });
    
    // Calculate time window for precision data loading
    if (startIndex !== undefined && endIndex !== undefined) {
      const startTs = orderedData[Math.max(0, startIndex)].timestamp;
      const endTs = orderedData[Math.min(endIndex, orderedData.length - 1)].timestamp;
      const windowDurationMs = endTs - startTs;
      const windowDurationMinutes = windowDurationMs / (1000 * 60);
      const selectedPoints = endIndex - startIndex + 1;
      
      // Set window for Worker optimization
      setWindowTs([startTs, endTs]);
      
      // NEW: Intelligent zoom precision - More zoom = More detail
      const precisionLevel = getZoomPrecisionLevel(windowDurationMs);
      
      if (isZoomHighPrecision(windowDurationMs)) {
        // ULTRA HIGH PRECISION: Show EVERY single point (no decimation)
        console.log(`🔍 Ultra-high precision zoom: ${windowDurationMinutes.toFixed(1)} minutes (${selectedPoints.toLocaleString()} points) - FULL RESOLUTION - Every point visible!`);
      } else if (isZoomMediumPrecision(windowDurationMs)) {
        // HIGH PRECISION: Show maximum points chart can handle
        console.log(`📊 High precision zoom: ${(windowDurationMinutes / 60).toFixed(1)} hours (${selectedPoints.toLocaleString()} points) - MAXIMUM DETAIL - 4x pixel density`);
      } else if (windowDurationMs < TIME_CONSTANTS.ZOOM_LOW_PRECISION_THRESHOLD) {
        // MEDIUM PRECISION: Balanced detail
        console.log(`📈 Medium precision zoom: ${(windowDurationMs / (24 * 60 * 60 * 1000)).toFixed(1)} days (${selectedPoints.toLocaleString()} points) - BALANCED DETAIL - 2x pixel density`);
      } else {
        // LOW PRECISION: Overview mode
        console.log(`� Overview zoom: ${(windowDurationMs / (24 * 60 * 60 * 1000)).toFixed(1)} days (${selectedPoints.toLocaleString()} points) - OVERVIEW MODE`);
      }
      
      // Force chart re-render with new window
      setIsZoomedIn(true);
      if (onZoomChange) {
        onZoomChange(true);
      }
    }
    
    // Skip callback during initial setup
    if (isInitialBrushSetup) {
      setIsInitialBrushSetup(false);
      return;
    }
  }, [orderedData, isInitialBrushSetup, onZoomChange]);

  // Reset zoom to show full dataset
  const handleResetZoom = React.useCallback(() => {
    setWindowTs(null);
    setBrushDomain({});
    setIsZoomedIn(false);
    setZoomDomain(null);
    if (onZoomChange) {
      onZoomChange(false);
    }
    console.log('🔄 Zoom reset - showing full dataset');
  }, [onZoomChange]);

  // Enhanced zoom functionality that provides meaningful value
  const handleZoomIn = React.useCallback(() => {
    if (brushDomain.startIndex !== undefined && brushDomain.endIndex !== undefined) {
      const startTime = orderedData[brushDomain.startIndex]?.timestamp;
      const endTime = orderedData[brushDomain.endIndex]?.timestamp;
      
      if (startTime && endTime) {
        // Check if zoom would be meaningful (selection is significantly smaller than full dataset)
        const selectionRatio = (brushDomain.endIndex - brushDomain.startIndex + 1) / orderedData.length;
        
        if (selectionRatio < 0.8) { // Only zoom if selection is less than 80% of data
          // Calculate Y-axis domain based on selected data for better visual focus
          const selectedData = orderedData.slice(brushDomain.startIndex, brushDomain.endIndex + 1);
          let values: number[] = [];
          
          if (isMultiSeries) {
            // For multi-series, collect all values from all series
            const multiConfig = config as MultiSeriesConfig;
            multiConfig.series.forEach(series => {
              selectedData.forEach((point: any) => {
                if (point[series.id] !== null && point[series.id] !== undefined) {
                  values.push(point[series.id]);
                }
              });
            });
          } else {
            // For single series, get values from the data
            values = selectedData.map((d: any) => d.value).filter(v => v !== null && v !== undefined);
          }
          
          if (values.length > 0) {
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);
            const range = maxValue - minValue;
            const padding = range > 0 ? range * 0.15 : Math.abs(minValue) * 0.1; // 15% padding, or 10% of value if no range
            
            setZoomDomain({
              x: [startTime, endTime],
              y: [
                Math.max(0, minValue - padding), 
                maxValue + padding
              ] as any
            });
            setIsZoomedIn(true);
          }
        }
      }
    }
  }, [brushDomain, orderedData, isMultiSeries, config]);

  const handleZoomReset = React.useCallback(() => {
    // Only reset zoom, preserve brush selection
    setZoomDomain(null);
    setIsZoomedIn(false);
  }, []);

  // Add keyboard shortcuts for zoom
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle if chart container is focused or user is not typing in an input
      const activeElement = document.activeElement;
      const isTyping = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      if (!isTyping) {
        if (event.key === 'z' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          if (isZoomedIn) {
            handleZoomReset();
          } else {
            handleZoomIn();
          }
        } else if (event.key === 'Escape' && isZoomedIn) {
          event.preventDefault();
          handleZoomReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleZoomIn, handleZoomReset, isZoomedIn]);

  // Decide whether we're looking at more than one day
  const multiDay = React.useMemo(() => {
    if (orderedData.length < 2) return false;
    const spanMs = orderedData[orderedData.length - 1].timestamp - orderedData[0].timestamp;
    return spanMs > 24 * 60 * 60 * 1000; // > 1 day
  }, [orderedData]);

  // Enhanced time span detection for better axis formatting
  const timeSpanInfo = React.useMemo(() => {
    if (orderedData.length < 2) return { span: 0, type: 'hour' };
    
    const spanMs = orderedData[orderedData.length - 1].timestamp - orderedData[0].timestamp;
    const hours = spanMs / (1000 * 60 * 60);
    const days = spanMs / (1000 * 60 * 60 * 24);
    
    if (hours <= 1) return { span: spanMs, type: 'minutes' };
    if (hours <= 6) return { span: spanMs, type: 'hours' };
    if (days <= 1) return { span: spanMs, type: 'hourly' };
    if (days <= 7) return { span: spanMs, type: 'daily' };
    if (days <= 30) return { span: spanMs, type: 'weekly' };
    return { span: spanMs, type: 'monthly' };
  }, [orderedData]);

  // Enhanced X-axis formatting with improved time display
  const formatXAxis = (timestamp: number) => {
    const d = new Date(timestamp);
    
    // Check if we're zoomed in (brush selection active)
    const isZoomedIn = windowTs !== null;
    
    // Special formatting for live mode - prioritize seconds/minutes for real-time updates
    if (isLiveMode) {
      const now = new Date();
      const diffMs = now.getTime() - timestamp;
      const diffMinutes = diffMs / (1000 * 60);
      
      if (diffMinutes < 60) {
        // Last hour: show HH:MM:SS for precise real-time tracking
        return d.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit',
          hour12: false 
        });
      } else if (diffMinutes < 1440) {
        // Last day: show HH:MM
        return d.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
      } else {
        // Older data: show date + time
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
      }
    }
    
    // Enhanced formatting for non-live mode with better time visibility
    if (isZoomedIn || timeSpanInfo.type === 'minutes') {
      // When zoomed in or short timespan, always show detailed time
      return d.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
      });
    }
    
    switch (timeSpanInfo.type) {
      case 'hours':
      case 'hourly':
        // Show time for hourly data
        return d.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
      case 'daily':
        // Show date + hour for daily data
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.getHours().toString().padStart(2, '0')}:00`;
      case 'weekly':
        // Show date + time for weekly data
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
      case 'monthly':
        // Show date for monthly data
        return d.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: '2-digit' 
        });
      default:
        // Default: always include time information
        return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
    }
  };

  // Calculate optimal number of ticks based on chart width and time span
  const getOptimalTickCount = () => {
    // For live mode, show more ticks to better visualize real-time progression
    if (isLiveMode) {
      // Live mode: show more frequent time markers for better real-time tracking
      const isMobile = window.innerWidth < 768;
      const maxTicks = isMobile ? 6 : 10;
      const dataPoints = orderedData.length;
      
      if (dataPoints < 50) return Math.min(dataPoints / 5, maxTicks);
      if (dataPoints < 200) return maxTicks;
      return maxTicks;
    }
    
    // Original logic for non-live mode
    const baseTickCount = timeSpanInfo.type === 'minutes' ? 8 : 
                         timeSpanInfo.type === 'hours' ? 6 :
                         timeSpanInfo.type === 'hourly' ? 8 :
                         timeSpanInfo.type === 'daily' ? 7 :
                         timeSpanInfo.type === 'weekly' ? 5 : 6;
    return Math.min(baseTickCount, Math.max(3, orderedData.length / 10));
  };

  const dailyRangeData = React.useMemo(() => {
    if (isMultiSeries || !(config as ChartConfig).showDailyRange || orderedData.length === 0) return [];

    const byDay: Record<string, { min: number; max: number }> = {};
    orderedData.forEach((p) => {
      const point = p as { timestamp: number; value: number };
      const key = new Date(point.timestamp).toISOString().slice(0, 10); // "2025-05-24"
      byDay[key] = byDay[key]
        ? { min: Math.min(byDay[key].min, point.value), max: Math.max(byDay[key].max, point.value) }
        : { min: point.value, max: point.value };
    });

    return Object.entries(byDay).map(([day, r]) => ({
      timestamp: new Date(`${day}T12:00:00Z`).getTime(),
      min: r.min,
      max: r.max,
      range: r.max - r.min,
    }));
  }, [orderedData, isMultiSeries, config]);

  // Reduced logging frequency to prevent memory issues
  if (Math.random() < 0.01) { // Log only 1% of the time

  }

  // Data validation - render placeholder for empty data
  if (!orderedData || orderedData.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="text-lg text-default-500 mb-2">No Data Available</div>
          <div className="text-sm text-default-400">
            Loading chart data...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* Enhanced header with zoom controls and brush info */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 pb-2 border-b border-default-200 gap-2">
        <div className="flex flex-col">
          <div className="text-sm font-medium text-primary-600">
            {isMultiSeries ? "Comparison Chart" : `${config.type.charAt(0).toUpperCase() + config.type.slice(1)} Data`}
            <span className="text-sm text-gray-500 ml-2">{config.unit}</span>
            {isLiveMode && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full ml-2 animate-pulse">
                🔴 LIVE
              </span>
            )}
            {isZoomedIn && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full ml-2">
                Zoomed View
              </span>
            )}
          </div>
          {/* Brush selection info - shows visual selection details */}
          {(brushDomain.startIndex !== undefined && brushDomain.endIndex !== undefined && 
            brushDomain.startIndex < orderedData.length && brushDomain.endIndex < orderedData.length) && (
            <div className="text-xs text-default-500 mt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="font-medium">
                  {isZoomedIn ? "Viewing:" : "Selection:"}
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="break-all">
                    {formatBrushDate(orderedData[brushDomain.startIndex]?.timestamp)}
                  </span>
                  <span className="text-default-400 text-center">→</span>
                  <span className="break-all">
                    {formatBrushDate(orderedData[brushDomain.endIndex]?.timestamp)}
                  </span>
                  <span className="text-default-400 text-xs sm:ml-2">
                    ({brushDomain.endIndex - brushDomain.startIndex + 1} of {orderedData.length})
                  </span>
                </div>
              </div>
            </div>
          )}
          {/* Live mode info */}
          {isLiveMode && (
            <div className="text-xs text-default-500 mt-1">
              <span className="font-medium">Real-time data:</span> 
              <span className="ml-1">Showing last {orderedData.length}/{maxLiveReadings} readings</span>
              {/* {orderedData.length >= maxLiveReadings && (
                <span className="text-orange-600 ml-1">(sliding window - oldest data automatically removed)</span>
              )} */}
            </div>
          )}
        </div>
        
        {/* Zoom controls */}
        {/* <div className="flex items-center gap-2 flex-shrink-0">
          {(brushDomain.startIndex !== undefined && brushDomain.endIndex !== undefined) && (
            (() => {
              const selectionRatio = (brushDomain.endIndex - brushDomain.startIndex + 1) / orderedData.length;
              const isSelectionSmallEnough = selectionRatio < 0.8;
              const selectionPercentage = Math.round(selectionRatio * 100);
              
              return (
                <Button 
                  size="lg" 
                  variant="bordered" 
                  isIconOnly 
                  onPress={handleZoomIn}
                  title={
                    isZoomedIn 
                      ? "Already zoomed in" 
                      : isSelectionSmallEnough 
                        ? `Zoom to ${selectionPercentage}% of data`
                        : `Selection too large (${selectionPercentage}%) - select smaller range to zoom`
                  }
                  isDisabled={isZoomedIn || !isSelectionSmallEnough}
                  className={!isSelectionSmallEnough ? "opacity-50" : ""}
                >
                  <Icon icon="lucide:zoom-in" width={14} />
                </Button>
              );
            })()
          )}
          
          {isZoomedIn && (
            <Button 
              size="sm" 
              variant="bordered" 
              isIconOnly 
              onPress={handleResetZoom}
              title="Reset to full view"
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <Icon icon="lucide:maximize" width={14} />
            </Button>
          )}
          
          <div className="w-px h-4 bg-default-300" />
          
          {onDownloadCSV && (
            <Button 
              size="sm" 
              variant="light" 
              isIconOnly 
              onPress={handleDownloadCSV} 
              title="Download CSV"
            >
              <Icon icon="lucide:download" width={14} className="text-primary-500" />
            </Button>
          )}
        </div> */}
      </div>

      <div className={`flex-1 ${(isMobile && !isLandscape && !isMobileLandscapeShort) ? "min-h-[500px]" : isMobileLandscapeShort ? "min-h-[350px]" : "min-h-[460px]"}`}>
         {/* <div className="flex-1" style={{ minHeight: '400px', height: '100%' }}></div> */}
        <ResponsiveContainer 
          width="100%" 
          height="100%" 
          className="overflow-visible"
        >
          <RechartsLineChart 
            key={chartKey}
            data={orderedData} 
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#374151"
              tick={{ fill: "#374151" }}
              axisLine={{ stroke: "#94a3b8" }}
              fontSize={12}
              type="number"
              scale="time"
              domain={zoomDomain ? zoomDomain.x : ["dataMin", "dataMax"]} // CRITICAL: Auto-adjust to data range
              tickMargin={10}
              height={50}
              tickCount={getOptimalTickCount()}
            />
            <YAxis
              stroke="#374151"
              tick={{ fill: "#374151" }}
              axisLine={{ stroke: "#94a3b8" }}
              fontSize={12}
              tickMargin={10}
              domain={zoomDomain ? zoomDomain.y : ['dataMin', 'dataMax']} // CRITICAL: Auto-adjust to value range
              label={{
                value: config.unit,
                angle: -90,
                position: "insideLeft",
                style: {
                  textAnchor: "middle",
                  fill: "#4b5563",
                  fontSize: 12,
                  fontWeight: 500,
                },
                offset: -10,
              }}
            />
            <Tooltip
              {...throttledTooltipProps}
              formatter={(value: number, name: string) => {
                if (name === "movingAverage") {
                  return [`${formatNumericValue(value, 4)} ${config.unit} (MA)`, "Moving Avg"];
                }
                if (isMultiSeries) {
                  const series = (config as MultiSeriesConfig).series.find(s => s.id === name);
                  return [`${formatNumericValue(value, 2)} ${config.unit}`, series?.name || name];
                }
                return [`${formatNumericValue(value, 2)} ${config.unit}`, "Value"];
              }}
              labelFormatter={(label: number) => formatTooltipDate(label)}
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                padding: "12px 16px",
                minWidth: "200px",
              }}
              itemStyle={{ color: "#4b5563", fontWeight: 500 }}
              labelStyle={{ color: "#1f2937", fontWeight: 600, marginBottom: "4px" }}
              cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
            />

            {(config as ChartConfig).showDailyRange && !isMultiSeries && dailyRangeData.length > 0 && (
              <>
                <defs>
                  <linearGradient id="dailyRangeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                {/* Daily range area */}
                <Area
                  data={dailyRangeData}
                  type="stepBefore"
                  dataKey="min"
                  stackId="range"
                  stroke="none"
                  fill="none"
                  isAnimationActive={false}
                />
                <Area
                  data={dailyRangeData}
                  type="stepBefore"
                  dataKey="range"
                  stackId="range"
                  stroke="none"
                  fill="url(#dailyRangeGradient)"
                  isAnimationActive={false}
                />
              </>
            )}

            {isMultiSeries ? (
              <>
                <Legend
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  iconSize={12}
                  iconType="circle"
                />
                {(config as MultiSeriesConfig).series.map((series) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.id}
                    name={series.name}
                    stroke={series.color || "#4f46e5"}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                    strokeWidth={2.5}
                    isAnimationActive={false}
                  />
                ))}
              </>
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={(config as ChartConfig).color || "#4f46e5"}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: "#4f46e5",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                    style: { filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))" },
                  }}
                  strokeWidth={2.5}
                  isAnimationActive={false}
                />

                {(config as ChartConfig).showMovingAverage && (
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                    strokeDasharray="5 5"
                  />
                )}
              </>
            )}

            {/* --- THE CRITICAL FIX --- */}
            {/* Only render the Brush when NOT in live mode */}
            {!isLiveMode && hasData && (
              <Brush
                dataKey="timestamp"
                height={36}
                stroke="#f59e0b"
                fill="#f3f4f6"
                travellerWidth={10}
                gap={1}
                tickFormatter={formatXAxis}
                startIndex={brushDomain.startIndex}
                endIndex={brushDomain.endIndex}
                onChange={handleBrushChange}
              />
            )}
            {/* --- END FIX --- */}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
