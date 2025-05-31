import React from 'react';
import {
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ChartConfig } from '../../types/sensor';

interface CandlestickChartProps {
  config: ChartConfig;
  onBrushChange?: (start: Date, end: Date) => void;
  onZoomChange?: (isZoomed: boolean) => void;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  config,
  onBrushChange,
  onZoomChange
}) => {
  const [zoomDomain, setZoomDomain] = React.useState<{x: [number, number], y: [number, number]} | null>(null);
  
  React.useEffect(() => {
    if (onZoomChange) {
      onZoomChange(!!zoomDomain);
    }
  }, [zoomDomain, onZoomChange]);

    
  // Define the candlestick data type with optional movingAverage
  type CandlestickDatum = {
    open: number;
    high: number;
    low: number;
    close: number;
    timestamp: number;
    movingAverage?: number;
  };

  // Generate candlestick data from time series
  const candlestickData = React.useMemo(() => {
    if (!config.series || config.series.length === 0) return [];
    
    // Group data by hour
    const hourlyData: Record<string, CandlestickDatum> = {};
    
    config.series.forEach(point => {
      const date = new Date(point.timestamp);
      date.setMinutes(0, 0, 0); // Round to hour
      const hourKey = date.toISOString();
      
      if (!hourlyData[hourKey]) {
        hourlyData[hourKey] = {
          open: point.value,
          high: point.value,
          low: point.value,
          close: point.value,
          timestamp: date.getTime()
        };
      } else {
        hourlyData[hourKey].high = Math.max(hourlyData[hourKey].high, point.value);
        hourlyData[hourKey].low = Math.min(hourlyData[hourKey].low, point.value);
        hourlyData[hourKey].close = point.value;
      }
    });
    
    // Convert to array and sort by timestamp
    return Object.values(hourlyData).sort((a, b) => a.timestamp - b.timestamp);
  }, [config.series]);
  
  
  // Decide whether we're looking at more than one day
  const multiDay = React.useMemo(() => {
    if (candlestickData.length < 2) return false;
    const spanMs = candlestickData[candlestickData.length - 1].timestamp - candlestickData[0].timestamp;
    return spanMs > 24 * 60 * 60 * 1000; // > 1 day
  }, [candlestickData]);

  const formatXAxis = (timestamp: number) => {
    const d = new Date(timestamp);
    return multiDay
      ? d.toLocaleDateString([], { month: "short", day: "numeric" }) // e.g. "May 24"
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); // e.g. "14:30"
  };
  
  const formatTooltipDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const handleBrushChange = (data: any) => {
    if (!onBrushChange || !data.startIndex || !data.endIndex) return;
    
    if (config.series.length === 0) return;
    
    const startTimestamp = candlestickData[data.startIndex]?.timestamp;
    const endTimestamp = candlestickData[data.endIndex]?.timestamp;
    
    if (startTimestamp && endTimestamp) {
      onBrushChange(new Date(startTimestamp), new Date(endTimestamp));
      
      // Set zoom state
      if (data.startIndex !== data.endIndex) {
        setZoomDomain({
          x: [data.startIndex, data.endIndex],
          y: [0, 0]
        });
        
        if (onZoomChange) {
          onZoomChange(true);
        }
      }
    }
  };
  
  // Determine if we should use column-range bars instead of candlesticks
  const useSparseView = React.useMemo(() => {
    return config.series.length < 40;
  }, [config.series]);

  // Calculate moving average if enabled
  const dataWithMA = React.useMemo(() => {
    if (!config.showMovingAverage || candlestickData.length === 0) return candlestickData;
    
    const windowSize = 5; // 5-hour moving average
    const result = [...candlestickData];
    
    for (let i = 0; i < result.length; i++) {
      let sum = 0;
      let count = 0;
      
      for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
        sum += result[j].close;
        count++;
      }
      
      result[i].movingAverage = sum / count;
    }
    
    return result;
  }, [candlestickData, config.showMovingAverage]);
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
          <ComposedChart
            data={dataWithMA}
            margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis} 
              stroke="var(--heroui-foreground-400)"
              fontSize={12}
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
            />
            <YAxis 
              stroke="var(--heroui-foreground-400)" 
              fontSize={12}
              label={{ 
                value: config.unit, 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
              }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'movingAverage') {
                  return [`${value.toFixed(1)} ${config.unit}`, 'Moving Avg'];
                }
                if (name === 'high-low') {
                  return [`${value} ${config.unit}`, ''];
                }
                if (name === 'low') {
                  return [`${value} ${config.unit}`, 'Min'];
                }
                if (name === 'high') {
                  return [`${value} ${config.unit}`, 'Max'];
                }
                return [`${value} ${config.unit}`, name.charAt(0).toUpperCase() + name.slice(1)];
              }}
              labelFormatter={(label: number) => formatTooltipDate(label)}
              contentStyle={{
                backgroundColor: 'var(--heroui-content1)',
                border: '1px solid var(--heroui-divider)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            
            {useSparseView ? (
              // Column-range bars for sparse data
              <>
                <Bar 
                  dataKey="low"
                  fill="transparent"
                  stroke="var(--heroui-primary)"
                  name="Min"
                />
                <Bar 
                  dataKey="high"
                  fill="var(--heroui-primary-200)"
                  fillOpacity={0.3}
                  stroke="var(--heroui-primary)"
                  name="Max"
                  barSize={20}
                />
              </>
            ) : (
              // High-Low Bar with opacity
              <Bar 
                dataKey="high-low" 
                fill="var(--heroui-primary-200)"
                fillOpacity={0.3}
                stroke="var(--heroui-primary)"
                name="Range"
                barSize={20}
              />
            )}
            
            {/* Open-Close Line */}
            <Line
              type="monotone"
              dataKey="close"
              stroke="var(--heroui-primary)"
              dot={false}
              activeDot={{ r: 4 }}
              strokeWidth={2}
            />
            
            {/* Moving Average Line */}
            {config.showMovingAverage && (
              <Line
                type="monotone"
                dataKey="movingAverage"
                stroke="var(--heroui-secondary)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4 }}
                strokeDasharray="5 5"
              />
            )}
            
            <Brush 
              dataKey="timestamp" 
              height={30} 
              stroke="var(--heroui-primary)"
              tickFormatter={formatXAxis}
              onChange={handleBrushChange}
              startIndex={0}
              endIndex={dataWithMA.length > 10 ? 10 : dataWithMA.length - 1}
              travellerWidth={10}
              gap={1}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};