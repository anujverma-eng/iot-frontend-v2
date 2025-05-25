import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from 'recharts';
import { ChartConfig } from '../../types/sensor';
import { Button } from '@heroui/react';
import { Icon } from '@iconify/react/dist/iconify.js';

interface HistogramChartProps {
  config: ChartConfig;
}

export const HistogramChart: React.FC<HistogramChartProps> = ({ config }) => {
  const [viewMode, setViewMode] = React.useState<'chart' | 'table'>('chart');
  
  // Generate histogram data
  const histogramData = React.useMemo(() => {
    if (!config.series || config.series.length === 0) return [];
    
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
        range: `${lowerBound.toFixed(1)} - ${upperBound.toFixed(1)}`,
        lowerBound,
        upperBound,
        count: 0,
        percentage: 0
      };
    });
    
    // Count values in each bin
    values.forEach(value => {
      const binIndex = Math.min(
        Math.floor((value - min) / binSize),
        binCount - 1
      );
      bins[binIndex].count++;
    });
    
    // Calculate percentages
    const total = values.length;
    bins.forEach(bin => {
      bin.percentage = (bin.count / total) * 100;
    });
    
    return bins;
  }, [config.series]);
  
  if (histogramData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-default-500">No data available</p>
      </div>
    );
  }
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm font-medium text-secondary-600">
          Value Distribution
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === 'chart' ? 'solid' : 'flat'}
            color={viewMode === 'chart' ? 'secondary' : 'default'}
            onPress={() => setViewMode('chart')}
            startContent={<Icon icon="lucide:bar-chart-2" width={16} />}
          >
            Chart
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'table' ? 'solid' : 'flat'}
            color={viewMode === 'table' ? 'secondary' : 'default'}
            onPress={() => setViewMode('table')}
            startContent={<Icon icon="lucide:table" width={16} />}
          >
            Table
          </Button>
        </div>
      </div>
      
      {viewMode === 'chart' ? (
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={histogramData}
              margin={{ top: 5, right: 20, left: 10, bottom: 30 }}
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
              />
              <YAxis 
                stroke="#374151"
                tick={{ fill: "#374151" }}
                axisLine={{ stroke: "#94a3b8" }}
                fontSize={12}
                tickMargin={10}
                label={{ 
                  value: 'Count', 
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
              <Bar 
                dataKey="count" 
                fill="#6366f1" 
                radius={[4, 4, 0, 0]} 
                animationDuration={1200}
              >
                {histogramData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`rgba(99, 102, 241, ${0.4 + (entry.percentage / 200)})`} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full min-w-full table-auto border-collapse">
            <thead>
              <tr className="bg-secondary-50 dark:bg-secondary-900/20">
                <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700 dark:text-secondary-300">Range ({config.unit})</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700 dark:text-secondary-300">Count</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-secondary-700 dark:text-secondary-300">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {histogramData.map((item, index) => (
                <tr 
                  key={index} 
                  className={`border-b border-gray-200 dark:border-gray-700 ${
                    index % 2 === 0 
                      ? 'bg-white dark:bg-gray-900' 
                      : 'bg-gray-50 dark:bg-gray-800'
                  } hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors`}
                >
                  <td className="px-4 py-3 text-sm">{item.range}</td>
                  <td className="px-4 py-3 text-sm font-medium">{item.count}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div 
                          className="bg-secondary-500 h-2.5 rounded-full" 
                          style={{ width: `${item.percentage}%` }}
                        ></div>
                      </div>
                      <span>{item.percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};