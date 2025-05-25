import React from 'react';
import { 
  ComposedChart, 
  Area, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Brush,
  Legend
} from 'recharts';
import { ChartConfig } from '../../types/sensor';

interface LightChartProps {
  config: ChartConfig;
  onBrushChange?: (start: Date, end: Date) => void;
  onZoomChange?: (isZoomed: boolean) => void;
}

export const LightChart: React.FC<LightChartProps> = ({
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
      minute: '2-digit'
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
  
  // Enhance light data with relative sunlight percentage
  const enhancedData = React.useMemo(() => {
    if (!config.series || config.series.length === 0) return [];
    
    // Find max value for normalization
    const maxLux = Math.max(...config.series.map(point => point.value));
    
    // Calculate time of day and relative sunlight
    return config.series.map(point => {
      const date = new Date(point.timestamp);
      const hour = date.getHours() + date.getMinutes() / 60;
      
      // Simple bell curve approximation for sunlight percentage based on time of day
      // Peak at noon (12:00), 0 at night (0:00 and 24:00)
      let sunlightPct = 0;
      if (hour >= 6 && hour <= 18) {
        // Bell curve between 6am and 6pm
        sunlightPct = 100 * Math.sin(Math.PI * (hour - 6) / 12);
      }
      
      return {
        ...point,
        sunlightPct,
        normalizedValue: (point.value / maxLux) * 100 // Normalize to percentage
      };
    });
  }, [config.series]);
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={enhancedData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
            <XAxis 
              dataKey="timestamp" 
              tickFormatter={formatXAxis} 
              stroke="var(--heroui-foreground-400)"
              fontSize={12}
              allowDataOverflow={!!zoomDomain}
              domain={zoomDomain ? zoomDomain.x : ['dataMin', 'dataMax']}
            />
            <YAxis 
              yAxisId="lux"
              stroke="var(--heroui-foreground-400)" 
              fontSize={12}
              label={{ 
                value: config.unit, 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
              }}
              allowDataOverflow={!!zoomDomain}
              domain={zoomDomain ? ['auto', 'auto'] : [0, 'dataMax + 100']}
            />
            <YAxis 
              yAxisId="pct"
              orientation="right"
              stroke="var(--heroui-foreground-400)" 
              fontSize={12}
              label={{ 
                value: '%', 
                angle: 90, 
                position: 'insideRight',
                style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
              }}
              domain={[0, 100]}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'value') return [`${value} ${config.unit}`, 'Illuminance'];
                if (name === 'sunlightPct') return [`${value.toFixed(1)}%`, 'Sunlight'];
                return [`${value}`, name];
              }}
              labelFormatter={(label: number) => formatTooltipDate(label)}
              contentStyle={{
                backgroundColor: 'var(--heroui-content1)',
                border: '1px solid var(--heroui-divider)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
            />
            <Legend />
            
            <defs>
              <linearGradient id="luxGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--heroui-warning)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--heroui-warning)" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="sunGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--heroui-primary)" stopOpacity={0.5}/>
                <stop offset="95%" stopColor="var(--heroui-primary)" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            
            {/* Illuminance Area */}
            <Area
              yAxisId="lux"
              type="monotone"
              dataKey="value"
              name="value"
              stroke="var(--heroui-warning)"
              fill="url(#luxGradient)"
              activeDot={{ r: 4 }}
            />
            
            {/* Sunlight Percentage Line */}
            <Area
              yAxisId="pct"
              type="monotone"
              dataKey="sunlightPct"
              name="sunlightPct"
              stroke="var(--heroui-primary)"
              fill="url(#sunGradient)"
              activeDot={{ r: 4 }}
            />
            
            <Brush 
              dataKey="timestamp" 
              height={30} 
              stroke="var(--heroui-primary)"
              tickFormatter={formatXAxis}
              onChange={handleBrushChange}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};