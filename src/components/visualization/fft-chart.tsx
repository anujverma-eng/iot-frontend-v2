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

interface FFTChartProps {
  config: ChartConfig;
}

export const FFTChart: React.FC<FFTChartProps> = ({
  config
}) => {
  // Generate mock FFT data
  const fftData = React.useMemo(() => {
    // In a real implementation, this would be calculated from the time series data
    // or fetched from an API
    
    // Mock data for demonstration
    const frequencies = [1, 2, 5, 10, 15, 20, 25, 30, 40, 50];
    
    return frequencies.map(freq => ({
      frequency: freq,
      amplitude: Math.random() * 0.8 + 0.2 // Random amplitude between 0.2 and 1.0
    }));
  }, []);
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={fftData}
        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
        <XAxis 
          dataKey="frequency" 
          stroke="var(--heroui-foreground-400)"
          fontSize={12}
          label={{ 
            value: 'Frequency (Hz)', 
            position: 'insideBottom',
            offset: -5,
            style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
          }}
        />
        <YAxis 
          stroke="var(--heroui-foreground-400)" 
          fontSize={12}
          label={{ 
            value: 'Amplitude', 
            angle: -90, 
            position: 'insideLeft',
            style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
          }}
          domain={[0, 1]}
        />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(3)}`, 'Amplitude']}
          labelFormatter={(label: number) => `${label} Hz`}
          contentStyle={{
            backgroundColor: 'var(--heroui-content1)',
            border: '1px solid var(--heroui-divider)',
            borderRadius: '8px',
            fontSize: '12px'
          }}
        />
        <Bar dataKey="amplitude" fill="var(--heroui-secondary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};