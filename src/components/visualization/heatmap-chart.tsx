import React from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  ZAxis,
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { ChartConfig } from '../../types/sensor';

interface HeatmapChartProps {
  config: ChartConfig;
  onZoomChange?: (isZoomed: boolean) => void;
}

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  config,
  onZoomChange
}) => {
  // Generate heatmap data from series
  const heatmapData = React.useMemo(() => {
    if (!config.series || config.series.length === 0) return [];
    
    const dayHourMap: Record<string, Record<number, number>> = {};
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // Initialize all day/hour combinations with 0
    for (let day = 0; day < 7; day++) {
      dayHourMap[day] = {};
      for (let hour = 0; hour < 24; hour++) {
        dayHourMap[day][hour] = 0;
      }
    }
    
    // Fill data
    config.series.forEach(point => {
      const date = new Date(point.timestamp);
      const day = date.getDay();
      const hour = date.getHours();
      
      dayHourMap[day][hour] += point.value;
    });
    
    // Convert to array format for ScatterChart
    const result = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        result.push({
          day,
          hour,
          value: dayHourMap[day][hour]
        });
      }
    }
    
    return result;
  }, [config.series]);
  
  // Find min and max values for color scale
  const { minValue, maxValue } = React.useMemo(() => {
    if (heatmapData.length === 0) return { minValue: 0, maxValue: 0 };
    
    const values = heatmapData.map(item => item.value);
    return {
      minValue: Math.min(...values),
      maxValue: Math.max(...values)
    };
  }, [heatmapData]);
  
  // Color scale function - use a fixed blue scale
  const getColor = (value: number) => {
    if (maxValue === minValue) return 'var(--heroui-primary-200)';
    
    const ratio = (value - minValue) / (maxValue - minValue);
    
    if (ratio < 0.2) return 'var(--heroui-primary-100)';
    if (ratio < 0.4) return 'var(--heroui-primary-200)';
    if (ratio < 0.6) return 'var(--heroui-primary-300)';
    if (ratio < 0.8) return 'var(--heroui-primary-400)';
    return 'var(--heroui-primary-500)';
  };
  
  const formatDayTick = (day: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day];
  };
  
  const formatHourTick = (hour: number) => {
    return `${hour}:00`;
  };
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1" style={{ minHeight: '160px' }}>
        <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
          <ScatterChart
            margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
            <XAxis 
              dataKey="hour" 
              name="Hour" 
              type="number" 
              domain={[0, 23]}
              tickFormatter={formatHourTick}
              stroke="var(--heroui-foreground-400)"
              fontSize={12}
              label={{ 
                value: 'Hour of Day', 
                position: 'insideBottom',
                offset: -5,
                style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
              }}
            />
            <YAxis 
              dataKey="day" 
              name="Day" 
              type="number"
              domain={[0, 6]}
              tickFormatter={formatDayTick}
              stroke="var(--heroui-foreground-400)"
              fontSize={12}
              label={{ 
                value: 'Day of Week', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
              }}
            />
            <ZAxis 
              dataKey="value" 
              range={[0, 0]} 
              name="Value" 
            />
            <Tooltip
              formatter={(value: number) => [`${value} ${config.unit}`, 'Value']}
              labelFormatter={(_, payload) => {
                if (payload && payload.length > 0) {
                  const { day, hour } = payload[0].payload;
                  return `${formatDayTick(day)} at ${formatHourTick(hour)}`;
                }
                return '';
              }}
              contentStyle={{
                backgroundColor: 'var(--heroui-content1)',
                border: '1px solid var(--heroui-divider)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Scatter 
              data={heatmapData} 
              shape="square"
              fill="var(--heroui-primary-500)"
            >
              {heatmapData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={getColor(entry.value)} 
                  style={{
                    width: 20,
                    height: 20
                  }}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};