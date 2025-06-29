import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react';
import { ChartConfig } from '../../types/sensor';
import { axisStyle, CHART_COLORS, tooltipStyle } from '../../data/analytics';

interface PressureChartProps {
  config: ChartConfig;
  onBrushChange?: (start: Date, end: Date) => void;
  onDownloadCSV?: () => void;
}

export const PressureChart: React.FC<PressureChartProps> = ({
  config,
  onBrushChange,
  onDownloadCSV
}) => {
  // Find min and max values in the data
  const minValue = React.useMemo(() => 
    Math.min(...config.series.map(point => point.value)),
    [config.series]
  );
  
  const maxValue = React.useMemo(() => 
    Math.max(...config.series.map(point => point.value)),
    [config.series]
  );
  
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
  
  const handleDownloadCSV = () => {
    if (!onDownloadCSV) return;
    onDownloadCSV();
  };
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2 px-4">
        <div className="flex items-center gap-4">
          <div className="text-sm font-medium">
            Pressure Data
          </div>
          
          <div className="flex items-center gap-2 text-xs">
            <span className="text-default-500">Range:</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-danger rounded-full"></div>
              <span>{minValue} {config.unit}</span>
            </div>
            <span>—</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-success rounded-full"></div>
              <span>{maxValue} {config.unit}</span>
            </div>
          </div>
        </div>
{/*         
        <Button
          size="sm"
          variant="light"
          isIconOnly
          onPress={handleDownloadCSV}
          title="Download CSV"
        >
          <Icon icon="lucide:download" width={16} />
        </Button> */}
      </div>
      
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
          <LineChart
            data={config.series}
            margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
            <XAxis 
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              {...axisStyle}
            />
           <YAxis
              {...axisStyle}
              domain={['dataMin - 5', 'dataMax + 5']}
              label={{
                value: config.unit,
                angle: -90,
                position: 'insideLeft',
                style: { ...axisStyle, fill: CHART_COLORS.text }
              }}
            />
            <Tooltip
              formatter={(value: number) => [`${value} ${config.unit}`, '']}
              labelFormatter={formatTooltipDate}
              contentStyle={tooltipStyle}
              itemStyle={{ color: CHART_COLORS.text }}
            />
            
            <ReferenceLine y={minValue} stroke="var(--heroui-danger)" strokeDasharray="3 3" />
            <ReferenceLine y={maxValue} stroke="var(--heroui-success)" strokeDasharray="3 3" />
            
            <Line
              type="monotone"
              dataKey="value"
              stroke={config.color || CHART_COLORS.primary}
              dot={false}
              activeDot={{
                r: 6,
                fill: CHART_COLORS.primary,
                stroke: CHART_COLORS.tooltipBg,
                strokeWidth: 2
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};