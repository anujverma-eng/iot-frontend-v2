import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import { Card, CardBody } from '@heroui/react';
import { Icon } from '@iconify/react';
import { ChartConfig } from '../../../types/sensor';

interface DistributionChartProps {
  config: ChartConfig;
  showCards?: boolean;
  showChart?: boolean;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({ 
  config, 
  showCards, 
  showChart,
}) => {
  const displayCards = showCards
  const displayChart = showChart
  // Generate histogram data
  const histogramData = React.useMemo(() => {
    if (!config.series || config.series.length === 0) {
      return {
        bins: [],
        stats: {
          min: 0,
          max: 0,
          mean: 0,
          stdDev: 0,
          count: 0
        }
      };
    }
    
    const values = config.series.map(point => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Create 10 bins
    const binCount = 10;
    const binSize = (max - min) / binCount;
    
    // Initialize bins
    const bins = Array.from({ length: binCount }, (_, i) => {
      const lowerBound = min + i * binSize;
      const upperBound = min + (i + 1) * binSize;
      return {
        range: `${lowerBound.toFixed(4)} - ${upperBound.toFixed(4)}`,
        lowerBound,
        upperBound,
        count: 0,
        percentage: 0
      };
    });
    
    // Count values in each bin
    values.forEach(value => {
      let binIndex = Math.min(
        Math.floor((value - min) / binSize),
        binCount - 1
      );
      // if binIndex is NaN or negative, set it to 0
      if (isNaN(binIndex) || binIndex < 0) {
        binIndex = 0;
      }
      bins[binIndex].count++;
    });
    
    // Calculate percentages
    const total = values.length;
    bins.forEach(bin => {
      bin.percentage = (bin.count / total) * 100;
    });
    
    // Calculate statistics
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      bins,
      stats: {
        min,
        max,
        mean,
        stdDev,
        count: values.length
      }
    };
  }, [config.series]);
  
  if (!histogramData.bins || histogramData.bins.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-default-500">No data available</p>
      </div>
    );
  }
  
  return (
    <div className={`w-full ${displayChart ? 'h-full' : ''}`}>
      <div className="flex flex-col h-full">
        {displayCards && (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card className="shadow-sm">
              <CardBody className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-default-500">Mean</p>
                    <p className="text-lg font-semibold">{histogramData.stats.mean.toFixed(4)}</p>
                    <p className="text-xs text-default-400">{config.unit}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-primary-50 text-primary">
                    <Icon icon="lucide:equal" width={18} />
                  </div>
                </div>
              </CardBody>
            </Card>
            
            <Card className="shadow-sm">
              <CardBody className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-default-500">Std Deviation</p>
                    <p className="text-lg font-semibold">{histogramData.stats.stdDev.toFixed(4)}</p>
                    <p className="text-xs text-default-400">{config.unit}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary-50 text-secondary">
                    <Icon icon="lucide:arrow-left-right" width={18} />
                  </div>
                </div>
              </CardBody>
            </Card>
            
            <Card className="shadow-sm">
              <CardBody className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-default-500">Minimum</p>
                    <p className="text-lg font-semibold">{histogramData.stats.min.toFixed(4)}</p>
                    <p className="text-xs text-default-400">{config.unit}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-danger-50 text-danger">
                    <Icon icon="lucide:arrow-down" width={18} />
                  </div>
                </div>
              </CardBody>
            </Card>
            
            <Card className="shadow-sm">
              <CardBody className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-default-500">Maximum</p>
                    <p className="text-lg font-semibold">{histogramData.stats.max.toFixed(4)}</p>
                    <p className="text-xs text-default-400">{config.unit}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-success-50 text-success">
                    <Icon icon="lucide:arrow-up" width={18} />
                  </div>
                </div>
              </CardBody>
            </Card>
            
            <Card className="shadow-sm">
              <CardBody className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-default-500">Count</p>
                    <p className="text-lg font-semibold">{histogramData.stats.count}</p>
                    <p className="text-xs text-default-400">readings</p>
                  </div>
                  <div className="p-2 rounded-lg bg-warning-50 text-warning">
                    <Icon icon="lucide:hash" width={18} />
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
        
        {displayChart && (
          <div className={`flex-1 ${displayChart ? 'h-full mt-5' : 'min-h-[300px]'}`}>
            <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={histogramData.bins}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="range" 
                stroke="#374151"
                tick={{ fill: "#374151" }}
                axisLine={{ stroke: "#94a3b8" }}
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={80}
                tickMargin={10}
                label={{ 
                  value: `${config.type.charAt(0).toUpperCase() + config.type.slice(1)} (${config.unit})`,
                  position: 'insideBottom',
                  offset: 40,
                  style: { textAnchor: 'middle', fill: '#4b5563', fontSize: 12 }
                }}
              />
              <YAxis 
                stroke="#374151"
                tick={{ fill: "#374151" }}
                axisLine={{ stroke: "#94a3b8" }}
                fontSize={12}
                tickMargin={10}
                label={{ 
                  value: 'Frequency', 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { 
                    textAnchor: 'middle', 
                    fill: "#4b5563",
                    fontSize: 12,
                    fontWeight: 500
                  },
                  offset: -10
                }} 
              />
              <Tooltip
                formatter={(value: number) => [`${value}`, 'Count']}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                  padding: "8px 12px"
                }}
                cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
              />
              
              {/* Mean reference line */}
              <ReferenceLine 
                x={histogramData.bins.findIndex(bin => 
                  bin.lowerBound <= histogramData.stats.mean && 
                  bin.upperBound >= histogramData.stats.mean
                )} 
                stroke="#4f46e5" 
                strokeDasharray="3 3"
                label={{ 
                  value: 'Mean', 
                  position: 'top', 
                  fill: '#4f46e5',
                  fontSize: 12
                }}
              />
              
              <Bar 
                dataKey="count" 
                fill="#6366f1" 
                radius={[4, 4, 0, 0]} 
                animationDuration={1200}
              >
                {histogramData.bins.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`rgba(99, 102, 241, ${0.4 + (entry.percentage / 200)})`} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
    </div>
  );
};