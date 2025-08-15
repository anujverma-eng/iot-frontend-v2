import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
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
import { ChartConfig, MultiSeriesConfig } from "../../types/sensor";

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

  // Add clear check for empty data
  const hasData = isMultiSeries ? config.series?.some((s: any) => s.data?.length > 0) : config.series?.length > 0;


  // Optimize data for performance - limit data points for smooth rendering
  const optimizeDataForRendering = React.useCallback((data: any[]) => {
    // For large datasets, sample data points intelligently
    if (data.length > 1000) {
      const step = Math.ceil(data.length / 800); // Keep roughly 800 points for smooth rendering
      return data.filter((_, index) => index % step === 0);
    }
    if (data.length > 500 && window.innerWidth < 768) {
      // On mobile, be more aggressive with sampling
      const step = Math.ceil(data.length / 250);
      return data.filter((_, index) => index % step === 0);
    }
    return data;
  }, []);

  // Track zoom and brush state
  const [zoomDomain, setZoomDomain] = React.useState<{ x: [number, number]; y: [number, number] } | null>(null);
  const [brushDomain, setBrushDomain] = React.useState<{ startIndex?: number; endIndex?: number }>({});
  const [isZoomedIn, setIsZoomedIn] = React.useState(false);
  const [isInitialBrushSetup, setIsInitialBrushSetup] = React.useState(true);

  // If no data for the selected range, show a clear message
  if (!hasData) {
    return (
      <div className="h-full w-full flex items-center justify-center flex-col">
        <Icon icon="lucide:calendar-x" className="text-default-300 mb-2" width={32} height={32} />
        <p className="text-default-500">No data available for the selected time range</p>
      </div>
    );
  }

  // Enhanced date formatting functions
  const formatTooltipDate = (timestamp: number) => {
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
  };

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

  // Add check for empty data with better error handling
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

      // Create a map of timestamps to values for each series
      const timestampMap: Record<number, Record<string, number>> = {};

      multiConfig.series.forEach((series) => {
        series.data.forEach((point) => {
          if (!timestampMap[point.timestamp]) {
            timestampMap[point.timestamp] = {};
          }
          timestampMap[point.timestamp][series.id] = point.value;
        });
      });

      // Convert the map to an array of objects
      rawData = Object.entries(timestampMap).map(([timestamp, values]) => ({
        timestamp: Number(timestamp),
        ...values,
      }));
    } else {
      const singleConfig = config as ChartConfig;
      rawData = singleConfig.series || [];
      
      // Debug logging for live data updates
      console.log('[LineChart] Processing chart data:', {
        configType: singleConfig.type,
        seriesLength: rawData.length,
        lastPoint: rawData[rawData.length - 1],
        lastThreePoints: rawData.slice(-3),
        timestamp: Date.now()
      });
    }

    // Apply data optimization for large datasets
    return optimizeDataForRendering(rawData);
  }, [config, isMultiSeries, optimizeDataForRendering]);

  // Add moving average calculation
  const chartDataWithMA = React.useMemo(() => {
    console.log('[LineChart] chartDataWithMA memoization triggered:', {
      inputLength: chartData?.length || 0,
      lastPoint: chartData?.[chartData.length - 1],
      lastThreeInputPoints: chartData?.slice(-3),
      showMA: isMultiSeries ? false : (config as ChartConfig).showMovingAverage,
      timestamp: Date.now()
    });

    if (!chartData || chartData.length === 0) return chartData;

    if (isMultiSeries || !(config as ChartConfig).showMovingAverage) {
      return chartData;
    }

    // Define a type that includes movingAverage
    type MovingAverageDataPoint = { timestamp: number; value: number; movingAverage?: number };
    const typedChartData = chartData as Array<{ timestamp: number; value: number }>;
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

    console.log('[LineChart] chartDataWithMA completed:', {
      outputLength: result.length,
      lastResultPoint: result[result.length - 1]
    });

    return result;
  }, [chartData, config, isMultiSeries]);

  const orderedData = React.useMemo(
    () => {
      const sortedData = [...chartDataWithMA].sort((a, b) => a.timestamp - b.timestamp);
      console.log('[LineChart] orderedData memoization triggered:', {
        inputLength: chartDataWithMA.length,
        outputLength: sortedData.length,
        lastInputPoint: chartDataWithMA[chartDataWithMA.length - 1],
        lastOutputPoint: sortedData[sortedData.length - 1],
        lastThreePoints: sortedData.slice(-3),
        timestamp: Date.now()
      });
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
    console.log('[LineChart] Generated stable chart key:', stableKey);
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

  // Handle brush change for visual selection only (no API calls)
  const handleBrushChange = React.useCallback((brushData: any) => {
    if (!brushData || !orderedData.length) return;
    
    const { startIndex, endIndex } = brushData;
    
    // Update brush domain immediately for visual feedback
    setBrushDomain({ startIndex, endIndex });
    
    // Skip callback during initial setup
    if (isInitialBrushSetup) {
      setIsInitialBrushSetup(false);
      return;
    }
  }, [orderedData, isInitialBrushSetup]);

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

  // Enhanced X-axis formatting based on time span
  const formatXAxis = (timestamp: number) => {
    const d = new Date(timestamp);
    
    switch (timeSpanInfo.type) {
      case 'minutes':
        return d.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit',
          hour12: false 
        });
      case 'hours':
        return d.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
      case 'hourly':
        return d.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false 
        });
      case 'daily':
        return d.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          hour12: false 
        });
      case 'weekly':
        return d.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        });
      case 'monthly':
        return d.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric',
          year: '2-digit' 
        });
      default:
        return d.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false 
        });
    }
  };

  // Calculate optimal number of ticks based on chart width and time span
  const getOptimalTickCount = () => {
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

  console.log('[LineChart] Final orderedData for rendering:', {
    length: orderedData.length,
    firstPoint: orderedData[0],
    lastPoint: orderedData[orderedData.length - 1],
    samplePoints: orderedData.slice(-3), // show last 3 points
    allTimestamps: orderedData.map(p => p.timestamp),
    allValues: orderedData.map(p => p.value)
  });

  console.log('[LineChart] About to render Recharts with data length:', orderedData.length);
  console.log(`[LineChart] Rendering with orderedData length: ${orderedData.length}. Last point:`, orderedData[orderedData.length - 1]);

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
        </div>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {(brushDomain.startIndex !== undefined && brushDomain.endIndex !== undefined) && (
            (() => {
              const selectionRatio = (brushDomain.endIndex - brushDomain.startIndex + 1) / orderedData.length;
              const isSelectionSmallEnough = selectionRatio < 0.8;
              const selectionPercentage = Math.round(selectionRatio * 100);
              
              return (
                <Button 
                  size="sm" 
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
              onPress={handleZoomReset}
              title="Reset to full view (keeps selection)"
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
        </div>
      </div>

      <div className="flex-1 min-h-[300px]">
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
              formatter={(value: number, name: string) => {
                if (name === "movingAverage") {
                  return [`${value.toFixed(4)} ${config.unit} (MA)`, "Moving Avg"];
                }
                if (isMultiSeries) {
                  const series = (config as MultiSeriesConfig).series.find(s => s.id === name);
                  return [`${value.toFixed(2)} ${config.unit}`, series?.name || name];
                }
                return [`${value.toFixed(2)} ${config.unit}`, "Value"];
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
