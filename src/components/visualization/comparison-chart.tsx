import React from 'react';
import { Card, CardBody, Button, Badge, Spinner } from '@heroui/react';
import { Icon } from '@iconify/react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
} from 'recharts';
import { MultiSeriesConfig } from '../../types/sensor';
import { chartColors } from '../../data/analytics';
import { TimeRangeSelector } from '../analytics/time-range-selector';

interface ComparisonChartProps {
  config: MultiSeriesConfig;
  isLoading?: boolean;
  onDownloadCSV?: () => void;
  onRemoveSensor?: (sensorId: string) => void;
  timeRange?: { start: Date; end: Date };
  onTimeRangeChange?: (range: { start: Date; end: Date }) => void;
  isLiveMode?: boolean;
  onLiveModeChange?: (enabled: boolean) => void;
}

export const ComparisonChart: React.FC<ComparisonChartProps> = ({
  config,
  isLoading = false,
  onDownloadCSV,
  onRemoveSensor,
  timeRange,
  onTimeRangeChange,
  isLiveMode = false,
  onLiveModeChange,
}) => {
  const [brushDomain, setBrushDomain] = React.useState<{ startIndex?: number; endIndex?: number }>({});
  const [isInitialBrushSetup, setIsInitialBrushSetup] = React.useState(true);
  const [isDataTransitioning, setIsDataTransitioning] = React.useState(false);

  // Merge all data points from all series by timestamp for proper comparison
  const processedData = React.useMemo(() => {


    if (!config.series || config.series.length === 0) return [];

    // Collect all timestamps and validate them
    const timestampSet = new Set<number>();
    let invalidTimestamps = 0;
    
    config.series.forEach(series => {
      series.data?.forEach(point => {
        if (typeof point.timestamp === 'number' && !isNaN(point.timestamp) && point.timestamp > 0) {
          timestampSet.add(point.timestamp);
        } else {
          invalidTimestamps++;
        }
      });
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

    // Create merged data points optimized for comparison charts
    const mergedPoints = sortedTimestamps.map(timestamp => {
      const dataPoint: any = { timestamp };
      
      config.series.forEach(series => {
        const point = series.data?.find(p => p.timestamp === timestamp);
        // Use undefined instead of null to let Recharts handle gaps properly
        dataPoint[series.id] = point ? point.value : undefined;
      });

      return dataPoint;
    }).filter(point => {
      // Only keep points where at least one sensor has data
      const hasValidData = config.series.some(series => 
        point[series.id] !== undefined && point[series.id] !== null && !isNaN(point[series.id])
      );
      return hasValidData;
    });



    return mergedPoints;
  }, [config.series]);

  // Optimize data for performance - critical for preventing UI hangs
  const optimizedData = React.useMemo(() => {
    const originalLength = processedData.length;
    
    if (processedData.length <= 1000) return processedData;

    // For large datasets, sample intelligently to prevent hanging
    const isMobile = window.innerWidth < 768;
    const targetPoints = isMobile ? 300 : 600; // Reduced for better performance
    const step = Math.ceil(processedData.length / targetPoints);
    
    // Always include first and last points
    const sampled = processedData.filter((_, index) => {
      return index === 0 || 
             index === processedData.length - 1 || 
             index % step === 0;
    });

    return sampled;
  }, [processedData]);

  // Enhanced date formatting for comparison charts
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

  const formatXAxis = (timestamp: number) => {
    // Safety check for invalid timestamps
    if (typeof timestamp !== 'number' || isNaN(timestamp) || timestamp <= 0) {
      return 'Invalid';
    }

    const date = new Date(timestamp);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
    
    if (diffDays === 0) {
      // Today - show time
      return date.toLocaleString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (diffDays < 7) {
      // This week - show day and time
      return date.toLocaleString('en-US', {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else {
      // Older - show date
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  // Handle brush change for visual selection with performance optimization
  const handleBrushChange = React.useCallback((brushData: any) => {
    // Skip if in transition state or no data
    if (isDataTransitioning || !brushData || !optimizedData.length) {
      return;
    }
    
    const { startIndex, endIndex } = brushData;
    
    // Comprehensive validation to prevent NaN errors
    if (typeof startIndex !== 'number' || typeof endIndex !== 'number' || 
        isNaN(startIndex) || isNaN(endIndex) || 
        !isFinite(startIndex) || !isFinite(endIndex) ||
        startIndex < 0 || endIndex < 0 ||
        startIndex >= optimizedData.length || endIndex >= optimizedData.length ||
        endIndex <= startIndex) {
      return;
    }
    
    // Debounce brush changes to prevent hanging with large datasets
    if (brushChangeTimeoutRef.current) {
      clearTimeout(brushChangeTimeoutRef.current);
    }
    
    brushChangeTimeoutRef.current = setTimeout(() => {
      // Double-check data is still valid after timeout
      if (isDataTransitioning || optimizedData.length === 0) {
        return;
      }

      const validatedDomain = {
        startIndex: Math.max(0, Math.min(startIndex, optimizedData.length - 1)),
        endIndex: Math.max(0, Math.min(endIndex, optimizedData.length - 1))
      };
      
      // Ensure minimum span and final validation before setting state
      if (isNaN(validatedDomain.startIndex) || isNaN(validatedDomain.endIndex) || 
          validatedDomain.endIndex <= validatedDomain.startIndex) {
        return;
      }
      
      // Validate that the data points at these indices are valid
      const startPoint = optimizedData[validatedDomain.startIndex];
      const endPoint = optimizedData[validatedDomain.endIndex];
      
      if (!startPoint || !endPoint || 
          !startPoint.timestamp || !endPoint.timestamp ||
          isNaN(startPoint.timestamp) || isNaN(endPoint.timestamp)) {
        return;
      }
      
      setBrushDomain(validatedDomain);
      
      if (isInitialBrushSetup) {
        setIsInitialBrushSetup(false);
      }
    }, 100); // 100ms debounce for smooth interaction
  }, [optimizedData, isInitialBrushSetup, isDataTransitioning]);

  // Add brush change timeout ref
  const brushChangeTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Track data length changes and manage transitions
  const prevDataLengthRef = React.useRef(0);
  const transitionTimeoutRef = React.useRef<NodeJS.Timeout>();
  
  React.useEffect(() => {
    const prevLength = prevDataLengthRef.current;
    const currentLength = optimizedData.length;
    
    // Detect significant data changes (more than 1 point difference)
    if (Math.abs(currentLength - prevLength) > 1) {
      
      // Clear any existing transition timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      
      setIsDataTransitioning(true);
      
      // Clear existing brush domain to prevent NaN errors
      setBrushDomain({});
      
      // Reset after a delay to allow DOM to stabilize
      transitionTimeoutRef.current = setTimeout(() => {
        setIsDataTransitioning(false);
        
        // Only set new domain if we have sufficient valid data
        if (currentLength > 2) {
          const hasValidData = optimizedData.every(d => 
            d.timestamp && 
            typeof d.timestamp === 'number' && 
            !isNaN(d.timestamp) && 
            isFinite(d.timestamp)
          );
          
          if (hasValidData) {
            const newDomain = {
              startIndex: 0,
              endIndex: Math.max(0, currentLength - 1)
            };
            setBrushDomain(newDomain);
            setIsInitialBrushSetup(true);
          }
        }
      }, 200); // Increased delay for better stability
    }

    prevDataLengthRef.current = currentLength;
  }, [optimizedData.length, optimizedData]);

  // Initialize brush domain for initial load or when no transition is happening
  React.useEffect(() => {
    if (!isDataTransitioning && optimizedData.length > 2 && // Require minimum 3 data points
        (brushDomain.startIndex === undefined || brushDomain.endIndex === undefined)) {
      
      // Validate that we have valid timestamps in the data
      const hasValidTimestamps = optimizedData.every(d => 
        d.timestamp && 
        typeof d.timestamp === 'number' && 
        !isNaN(d.timestamp) && 
        isFinite(d.timestamp) && 
        d.timestamp > 0
      );
      
      if (!hasValidTimestamps) {
        return;
      }
      
      const newDomain = {
        startIndex: 0,
        endIndex: Math.max(0, optimizedData.length - 1)
      };
      
      setBrushDomain(newDomain);
      setIsInitialBrushSetup(true);
    }
  }, [optimizedData.length, brushDomain.startIndex, brushDomain.endIndex, isDataTransitioning]);

  // Reset brush when timeRange prop changes
  const timeRangeRef = React.useRef(timeRange);
  React.useEffect(() => {
    const prevTimeRange = timeRangeRef.current;
    const currentTimeRange = timeRange;
    
    // Check if timeRange changed significantly
    if (prevTimeRange && currentTimeRange && 
        (prevTimeRange.start.getTime() !== currentTimeRange.start.getTime() || 
         prevTimeRange.end.getTime() !== currentTimeRange.end.getTime())) {
      
      // Clear brush domain and enter transition state
      setIsDataTransitioning(true);
      setBrushDomain({});
      setIsInitialBrushSetup(true);
      
      // Reset transition state after data has time to update
      setTimeout(() => {
        setIsDataTransitioning(false);
      }, 200);
    }
    
    timeRangeRef.current = currentTimeRange;
  }, [timeRange]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (brushChangeTimeoutRef.current) {
        clearTimeout(brushChangeTimeoutRef.current);
      }
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="w-full h-full">
        <CardBody className="flex items-center justify-center h-full">
          <div className="text-center">
            <Spinner size="lg" color="primary" />
            <p className="text-sm text-default-500 mt-4">Loading comparison data...</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (!config.series || config.series.length === 0) {
    return (
      <Card className="w-full h-full">
        <CardBody className="flex items-center justify-center h-full">
          <div className="text-center">
            <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-4" width={48} height={48} />
            <h3 className="text-lg font-medium mb-2">No Sensors Selected</h3>
            <p className="text-default-500">Select sensors from the list to compare their data</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full">
      {/* Header */}
      <div className="p-4 border-b border-divider">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-primary-600">Sensor Comparison</h3>
            <p className="text-sm text-default-500">
              Comparing {config.series.length} sensor{config.series.length > 1 ? 's' : ''} • {config.unit}
            </p>
          </div>
        </div>

        {/* Time Range Controls */}
        {timeRange && onTimeRangeChange && (
          <div className="mb-4">
            <TimeRangeSelector
              timeRange={timeRange}
              onTimeRangeChange={onTimeRangeChange}
              isLiveMode={isLiveMode}
              onLiveModeChange={onLiveModeChange}
              showApplyButtons={true}
              isMobile={false}
              hideLiveMode={true} // Hide live mode toggle in comparison mode
            />
          </div>
        )}

        {/* Active sensors display */}
        <div className="flex flex-wrap gap-2 mt-3">
          {config.series.map((series, index) => (
            <div key={series.id} className="flex items-center gap-1">
              <Badge
                color="primary"
                variant="flat"
                className="py-1 px-2"
                style={{
                  backgroundColor: `${series.color}20`,
                  borderColor: series.color,
                  color: series.color
                }}
              >
                <div className="flex items-center gap-1">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: series.color }}
                  />
                  {series.name}
                </div>
              </Badge>
              {onRemoveSensor && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className="ml-1 p-0 min-w-0 w-4 h-4"
                  onPress={() => onRemoveSensor(series.id)}
                >
                  <Icon icon="lucide:x" width={12} />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <CardBody className="p-4">
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLineChart 
              data={optimizedData} 
              margin={{ top: 10, right: 30, left: 20, bottom: 60 }}
            >

              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatXAxis}
                stroke="#374151"
                tick={{ fill: "#374151", fontSize: 12 }}
                axisLine={{ stroke: "#94a3b8" }}
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickCount={Math.min(6, Math.max(3, optimizedData.length / 50))} // Dynamic tick count
              />
              
              <YAxis
                stroke="#374151"
                tick={{ fill: "#374151", fontSize: 12 }}
                axisLine={{ stroke: "#94a3b8" }}
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
                }}
              />
              
              <Tooltip
                formatter={(value: number, name: string) => {
                  const series = config.series.find(s => s.id === name);
                  return [`${value?.toFixed(2) || 'N/A'} ${config.unit}`, series?.name || name];
                }}
                labelFormatter={(label: number) => formatTooltipDate(label)}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  padding: "12px 16px",
                }}
                itemStyle={{ fontWeight: 500 }}
                labelStyle={{ color: "#1f2937", fontWeight: 600, marginBottom: "4px" }}
              />
              
              <Legend
                wrapperStyle={{ paddingTop: 20 }}
                formatter={(value) => {
                  const series = config.series.find(s => s.id === value);
                  return <span className="text-sm">{series?.name || value}</span>;
                }}
                iconSize={12}
                iconType="circle"
              />

              {config.series.map((series, index) => {
                // Calculate data statistics for this specific series line
                const seriesDataPoints = optimizedData.map(point => point[series.id]).filter(val => val !== undefined && val !== null && !isNaN(val));
                const totalDataPoints = optimizedData.length;
                const validDataPoints = seriesDataPoints.length;
                const missingDataPoints = totalDataPoints - validDataPoints;
                
                // Determine if we should connect nulls based on missing data percentage
                const missingPercentageNum = (missingDataPoints / totalDataPoints) * 100;
                const shouldConnectNulls = missingPercentageNum >= 30; // Connect nulls if >30% missing data
                
                return (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.id}
                    name={series.id}
                    stroke={series.color}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={shouldConnectNulls}
                    activeDot={{ 
                      r: 6, 
                      strokeWidth: 2,
                      fill: series.color,
                      stroke: "#ffffff"
                    }}
                    animationDuration={800} // Reduced animation for performance
                    isAnimationActive={optimizedData.length < 500} // Disable animation for large datasets
                  />
                );
              })}

              {(() => {
                // Comprehensive brush safety checks with extra validation
                const hasValidData = optimizedData.length > 2; // Require at least 3 points for brush
                const hasValidIndices = brushDomain.startIndex !== undefined && 
                  brushDomain.endIndex !== undefined &&
                  typeof brushDomain.startIndex === 'number' &&
                  typeof brushDomain.endIndex === 'number' &&
                  !isNaN(brushDomain.startIndex) &&
                  !isNaN(brushDomain.endIndex) &&
                  isFinite(brushDomain.startIndex) &&
                  isFinite(brushDomain.endIndex) &&
                  brushDomain.startIndex >= 0 &&
                  brushDomain.endIndex >= 0;
                const isNotTransitioning = !isDataTransitioning;
                const hasValidTimestamps = optimizedData.length > 0 && 
                  optimizedData.every(d => typeof d.timestamp === 'number' && 
                    !isNaN(d.timestamp) && 
                    isFinite(d.timestamp) && 
                    d.timestamp > 0);
                
                const shouldRenderBrush = hasValidData && hasValidIndices && isNotTransitioning && hasValidTimestamps;

                if (!shouldRenderBrush) {
                  return null;
                }

                const safeStartIndex = Math.max(0, Math.min(brushDomain.startIndex!, optimizedData.length - 1));
                const safeEndIndex = Math.max(safeStartIndex, Math.min(brushDomain.endIndex!, optimizedData.length - 1));
                
                // Additional safety check - ensure indices are valid numbers and have minimum span
                if (isNaN(safeStartIndex) || isNaN(safeEndIndex) || safeEndIndex <= safeStartIndex) {
                  return null;
                }

                // Create safe tick formatter that never returns NaN
                const safeBrushTickFormatter = (value: any) => {
                  try {
                    // Extra validation for brush tick formatting
                    if (value === null || value === undefined || 
                        typeof value !== 'number' || 
                        !isFinite(value) || isNaN(value) || value <= 0) {
                      return '';
                    }
                    return formatXAxis(value);
                  } catch (error) {
                    return '';
                  }
                };

                // Validate the actual data points that will be used by brush
                const startDataPoint = optimizedData[safeStartIndex];
                const endDataPoint = optimizedData[safeEndIndex];
                
                if (!startDataPoint || !endDataPoint || 
                    !startDataPoint.timestamp || !endDataPoint.timestamp ||
                    isNaN(startDataPoint.timestamp) || isNaN(endDataPoint.timestamp)) {
                  return null;
                }

                return (
                  <Brush
                    dataKey="timestamp"
                    height={36}
                    stroke="#f59e0b"
                    fill="#f3f4f6"
                    travellerWidth={10}
                    tickFormatter={safeBrushTickFormatter}
                    startIndex={safeStartIndex}
                    endIndex={safeEndIndex}
                    onChange={handleBrushChange}
                  />
                );
              })()}
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
};
