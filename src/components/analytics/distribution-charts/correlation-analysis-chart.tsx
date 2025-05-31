import { Card, CardBody, Chip, Divider } from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { ChartConfig } from '../../../types/sensor';

interface CorrelationAnalysisChartProps {
  config: ChartConfig;
  secondaryConfig?: ChartConfig;
  compact?: boolean;
}

export const CorrelationAnalysisChart: React.FC<CorrelationAnalysisChartProps> = ({ 
  config, 
  secondaryConfig,
  compact = false 
}) => {
  // If no secondary config is provided, we'll analyze autocorrelation
  // (correlation between current values and lagged values)
  const correlationData = React.useMemo(() => {
    if (!config.series || config.series.length < 10) return null;
    
    if (secondaryConfig && secondaryConfig.series && secondaryConfig.series.length >= 10) {
      // Cross-correlation between two sensors
      // First, align timestamps by finding common time periods
      const primaryTimestamps = new Map(
        config.series.map(point => [point.timestamp, point.value])
      );
      
      const secondaryTimestamps = new Map(
        secondaryConfig.series.map(point => [point.timestamp, point.value])
      );
      
      // Find common timestamps
      const commonPoints = [];
      
      for (const [timestamp, primaryValue] of primaryTimestamps.entries()) {
        if (secondaryTimestamps.has(timestamp)) {
          commonPoints.push({
            timestamp,
            primaryValue,
            secondaryValue: secondaryTimestamps.get(timestamp)
          });
        }
      }
      
      if (commonPoints.length < 10) {
        return {
          type: 'cross',
          error: 'Insufficient overlapping data points'
        };
      }
      
      // Calculate correlation coefficient
      const primaryValues = commonPoints.map(p => p.primaryValue);
      const secondaryValues = commonPoints.map(p => p.secondaryValue).filter((v): v is number => typeof v === 'number');
      
      const primaryMean = primaryValues.reduce((sum, val) => sum + val, 0) / primaryValues.length;
      const secondaryMean = secondaryValues.reduce((sum, val) => sum + val, 0) / secondaryValues.length;
      
      let numerator = 0;
      let primaryDenominator = 0;
      let secondaryDenominator = 0;
      
      for (let i = 0; i < primaryValues.length; i++) {
        const primaryDiff = primaryValues[i] - primaryMean;
        const secondaryDiff = secondaryValues[i] - secondaryMean;
        
        numerator += primaryDiff * secondaryDiff;
        primaryDenominator += primaryDiff * primaryDiff;
        secondaryDenominator += secondaryDiff * secondaryDiff;
      }
      
      const correlation = numerator / (Math.sqrt(primaryDenominator) * Math.sqrt(secondaryDenominator));
      
      // Calculate linear regression for trendline
      const slope = numerator / primaryDenominator;
      const intercept = secondaryMean - slope * primaryMean;
      
      // Generate trendline points
      const minPrimary = Math.min(...primaryValues);
      const maxPrimary = Math.max(...primaryValues);
      
      const trendline = [
        { x: minPrimary, y: intercept + slope * minPrimary },
        { x: maxPrimary, y: intercept + slope * maxPrimary }
      ];
      
      return {
        type: 'cross',
        points: commonPoints,
        correlation,
        trendline,
        primaryUnit: config.unit,
        secondaryUnit: secondaryConfig.unit,
        primaryType: config.type,
        secondaryType: secondaryConfig.type
      };
    } else {
      // Autocorrelation (time series with itself at different lags)
      const values = config.series.map(point => point.value);
      const maxLag = Math.min(20, Math.floor(values.length / 3));
      
      const autocorrelations = [];
      
      for (let lag = 0; lag <= maxLag; lag++) {
        if (lag === 0) {
          // Correlation with itself is always 1
          autocorrelations.push({ lag, correlation: 1 });
          continue;
        }
        
        let numerator = 0;
        let denominator = 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        
        for (let i = 0; i < values.length - lag; i++) {
          numerator += (values[i] - mean) * (values[i + lag] - mean);
        }
        
        for (let i = 0; i < values.length; i++) {
          denominator += Math.pow(values[i] - mean, 2);
        }
        
        const correlation = numerator / denominator;
        autocorrelations.push({ lag, correlation });
      }
      
      // Find significant lags (where |correlation| > 0.2)
      const significantLags = autocorrelations
        .filter(ac => Math.abs(ac.correlation) > 0.2 && ac.lag > 0)
        .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
      
      return {
        type: 'auto',
        autocorrelations,
        significantLags,
        unit: config.unit
      };
    }
  }, [config.series, secondaryConfig]);
  
  if (!correlationData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-default-500">Insufficient data for correlation analysis</p>
      </div>
    );
  }
  
  if (correlationData.type === 'cross' && correlationData.error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-default-500">{correlationData.error}</p>
      </div>
    );
  }
  
  const getCorrelationDescription = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.8) return 'Very strong';
    if (abs >= 0.6) return 'Strong';
    if (abs >= 0.4) return 'Moderate';
    if (abs >= 0.2) return 'Weak';
    return 'Very weak';
  };
  
  const getCorrelationColor = (correlation: number) => {
    const abs = Math.abs(correlation);
    if (abs >= 0.6) return 'success';
    if (abs >= 0.4) return 'primary';
    if (abs >= 0.2) return 'warning';
    return 'default';
  };
  
  return (
    <div className={`w-full ${compact ? 'h-full' : ''}`}>
      <div className="flex flex-col h-full">
        {correlationData.type === 'cross' ? (
          // Cross-correlation between two sensors
          <>
            {!compact && (
              <div className="mb-4">
                <Card className="shadow-sm">
                  <CardBody className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary-50 text-primary">
                          <Icon icon="lucide:git-merge" width={18} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Correlation Analysis</p>
                          <p className="text-xs text-default-500">
                            Between {correlationData.primaryType} and {correlationData.secondaryType}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Chip 
                          color={getCorrelationColor(correlationData.correlation ?? 0)} 
                          variant="flat"
                        >
                          {getCorrelationDescription(correlationData.correlation ?? 0)} correlation
                        </Chip>
                        
                        <Chip variant="flat" color="secondary">
                          r = {(correlationData.correlation ?? 0).toFixed(2)}
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
                    type="number"
                    dataKey="primaryValue"
                    name={correlationData.primaryType}
                    stroke="#374151"
                    tick={{ fill: "#374151" }}
                    axisLine={{ stroke: "#94a3b8" }}
                    fontSize={12}
                    tickMargin={10}
                    domain={['auto', 'auto']}
                    label={{ 
                      value: `${correlationData.primaryType} (${correlationData.primaryUnit})`, 
                      position: 'insideBottom',
                      offset: 0,
                      style: { textAnchor: 'middle', fill: '#4b5563', fontSize: 12 }
                    }}
                  />
                  <YAxis 
                    type="number"
                    dataKey="secondaryValue"
                    name={correlationData.secondaryType}
                    stroke="#374151"
                    tick={{ fill: "#374151" }}
                    axisLine={{ stroke: "#94a3b8" }}
                    fontSize={12}
                    tickMargin={10}
                    domain={['auto', 'auto']}
                    label={{ 
                      value: `${correlationData.secondaryType} (${correlationData.secondaryUnit})`, 
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
                    formatter={(value: number, name: string) => {
                      if (name === correlationData.primaryType) 
                        return [`${value.toFixed(2)} ${correlationData.primaryUnit}`, name];
                      if (name === correlationData.secondaryType) 
                        return [`${value.toFixed(2)} ${correlationData.secondaryUnit}`, name];
                      return [`${value}`, name];
                    }}
                    labelFormatter={() => `Correlation: ${(correlationData.correlation ?? 0).toFixed(2)}`}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                      padding: "8px 12px"
                    }}
                  />
                  
                  {/* Scatter plot of data points */}
                  <Scatter 
                    name="Data" 
                    data={correlationData.points} 
                    fill="#6366f1"
                  />
                  
                  {/* Trend line */}
                  <Scatter 
                    name="Trend" 
                    data={correlationData.trendline} 
                    line={{ stroke: '#ef4444', strokeWidth: 2 }}
                    lineType="fitting"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          // Autocorrelation analysis
          <>
            {!compact && (
              <div className="mb-4">
                <Card className="shadow-sm">
                  <CardBody className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary-50 text-primary">
                          <Icon icon="lucide:repeat" width={18} />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Autocorrelation Analysis</p>
                          <p className="text-xs text-default-500">
                            Time series correlation with lagged values
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {(correlationData.significantLags ?? []).length > 0 ? (
                          <Chip 
                            color="primary" 
                            variant="flat"
                          >
                            {(correlationData.significantLags ?? []).length} significant patterns found
                          </Chip>
                        ) : (
                          <Chip 
                            color="default" 
                            variant="flat"
                          >
                            No significant patterns found
                          </Chip>
                        )}
                      </div>
                    </div>
                    
                    {(correlationData.significantLags ?? []).length > 0 && (
                      <>
                        <Divider className="my-3" />
                        <div className="text-xs text-default-500 mb-2">Significant lags:</div>
                        <div className="flex flex-wrap gap-2">
                          {(correlationData.significantLags ?? []).slice(0, 5).map((lag, index) => (
                            <Chip 
                              key={index}
                              color={getCorrelationColor(lag.correlation)} 
                              variant="flat"
                              size="sm"
                            >
                              Lag {lag.lag}: {lag.correlation.toFixed(2)}
                            </Chip>
                          ))}
                        </div>
                      </>
                    )}
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
                    type="number"
                    dataKey="lag"
                    name="Lag"
                    stroke="#374151"
                    tick={{ fill: "#374151" }}
                    axisLine={{ stroke: "#94a3b8" }}
                    fontSize={12}
                    tickMargin={10}
                    domain={[0, 'dataMax']}
                    label={{ 
                      value: 'Lag', 
                      position: 'insideBottom',
                      offset: 0,
                      style: { textAnchor: 'middle', fill: '#4b5563', fontSize: 12 }
                    }}
                  />
                  <YAxis 
                    type="number"
                    dataKey="correlation"
                    name="Correlation"
                    stroke="#374151"
                    tick={{ fill: "#374151" }}
                    axisLine={{ stroke: "#94a3b8" }}
                    fontSize={12}
                    tickMargin={10}
                    domain={[-1, 1]}
                    label={{ 
                      value: 'Correlation Coefficient', 
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
                    formatter={(value: number, name: string) => {
                      if (name === 'Correlation') return [`${value.toFixed(2)}`, name];
                      return [`${value}`, name];
                    }}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                      padding: "8px 12px"
                    }}
                  />
                  
                  {/* Reference lines for significance thresholds */}
                  <ReferenceLine 
                    y={0.2} 
                    stroke="#94a3b8" 
                    strokeDasharray="3 3"
                    label={{ 
                      value: 'Significance threshold', 
                      position: 'right', 
                      fill: '#94a3b8',
                      fontSize: 10
                    }}
                  />
                  <ReferenceLine 
                    y={-0.2} 
                    stroke="#94a3b8" 
                    strokeDasharray="3 3"
                  />
                  
                  {/* Autocorrelation bars */}
                  <Scatter 
                    name="Autocorrelation" 
                    data={correlationData.autocorrelations} 
                    fill="#6366f1"
                    shape={(props: any) => {
                      const { cx, cy, payload } = props;
                      const { lag, correlation } = payload;
                      
                      // Determine if this lag is significant
                      const isSignificant = Math.abs(correlation) > 0.2 && lag > 0;
                      
                      // Calculate bar dimensions
                      const barWidth = 10;
                      const barHeight = Math.abs(correlation) * 100;
                      const y = correlation >= 0 ? cy - barHeight : cy;
                      
                      return (
                        <rect
                          x={cx - barWidth / 2}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          fill={isSignificant ? '#4f46e5' : '#94a3b8'}
                          stroke="none"
                        />
                      );
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
};