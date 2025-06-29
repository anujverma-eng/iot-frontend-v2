import { Card } from '@heroui/react';
import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ChartConfig } from '../../types/sensor';

interface BatteryChartProps {
  config: ChartConfig;
  showHistory?: boolean;
  onDownloadCSV?: () => void;
  onZoomChange?: (isZoomed: boolean) => void;
}

export const BatteryChart: React.FC<BatteryChartProps> = ({
  config,
  showHistory = true,
  onDownloadCSV,
  onZoomChange
}) => {
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
  
  // Calculate discharge rate data
  const dischargeRateData = React.useMemo(() => {
    if (!showHistory || config.series.length < 2) return [];
    
    const hourlyData: Record<string, { value: number, timestamp: number }> = {};
    
    // Group by hour first
    config.series.forEach(point => {
      const date = new Date(point.timestamp);
      date.setMinutes(0, 0, 0); // Round to hour
      const hourKey = date.toISOString();
      
      if (!hourlyData[hourKey] || point.timestamp > hourlyData[hourKey].timestamp) {
        hourlyData[hourKey] = {
          value: point.value,
          timestamp: point.timestamp
        };
      }
    });
    
    // Convert to array and sort
    const hourlyPoints = Object.values(hourlyData).sort((a, b) => a.timestamp - b.timestamp);
    
    // Calculate discharge rate (% per hour)
    const result = [];
    for (let i = 1; i < hourlyPoints.length; i++) {
      const prevPoint = hourlyPoints[i - 1];
      const currPoint = hourlyPoints[i];
      
      const hoursDiff = (currPoint.timestamp - prevPoint.timestamp) / (1000 * 60 * 60);
      if (hoursDiff > 0) {
        const dischargePct = (prevPoint.value - currPoint.value) / hoursDiff;
        
        result.push({
          timestamp: currPoint.timestamp,
          rate: dischargePct > 0 ? dischargePct : 0, // Only show discharge, not charging
          averageRate: 0.5 // Mock average rate (would come from historical data)
        });
      }
    }
    
    return result;
  }, [config.series, showHistory]);
  
  // Get current battery level for donut chart
  const currentBatteryLevel = React.useMemo(() => {
    if (config.series.length === 0) return 0;
    return config.series[config.series.length - 1].value;
  }, [config.series]);
  
  // Get color based on battery level
  const getBatteryColor = (level: number) => {
    if (level <= 10) return 'var(--heroui-danger)';
    if (level <= 30) return 'var(--heroui-warning)';
    return 'var(--heroui-success)';
  };
  
  // Prepare data for donut chart
  const donutData = [
    { name: 'battery', value: currentBatteryLevel },
    { name: 'empty', value: 100 - currentBatteryLevel }
  ];
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-4">
        <Card className="p-4 flex items-center justify-center">
          <div className="w-32 h-32 relative">
            <div className="absolute inset-0 rounded-full bg-content2"></div>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                {/* Background track for gauge */}
                <Pie
                  data={[{ name: 'background', value: 100 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={24}
                  outerRadius={32}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={0}
                  dataKey="value"
                  strokeWidth={0}
                  fill="var(--heroui-default-200)"
                />
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={24}
                  outerRadius={32}
                  startAngle={90}
                  endAngle={-270}
                  paddingAngle={0}
                  dataKey="value"
                  strokeWidth={0}
                >
                  <Cell fill={getBatteryColor(currentBatteryLevel)} />
                  <Cell fill="transparent" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-2xl font-semibold">
                  {currentBatteryLevel}%
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
      
      {showHistory && (
        <>
          <div className="flex-1 min-h-[200px]">
            <div className="text-sm font-medium mb-2 px-4">Battery History</div>
            <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
              <AreaChart
                data={config.series}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={formatXAxis} 
                  stroke="var(--heroui-foreground-400)"
                  fontSize={12}
                />
                <YAxis 
                  stroke="var(--heroui-foreground-400)" 
                  fontSize={12}
                  domain={[0, 100]}
                  label={{ 
                    value: '%', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
                  }} 
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, '']}
                  labelFormatter={(label: number) => formatTooltipDate(label)}
                  contentStyle={{
                    backgroundColor: 'var(--heroui-content1)',
                    border: '1px solid var(--heroui-divider)',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <defs>
                  <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--heroui-warning)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--heroui-warning)" stopOpacity={0.2}/>
                  </linearGradient>
                </defs>
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--heroui-warning)" 
                  fill="url(#batteryGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          {dischargeRateData.length > 0 && (
            <div className="mt-4 h-40">
              <div className="text-sm font-medium mb-2 px-4">Discharge Rate (% per hour)</div>
              <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
                <AreaChart
                  data={dischargeRateData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={formatXAxis} 
                    stroke="var(--heroui-foreground-400)"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="var(--heroui-foreground-400)" 
                    fontSize={12}
                    domain={[0, 'auto']}
                    label={{ 
                      value: '% / hour', 
                      angle: -90, 
                      position: 'insideLeft',
                      style: { textAnchor: 'middle', fill: 'var(--heroui-foreground-500)', fontSize: 12 }
                    }} 
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'rate') return [`${value.toFixed(4)}% / hour`, 'Current'];
                      return [`${value.toFixed(4)}% / hour`, 'Average'];
                    }}
                    labelFormatter={(label: number) => formatTooltipDate(label)}
                    contentStyle={{
                      backgroundColor: 'var(--heroui-content1)',
                      border: '1px solid var(--heroui-divider)',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                  />
                  <defs>
                    <linearGradient id="dischargeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--heroui-danger)" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="var(--heroui-danger)" stopOpacity={0.2}/>
                    </linearGradient>
                  </defs>
                  <Area 
                    type="monotone" 
                    dataKey="rate" 
                    stroke="var(--heroui-danger)" 
                    fill="url(#dischargeGradient)" 
                    stackId="1"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="averageRate" 
                    stroke="var(--heroui-default-500)" 
                    strokeDasharray="5 5"
                    fill="none"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
};