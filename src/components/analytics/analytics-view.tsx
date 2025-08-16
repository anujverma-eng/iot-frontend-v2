import React from 'react';
import {
  Card,
  CardBody,
  Tabs,
  Tab,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Progress,
  Tooltip
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { ChartConfig } from '../../types/sensor';
import { StatsCard } from '../stats-card';
import { HistogramChart } from '../visualization/histogram-chart';
import { GaugeChart } from '../visualization/gauge-chart';
import { LineChart } from '../visualization/line-chart';
import { AreaChart } from '../visualization/area-chart';
import { DistributionChart } from './distribution-charts/distribution-chart';
import { TrendAnalysisChart } from './distribution-charts/trend-analysis-chart';
import { AnomalyDetectionChart } from './distribution-charts/anomaly-detection-chart';
import { CorrelationAnalysisChart } from './distribution-charts/correlation-analysis-chart';
import { formatNumericValue } from '../../utils/numberUtils';
interface AnalyticsViewProps {
  config: ChartConfig;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ config }) => {
  const [selectedTab, setSelectedTab] = React.useState('statistics');
  const [timeRange, setTimeRange] = React.useState('all');

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!config.series || config.series.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        stdDev: 0,
        count: 0,
        trend: 'neutral'
      };
    }

    // Safely extract numeric values and filter out invalid data
    const validData = config.series.filter(point => {
      const numValue = Number(point.value);
      return !isNaN(numValue) && isFinite(numValue);
    });

    if (validData.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        median: 0,
        stdDev: 0,
        count: 0,
        trend: 'neutral'
      };
    }

    const values = validData.map(point => {
      const numValue = Number(point.value);
      return isNaN(numValue) ? 0 : numValue;
    });

    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = values.length > 0 ? sum / values.length : 0;
    
    // Calculate median
    const sortedValues = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sortedValues.length / 2);
    const median = sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
    
    // Calculate standard deviation with safe math
    const squareDiffs = values.map(value => {
      const diff = value - avg;
      return diff * diff;
    });
    const avgSquareDiff = values.length > 0 ? squareDiffs.reduce((acc, val) => acc + val, 0) / values.length : 0;
    const stdDev = Math.sqrt(avgSquareDiff);
    
    // Determine trend (simple version)
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (values.length >= 2) {
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      
      const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((acc, val) => acc + val, 0) / firstHalf.length : 0;
      const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((acc, val) => acc + val, 0) / secondHalf.length : 0;
      
      if (secondAvg > firstAvg * 1.05) {
        trend = 'up';
      } else if (secondAvg < firstAvg * 0.95) {
        trend = 'down';
      }
    }
    
    return {
      min: isNaN(min) ? 0 : min,
      max: isNaN(max) ? 0 : max,
      avg: isNaN(avg) ? 0 : avg,
      median: isNaN(median) ? 0 : median,
      stdDev: isNaN(stdDev) ? 0 : stdDev,
      count: values.length,
      trend: trend as 'up' | 'down' | 'neutral'
    };
  }, [config.series]);

  // Filter data based on selected time range
  const filteredConfig = React.useMemo(() => {
    if (timeRange === 'all' || !config.series || config.series.length === 0) {
      return config;
    }
    
    const now = Date.now();
    let cutoff: number;
    
    switch (timeRange) {
      case 'day':
        cutoff = now - 24 * 60 * 60 * 1000; // 24 hours
        break;
      case 'week':
        cutoff = now - 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case 'month':
        cutoff = now - 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      default:
        cutoff = 0;
    }
    
    return {
      ...config,
      series: config.series.filter(point => point.timestamp >= cutoff)
    };
  }, [config, timeRange]);

  // Calculate percentiles
  const percentiles = React.useMemo(() => {
    if (!config.series || config.series.length === 0) {
      return { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }
    
    // Safely extract numeric values and filter out invalid data
    const validData = config.series.filter(point => {
      const numValue = Number(point.value);
      return !isNaN(numValue) && isFinite(numValue);
    });

    if (validData.length === 0) {
      return { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }
    
    const values = validData.map(point => {
      const numValue = Number(point.value);
      return isNaN(numValue) ? 0 : numValue;
    }).sort((a, b) => a - b);
    
    const getPercentile = (p: number) => {
      if (values.length === 0) return 0;
      const index = Math.ceil((p / 100) * values.length) - 1;
      const value = values[Math.max(0, Math.min(index, values.length - 1))];
      return isNaN(value) ? 0 : value;
    };
    
    return {
      p25: getPercentile(25),
      p50: getPercentile(50),
      p75: getPercentile(75),
      p90: getPercentile(90),
      p95: getPercentile(95),
      p99: getPercentile(99)
    };
  }, [config.series]);

  // Calculate outliers (simple method: values outside 1.5 * IQR)
  const outliers = React.useMemo(() => {
    if (!config.series || config.series.length === 0) {
      return [];
    }
    
    // Safely extract numeric values and filter out invalid data
    const validData = config.series.filter(point => {
      const numValue = Number(point.value);
      return !isNaN(numValue) && isFinite(numValue);
    });

    if (validData.length === 0) {
      return [];
    }
    
    const values = validData.map(point => {
      const numValue = Number(point.value);
      return isNaN(numValue) ? 0 : numValue;
    });
    
    const sortedValues = [...values].sort((a, b) => a - b);
    
    const q1Index = Math.floor(sortedValues.length * 0.25);
    const q3Index = Math.floor(sortedValues.length * 0.75);
    
    const q1 = sortedValues[q1Index] || 0;
    const q3 = sortedValues[q3Index] || 0;
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return validData
      .filter(point => {
        const numValue = Number(point.value);
        const safeValue = isNaN(numValue) ? 0 : numValue;
        return safeValue < lowerBound || safeValue > upperBound;
      })
      .map(point => {
        const numValue = Number(point.value);
        const safeValue = isNaN(numValue) ? 0 : numValue;
        return {
          ...point,
          value: safeValue,
          isHigh: safeValue > upperBound,
          isLow: safeValue < lowerBound
        };
      });
  }, [config.series]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-primary-600">Analytics</h3>
        
        <Dropdown>
          <DropdownTrigger>
            <Button
              variant="flat"
              color="primary"
              size="sm"
              endContent={<Icon icon="lucide:chevron-down" width={16} />}
            >
              {timeRange === 'all' ? 'All Time' :
               timeRange === 'day' ? 'Last 24 Hours' :
               timeRange === 'week' ? 'Last 7 Days' :
               'Last 30 Days'}
            </Button>
          </DropdownTrigger>
          <DropdownMenu
            aria-label="Time Range Options"
            onAction={(key) => setTimeRange(key as string)}
          >
            <DropdownItem key="all">All Time</DropdownItem>
            <DropdownItem key="day">Last 24 Hours</DropdownItem>
            <DropdownItem key="week">Last 7 Days</DropdownItem>
            <DropdownItem key="month">Last 30 Days</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      <Tabs 
        selectedKey={selectedTab} 
        onSelectionChange={setSelectedTab as any}
        className="w-full"
        color="primary"
        variant="underlined"
      >
        <Tab key="statistics" title="Statistics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <StatsCard
              title="Average"
              value={formatNumericValue(stats.avg)}
              unit={config.unit}
              icon="lucide:bar-chart-2"
              trend={stats.trend as 'up' | 'down' | 'neutral'}
              color="primary"
            />
            
            <StatsCard
              title="Min / Max"
              value={`${formatNumericValue(stats.min)} - ${formatNumericValue(stats.max)}`}
              unit={config.unit}
              icon="lucide:arrow-up-down"
              color="secondary"
            />
            
            <StatsCard
              title="Readings"
              value={stats.count.toString()}
              icon="lucide:database"
              color="success"
              subtitle={`Median: ${formatNumericValue(stats.median)} ${config.unit}`}
            />
          </div>
          
          <Card className="mb-4 shadow-sm border border-default-200">
            <CardBody>
              <h4 className="text-md font-medium mb-3 text-primary-600">Percentiles</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>25th Percentile</span>
                    <span className="font-medium">{formatNumericValue(percentiles.p25)} {config.unit}</span>
                  </div>
                  <Progress 
                    value={((percentiles.p25 - stats.min) / (stats.max - stats.min)) * 100} 
                    color="primary"
                    size="sm"
                    showValueLabel={true}
                    valueLabel={`${formatNumericValue(((percentiles.p25 - stats.min) / (stats.max - stats.min) * 100))}%`}
                    className="h-2"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Median (50th)</span>
                    <span className="font-medium">{formatNumericValue(percentiles.p50)} {config.unit}</span>
                  </div>
                  <Progress 
                    value={((percentiles.p50 - stats.min) / (stats.max - stats.min)) * 100} 
                    color="primary"
                    size="sm"
                    showValueLabel={true}
                    valueLabel={`${formatNumericValue(((percentiles.p50 - stats.min) / (stats.max - stats.min) * 100))}%`}
                    className="h-2"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>75th Percentile</span>
                    <span className="font-medium">{formatNumericValue(percentiles.p75)} {config.unit}</span>
                  </div>
                  <Progress 
                    value={((percentiles.p75 - stats.min) / (stats.max - stats.min)) * 100} 
                    color="primary"
                    size="sm"
                    showValueLabel={true}
                    valueLabel={`${formatNumericValue(((percentiles.p75 - stats.min) / (stats.max - stats.min) * 100))}%`}
                    className="h-2"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>95th Percentile</span>
                    <span className="font-medium">{formatNumericValue(percentiles.p95)} {config.unit}</span>
                  </div>
                  <Progress 
                    value={((percentiles.p95 - stats.min) / (stats.max - stats.min)) * 100} 
                    color="primary"
                    size="sm"
                    showValueLabel={true}
                    valueLabel={`${formatNumericValue(((percentiles.p95 - stats.min) / (stats.max - stats.min) * 100))}%`}
                    className="h-2"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
          
          {outliers.length > 0 && (
            <Card className="shadow-sm border border-default-200">
              <CardBody>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-md font-medium text-danger-600">Outliers Detected</h4>
                  <Tooltip content="Values outside 1.5 * IQR range">
                    <Button isIconOnly size="sm" variant="light" color="danger">
                      <Icon icon="lucide:info" width={16} />
                    </Button>
                  </Tooltip>
                </div>
                
                <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="w-full min-w-full table-auto">
                    <thead>
                      <tr className="bg-danger-50 dark:bg-danger-900/20">
                        <th className="px-4 py-2 text-left text-sm font-medium text-danger-700 dark:text-danger-300">Date/Time</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-danger-700 dark:text-danger-300">Value</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-danger-700 dark:text-danger-300">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outliers.slice(0, 10).map((point, index) => (
                        <tr key={index} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <td className="px-4 py-2 text-sm">
                            {new Date(point.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium">
                            {formatNumericValue(point.value)} {config.unit}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {point.isHigh ? (
                              <span className="text-danger flex items-center gap-1">
                                <Icon icon="lucide:arrow-up" width={14} />
                                High
                              </span>
                            ) : (
                              <span className="text-warning flex items-center gap-1">
                                <Icon icon="lucide:arrow-down" width={14} />
                                Low
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {outliers.length > 10 && (
                    <div className="text-center text-sm text-default-500 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                      + {outliers.length - 10} more outliers
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}
        </Tab>
        
        <Tab key="distribution" title="Distribution">
          <div className="h-[500px] border border-default-200 rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm">
            <DistributionChart config={filteredConfig} />
          </div>
        </Tab>
        
        <Tab key="trend" title="Trend Analysis">
          <div className="h-[500px] border border-default-200 rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm">
            <TrendAnalysisChart config={filteredConfig} />
          </div>
        </Tab>
        
        <Tab key="anomaly" title="Anomaly Detection">
          <div className="h-[500px] border border-default-200 rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm">
            <AnomalyDetectionChart config={filteredConfig} showCards/>
          </div>
        </Tab>
        
        <Tab key="correlation" title="Correlation">
          <div className="h-[500px] border border-default-200 rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm">
            <CorrelationAnalysisChart config={filteredConfig} />
          </div>
        </Tab>
        
        <Tab key="multi-view" title="Multi-Chart View">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-[300px] border border-default-200 rounded-lg p-3 bg-white dark:bg-gray-900 shadow-sm">
              <h3 className="text-sm font-medium mb-2 text-primary-600">Line Chart</h3>
              <div className="h-[250px]">
                <LineChart config={filteredConfig} />
              </div>
            </div>
            
            <div className="h-[300px] border border-default-200 rounded-lg p-3 bg-white dark:bg-gray-900 shadow-sm">
              <h3 className="text-sm font-medium mb-2 text-secondary-600">Area Chart</h3>
              <div className="h-[250px]">
                <AreaChart config={filteredConfig} />
              </div>
            </div>
            
            <div className="h-[300px] border border-default-200 rounded-lg p-3 bg-white dark:bg-gray-900 shadow-sm">
              <h3 className="text-sm font-medium mb-2 text-success-600">Gauge Chart</h3>
              <div className="h-[250px] flex items-center justify-center">
                <GaugeChart config={filteredConfig} size="md" />
              </div>
            </div>
            
            <div className="h-[300px] border border-default-200 rounded-lg p-3 bg-white dark:bg-gray-900 shadow-sm">
              <h3 className="text-sm font-medium mb-2 text-warning-600">Histogram</h3>
              <div className="h-[250px]">
                <HistogramChart config={filteredConfig} />
              </div>
            </div>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
};