import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { ChartConfig } from '../../types/sensor';

interface HistogramChartProps {
  config: ChartConfig;
}

export const HistogramChart: React.FC<HistogramChartProps> = ({
  config
}) => {
  // Generate histogram data from series
  const histogramData = React.useMemo(() => {
    if (!config.series || config.series.length === 0) return [];
    
    // Find min and max values
    const values = config.series.map(point => point.value);
    const min = Math.floor(Math.min(...values));
    const max = Math.ceil(Math.max(...values));
    
    // Calculate bin size (10 bins)
    const binCount = 10;
    const binSize = (max - min) / binCount;
    
    // Initialize bins
    const bins: Record<string, number> = {};
    for (let i = 0; i < binCount; i++) {
      const binStart = min + i * binSize;
      const binEnd = binStart + binSize;
      bins[`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`] = 0;
    }
    
    // Fill bins
    values.forEach(value => {
      for (let i = 0; i < binCount; i++) {
        const binStart = min + i * binSize;
        const binEnd = binStart + binSize;
        
        if (value >= binStart && value < binEnd) {
          const binKey = `${binStart.toFixed(1)}-${binEnd.toFixed(1)}`;
          bins[binKey]++;
          break;
        }
      }
    });
    
    // Convert to array
    return Object.entries(bins).map(([bin, count]) => ({
      bin,
      count
    }));
  }, [config.series]);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={histogramData}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
        <XAxis 
          dataKey="bin" 
          stroke="var(--heroui-foreground-400)"
          fontSize={12}
          label={{ 
            value: config.unit, 
            position: 'insideBottom',
            offset: -5,
            style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
          }}
        />
        <YAxis 
          stroke="var(--heroui-foreground-400)" 
          fontSize={12}
          label={{ 
            value: 'Count', 
            angle: -90, 
            position: 'insideLeft',
            style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
          }}
        />
        <Tooltip
          formatter={(value: number) => [`${value}`, 'Count']}
          labelFormatter={(label: string) => `Range: ${label} ${config.unit}`}
          contentStyle={{
            backgroundColor: 'var(--heroui-content1)',
            border: '1px solid var(--heroui-divider)',
            borderRadius: '8px',
            fontSize: '12px'
          }}
        />
        <Bar dataKey="count" fill="var(--heroui-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};