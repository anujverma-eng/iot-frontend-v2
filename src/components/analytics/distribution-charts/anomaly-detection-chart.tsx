import React from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  ZAxis,
  Cell
} from 'recharts';
import { Card, CardBody, Chip } from '@heroui/react';
import { Icon } from '@iconify/react';
import { ChartConfig } from '../../../types/sensor';

interface AnomalyDetectionChartProps {
  config: ChartConfig;
  compact?: boolean;
}

export const AnomalyDetectionChart: React.FC<AnomalyDetectionChartProps> = ({ config, compact = false }) => {
  // Calculate anomalies using Z-score method
  const anomalyData = React.useMemo(() => {
    if (!config.series || config.series.length < 10) return null;
    
    const values = config.series.map(point => point.value);
    
    // Calculate mean and standard deviation
    const sum = values.reduce((acc, val) => acc + val, 0);
    const mean = sum / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate Z-scores
    const zScoreThreshold = 2.5; // Points with Z-score > 2.5 are considered anomalies
    const dataWithZScores = config.series.map(point => {
      const zScore = Math.abs((point.value - mean) / stdDev);
      const isAnomaly = zScore > zScoreThreshold;
      
      return {
        ...point,
        zScore,
        isAnomaly,
        anomalyType: point.value > mean ? 'high' : 'low'
      };
    });
    
    // Find anomalies
    const anomalies = dataWithZScores.filter(point => point.isAnomaly);
    
    // Calculate upper and lower bounds
    const upperBound = mean + zScoreThreshold * stdDev;
    const lowerBound = mean - zScoreThreshold * stdDev;
    
    return {
      dataWithZScores,
      anomalies,
      stats: {
        mean,
        stdDev,
        upperBound,
        lowerBound,
        anomalyCount: anomalies.length,
        anomalyPercentage: (anomalies.length / values.length) * 100
      }
    };
  }, [config.series]);
  
  if (!anomalyData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-default-500">Insufficient data for anomaly detection</p>
      </div>
    );
  }
  
  return (
    <div className={`w-full ${compact ? 'h-full' : ''}`}>
      <div className="flex flex-col h-full">
        {!compact && (
          <div className="mb-4">
            <Card className="shadow-sm">
              <CardBody className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-danger-50 text-danger">
                      <Icon icon="lucide:alert-triangle" width={18} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Anomaly Detection</p>
                      <p className="text-xs text-default-500">
                        Using Z-score method (threshold: 2.5σ)
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Chip 
                      color={anomalyData.stats.anomalyCount > 0 ? "danger" : "success"} 
                      variant="flat"
                    >
                      {anomalyData.stats.anomalyCount} anomalies detected
                    </Chip>
                    
                    <Chip variant="flat" color="secondary">
                      {anomalyData.stats.anomalyPercentage.toFixed(1)}% of data
                    </Chip>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        )}
        
        <div className={`flex-1 ${compact ? 'h-full' : 'min-h-[300px]'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="timestamp" 
                name="Time"
                stroke="#374151"
                tick={{ fill: "#374151" }}
                axisLine={{ stroke: "#94a3b8" }}
                fontSize={12}
                tickMargin={10}
                tickFormatter={(timestamp) => new Date(timestamp).toLocaleDateString()}
                type="number"
                domain={['dataMin', 'dataMax']}
              />
              <YAxis 
                dataKey="value"
                name="Value"
                stroke="#374151"
                tick={{ fill: "#374151" }}
                axisLine={{ stroke: "#94a3b8" }}
                fontSize={12}
                tickMargin={10}
                domain={['auto', 'auto']}
                label={{ 
                  value: config.unit, 
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
              <ZAxis dataKey="zScore" range={[20, 200]} name="Z-score" />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Value') return [`${value.toFixed(2)} ${config.unit}`, name];
                  if (name === 'Z-score') return [`${value.toFixed(2)}`, name];
                  return [`${value}`, name];
                }}
                labelFormatter={(timestamp) => new Date(timestamp).toLocaleString()}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                  padding: "8px 12px"
                }}
              />
              
              {/* Reference lines for bounds */}
              <ReferenceLine 
                y={anomalyData.stats.upperBound} 
                stroke="#ef4444" 
                strokeDasharray="3 3"
                label={{ 
                  value: 'Upper bound', 
                  position: 'right', 
                  fill: '#ef4444',
                  fontSize: 12
                }}
              />
              <ReferenceLine 
                y={anomalyData.stats.lowerBound} 
                stroke="#ef4444" 
                strokeDasharray="3 3"
                label={{ 
                  value: 'Lower bound', 
                  position: 'right', 
                  fill: '#ef4444',
                  fontSize: 12
                }}
              />
              <ReferenceLine 
                y={anomalyData.stats.mean} 
                stroke="#6b7280" 
                strokeDasharray="3 3"
                label={{ 
                  value: 'Mean', 
                  position: 'right', 
                  fill: '#6b7280',
                  fontSize: 12
                }}
              />
              
              {/* Normal data points */}
              <Scatter 
                name="Normal" 
                data={anomalyData.dataWithZScores.filter(point => !point.isAnomaly)} 
                fill="#6366f1"
              />
              
              {/* Anomaly data points */}
              <Scatter 
                name="Anomaly" 
                data={anomalyData.anomalies} 
                shape="circle"
              >
                {anomalyData.anomalies.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.anomalyType === 'high' ? '#ef4444' : '#f59e0b'} 
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        
        {!compact && anomalyData.anomalies.length > 0 && (
          <div className="mt-4">
            <Card className="shadow-sm">
              <CardBody className="p-4">
                <h3 className="text-sm font-medium mb-2">Anomaly Details</h3>
                <div className="max-h-40 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Z-Score</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {anomalyData.anomalies.slice(0, 5).map((anomaly, index) => (
                        <tr key={index}>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            {new Date(anomaly.timestamp).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs font-medium">
                            {anomaly.value.toFixed(2)} {config.unit}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-xs">
                            {anomaly.zScore.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Chip 
                              size="sm" 
                              color={anomaly.anomalyType === 'high' ? 'danger' : 'warning'}
                              variant="flat"
                            >
                              {anomaly.anomalyType === 'high' ? 'High' : 'Low'}
                            </Chip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {anomalyData.anomalies.length > 5 && (
                    <div className="text-center text-xs text-gray-500 py-2">
                      + {anomalyData.anomalies.length - 5} more anomalies
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};