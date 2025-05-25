import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ChartConfig } from '../../types/sensor';
import { CHART_COLORS } from '../../data/analytics';

interface GaugeChartProps {
  config: ChartConfig;
  size?: 'sm' | 'md' | 'lg';
}

export const GaugeChart: React.FC<GaugeChartProps> = ({ 
  config,
  size = 'md'
}) => {
  // Get the most recent value
  const currentValue = config.series.length > 0 
    ? config.series[config.series.length - 1].value 
    : 0;
  
  // Determine min, max, and colors based on sensor type
  const getMinMax = () => {
    switch (config.type) {
      case 'temperature':
        return { min: -10, max: 40 };
      case 'humidity':
        return { min: 0, max: 100 };
      case 'pressure':
        return { min: 950, max: 1050 };
      case 'battery':
        return { min: 0, max: 100 };
      default:
        return { min: 0, max: 100 };
    }
  };
  
  const { min, max } = getMinMax();
  
  // Calculate percentage for gauge
  const percentage = Math.max(0, Math.min(100, ((currentValue - min) / (max - min)) * 100));
  
  // Determine color based on type and value
  const getColor = () => {
    if (config.type === 'battery') {
      if (currentValue < 10) return "#f43f5e"; // danger
      if (currentValue < 30) return "#f59e0b"; // warning
      return "#10b981"; // success
    }
    
    if (config.type === 'temperature') {
      if (currentValue > 30) return "#f43f5e"; // danger - hot
      if (currentValue < 10) return "#3b82f6"; // primary - cold
      return "#10b981"; // success - normal
    }
    
    if (config.type === 'humidity') {
      if (currentValue > 80) return "#3b82f6"; // primary - wet
      if (currentValue < 30) return "#f59e0b"; // warning - dry
      return "#10b981"; // success - normal
    }
    
    return config.color || "#4f46e5"; // default
  };
  
  const color = getColor();
  
  // Prepare data for the gauge chart
  const data = [
    { name: 'value', value: percentage },
    { name: 'empty', value: 100 - percentage }
  ];
  
  // Size configurations
  const sizeConfig = {
    sm: { height: 120, fontSize: 16, labelSize: 12 },
    md: { height: 180, fontSize: 24, labelSize: 14 },
    lg: { height: 240, fontSize: 32, labelSize: 16 }
  };
  
  const { height, fontSize, labelSize } = sizeConfig[size];
  
  return (
    <div className="flex flex-col items-center justify-center" style={{ height }}>
      <div className="relative w-full h-full flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-gray-100 dark:bg-gray-800"></div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            {/* Background track for gauge */}
            <Pie
              data={[{ name: 'background', value: 100 }]}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="80%"
              paddingAngle={0}
              dataKey="value"
              strokeWidth={0}
              fill="#e5e7eb"
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              startAngle={180}
              endAngle={0}
              innerRadius="60%"
              outerRadius="80%"
              paddingAngle={0}
              dataKey="value"
              strokeWidth={0}
              animationDuration={1200}
              animationBegin={300}
            >
              <Cell fill={color} />
              <Cell fill="transparent" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-center">
            <div style={{ fontSize }} className="font-semibold">
              {currentValue}
            </div>
            <div style={{ fontSize: labelSize }} className="text-gray-500">
              {config.unit}
            </div>
          </div>
        </div>
        
        {/* Add tick marks */}
        <div className="absolute inset-0">
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = -180 + (tick * 1.8); // Convert percentage to angle (180 degrees total)
            const radian = (angle * Math.PI) / 180;
            const x = 50 + 45 * Math.cos(radian); // 50% is center, 45% is radius to tick
            const y = 50 + 45 * Math.sin(radian);
            
            return (
              <div 
                key={tick} 
                className="absolute w-1 h-3 bg-gray-400" 
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: `translate(-50%, -50%) rotate(${angle + 90}deg)`
                }}
              />
            );
          })}
        </div>
      </div>
      
      {/* Add min/max labels */}
      <div className="flex justify-between w-full mt-2 px-4">
        <span className="text-xs text-gray-500">{min}</span>
        <span className="text-xs text-gray-500">{max}</span>
      </div>
    </div>
  );
};