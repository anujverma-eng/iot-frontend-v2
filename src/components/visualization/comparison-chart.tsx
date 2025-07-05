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

interface ComparisonChartProps {
  config: MultiSeriesConfig;
  isLoading?: boolean;
  onDownloadCSV?: () => void;
  onRemoveSensor?: (sensorId: string) => void;
}

export const ComparisonChart: React.FC<ComparisonChartProps> = ({
  config,
  isLoading = false,
  onDownloadCSV,
  onRemoveSensor,
}) => {
  const [brushDomain, setBrushDomain] = React.useState<{ startIndex?: number; endIndex?: number }>({});
  const [isInitialBrushSetup, setIsInitialBrushSetup] = React.useState(true);

  // Merge all data points from all series by timestamp for proper comparison
  const mergedData = React.useMemo(() => {
    if (!config.series || config.series.length === 0) return [];

    // Collect all timestamps
    const timestampSet = new Set<number>();
    config.series.forEach(series => {
      series.data?.forEach(point => {
        timestampSet.add(point.timestamp);
      });
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

    // Create merged data points
    const mergedPoints = sortedTimestamps.map(timestamp => {
      const dataPoint: any = { timestamp };
      
      config.series.forEach(series => {
        const point = series.data?.find(p => p.timestamp === timestamp);
        dataPoint[series.id] = point?.value || null;
      });

      return dataPoint;
    });

    return mergedPoints;
  }, [config.series]);

  // Optimize data for performance - critical for preventing UI hangs
  const optimizedData = React.useMemo(() => {
    if (mergedData.length <= 1000) return mergedData;

    // For large datasets, sample intelligently to prevent hanging
    const isMobile = window.innerWidth < 768;
    const targetPoints = isMobile ? 300 : 600; // Reduced for better performance
    const step = Math.ceil(mergedData.length / targetPoints);
    
    // Always include first and last points
    const sampled = mergedData.filter((_, index) => {
      return index === 0 || 
             index === mergedData.length - 1 || 
             index % step === 0;
    });
    
    console.log(`Optimized comparison data: ${mergedData.length} → ${sampled.length} points`);
    return sampled;
  }, [mergedData]);

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
    const date = new Date(timestamp);
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
    if (!brushData || !optimizedData.length) return;
    
    const { startIndex, endIndex } = brushData;
    
    // Debounce brush changes to prevent hanging with large datasets
    if (brushChangeTimeoutRef.current) {
      clearTimeout(brushChangeTimeoutRef.current);
    }
    
    brushChangeTimeoutRef.current = setTimeout(() => {
      setBrushDomain({ startIndex, endIndex });
      
      if (isInitialBrushSetup) {
        setIsInitialBrushSetup(false);
      }
    }, 100); // 100ms debounce for smooth interaction
  }, [optimizedData, isInitialBrushSetup]);

  // Add brush change timeout ref
  const brushChangeTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Initialize brush domain when data changes
  React.useEffect(() => {
    if (optimizedData.length > 0 && brushDomain.startIndex === undefined) {
      setBrushDomain({
        startIndex: 0,
        endIndex: optimizedData.length - 1
      });
      setIsInitialBrushSetup(true);
    }
  }, [optimizedData.length, brushDomain.startIndex]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (brushChangeTimeoutRef.current) {
        clearTimeout(brushChangeTimeoutRef.current);
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-primary-600">Sensor Comparison</h3>
            <p className="text-sm text-default-500">
              Comparing {config.series.length} sensor{config.series.length > 1 ? 's' : ''} • {config.unit}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {onDownloadCSV && (
              <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={onDownloadCSV}
                title="Download CSV"
              >
                <Icon icon="lucide:download" width={16} className="text-primary-500" />
              </Button>
            )}
          </div>
        </div>

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

              {config.series.map((series, index) => (
                <Line
                  key={series.id}
                  type="monotone"
                  dataKey={series.id}
                  name={series.id}
                  stroke={series.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ 
                    r: 6, 
                    strokeWidth: 2,
                    fill: series.color,
                    stroke: "#ffffff"
                  }}
                  connectNulls={false} // Don't connect null values
                  animationDuration={800} // Reduced animation for performance
                  isAnimationActive={optimizedData.length < 500} // Disable animation for large datasets
                />
              ))}

              <Brush
                dataKey="timestamp"
                height={36} // Reduced height for better performance
                stroke="#f59e0b"
                fill="#f3f4f6"
                travellerWidth={10}
                tickFormatter={formatXAxis}
                startIndex={brushDomain.startIndex}
                endIndex={brushDomain.endIndex}
                onChange={handleBrushChange}
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
};
