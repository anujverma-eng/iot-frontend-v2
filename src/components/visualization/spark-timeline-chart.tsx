import React from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceDot,
  Brush,
  Bar,
  ComposedChart
} from 'recharts';
import { ChartConfig } from '../../types/sensor';

interface SparkTimelineChartProps {
  config: ChartConfig;
  onBrushChange?: (start: Date, end: Date) => void;
  onZoomChange?: (isZoomed: boolean) => void;
  isLiveMode?: boolean;
}

export const SparkTimelineChart: React.FC<SparkTimelineChartProps> = ({
  config,
  onBrushChange,
  onZoomChange,
  isLiveMode = false
}) => {
  const [zoomDomain, setZoomDomain] = React.useState<{x: [number, number], y: [number, number]} | null>(null);
  
  React.useEffect(() => {
    if (onZoomChange) {
      onZoomChange(!!zoomDomain);
    }
  }, [zoomDomain, onZoomChange]);
  
  const formatXAxis = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  const formatTooltipDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };
  
  const handleBrushChange = (data: any) => {
    if (!onBrushChange || !data.startIndex || !data.endIndex) return;
    
    if (config.series.length === 0) return;
    
    const startTimestamp = config.series[data.startIndex].timestamp;
    const endTimestamp = config.series[data.endIndex].timestamp;
    
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
  };
  
  // Group events by minute for bar chart
  const eventsByMinute = React.useMemo(() => {
    const minuteMap: Record<string, number> = {};
    
    config.series.forEach(point => {
      if (point.value <= 0) return; // Skip non-events
      
      const date = new Date(point.timestamp);
      date.setSeconds(0, 0); // Round to minute
      const minuteKey = date.toISOString();
      
      if (!minuteMap[minuteKey]) {
        minuteMap[minuteKey] = 0;
      }
      
      minuteMap[minuteKey] += point.value;
    });
    
    // Convert to array and sort by timestamp
    return Object.entries(minuteMap).map(([minuteKey, count]) => ({
      timestamp: new Date(minuteKey).getTime(),
      count
    })).sort((a, b) => a.timestamp - b.timestamp);
  }, [config.series]);
  
  // Filter only events with value > 0 for the rug plot
  const eventPoints = React.useMemo(() => {
    return config.series.filter(point => point.value > 0);
  }, [config.series]);
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
          <ComposedChart
            margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
            data={eventsByMinute}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
            <XAxis 
              dataKey="timestamp" 
              name="Time" 
              tickFormatter={formatXAxis} 
              stroke="var(--heroui-foreground-400)"
              fontSize={12}
              type="number"
              domain={zoomDomain ? zoomDomain.x : ['dataMin', 'dataMax']}
              allowDataOverflow={!!zoomDomain}
            />
            <YAxis 
              dataKey="count" 
              name="Events" 
              stroke="var(--heroui-foreground-400)"
              fontSize={12}
              label={{ 
                value: `${config.unit}/minute`, 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
              }}
              domain={[0, 'auto']}
              allowDataOverflow={!!zoomDomain}
            />
            <Tooltip
              formatter={(value: number) => [`${value} ${config.unit}`, 'Events']}
              labelFormatter={(label: number) => formatTooltipDate(label)}
              contentStyle={{
                backgroundColor: 'var(--heroui-content1)',
                border: '1px solid var(--heroui-divider)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            
            {/* Event bars */}
            <Bar
              dataKey="count"
              fill="var(--heroui-primary)"
              name="Events"
              barSize={10}
            />
            
            {/* Rug plot for raw events */}
            {eventPoints.map((point, index) => (
              <ReferenceDot
                key={index}
                x={point.timestamp}
                y={0}
                r={2}
                fill="var(--heroui-secondary)"
                stroke="none"
                isFront={true}
              />
            ))}
            
            {/* Disable brush in live mode */}
            {!isLiveMode && (
              <Brush 
                dataKey="timestamp" 
                height={30} 
                stroke="var(--heroui-primary)"
                tickFormatter={formatXAxis}
                onChange={handleBrushChange}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};