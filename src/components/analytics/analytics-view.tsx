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

    const values = config.series.map(point => point.value);
    console.log('Calculating stats for values:', values);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    
    // Calculate median
    const sortedValues = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sortedValues.length / 2);
    const median = sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
    
    // Calculate standard deviation
    const squareDiffs = values.map(value => {
      const diff = value - avg;
      return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / values.length;
    const stdDev = Math.sqrt(avgSquareDiff);
    
    // Determine trend (simple version)
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (values.length >= 2) {
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      
      const firstAvg = firstHalf.reduce((acc, val) => acc + val, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((acc, val) => acc + val, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg * 1.05) {
        trend = 'up';
      } else if (secondAvg < firstAvg * 0.95) {
        trend = 'down';
      }
    }
    
    return {
      min,
      max,
      avg,
      median,
      stdDev,
      count: values.length,
      trend
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
    
    const values = [...config.series.map(point => point.value)].sort((a, b) => a - b);
    
    const getPercentile = (p: number) => {
      const index = Math.ceil((p / 100) * values.length) - 1;
      return values[Math.max(0, Math.min(index, values.length - 1))];
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
    
    const values = config.series.map(point => point.value);
    const sortedValues = [...values].sort((a, b) => a - b);
    
    const q1Index = Math.floor(sortedValues.length * 0.25);
    const q3Index = Math.floor(sortedValues.length * 0.75);
    
    const q1 = sortedValues[q1Index];
    const q3 = sortedValues[q3Index];
    const iqr = q3 - q1;
    
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    return config.series
      .filter(point => point.value < lowerBound || point.value > upperBound)
      .map(point => ({
        ...point,
        isHigh: point.value > upperBound,
        isLow: point.value < lowerBound
      }));
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
              value={stats.avg.toFixed(2)}
              unit={config.unit}
              icon="lucide:bar-chart-2"
              trend={stats.trend as 'up' | 'down' | 'neutral'}
              color="primary"
            />
            
            <StatsCard
              title="Min / Max"
              value={`${stats.min.toFixed(2)} - ${stats.max.toFixed(2)}`}
              unit={config.unit}
              icon="lucide:arrow-up-down"
              color="secondary"
            />
            
            <StatsCard
              title="Readings"
              value={stats.count.toString()}
              icon="lucide:database"
              color="success"
              subtitle={`Median: ${stats.median.toFixed(2)} ${config.unit}`}
            />
          </div>
          
          <Card className="mb-4 shadow-sm border border-default-200">
            <CardBody>
              <h4 className="text-md font-medium mb-3 text-primary-600">Percentiles</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>25th Percentile</span>
                    <span className="font-medium">{percentiles.p25.toFixed(2)} {config.unit}</span>
                  </div>
                  <Progress 
                    value={((percentiles.p25 - stats.min) / (stats.max - stats.min)) * 100} 
                    color="primary"
                    size="sm"
                    showValueLabel={true}
                    valueLabel={`${((percentiles.p25 - stats.min) / (stats.max - stats.min) * 100).toFixed(0)}%`}
                    className="h-2"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Median (50th)</span>
                    <span className="font-medium">{percentiles.p50.toFixed(2)} {config.unit}</span>
                  </div>
                  <Progress 
                    value={((percentiles.p50 - stats.min) / (stats.max - stats.min)) * 100} 
                    color="primary"
                    size="sm"
                    showValueLabel={true}
                    valueLabel={`${((percentiles.p50 - stats.min) / (stats.max - stats.min) * 100).toFixed(0)}%`}
                    className="h-2"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>75th Percentile</span>
                    <span className="font-medium">{percentiles.p75.toFixed(2)} {config.unit}</span>
                  </div>
                  <Progress 
                    value={((percentiles.p75 - stats.min) / (stats.max - stats.min)) * 100} 
                    color="primary"
                    size="sm"
                    showValueLabel={true}
                    valueLabel={`${((percentiles.p75 - stats.min) / (stats.max - stats.min) * 100).toFixed(0)}%`}
                    className="h-2"
                  />
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>95th Percentile</span>
                    <span className="font-medium">{percentiles.p95.toFixed(2)} {config.unit}</span>
                  </div>
                  <Progress 
                    value={((percentiles.p95 - stats.min) / (stats.max - stats.min)) * 100} 
                    color="primary"
                    size="sm"
                    showValueLabel={true}
                    valueLabel={`${((percentiles.p95 - stats.min) / (stats.max - stats.min) * 100).toFixed(0)}%`}
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
                            {point?.value?.toFixed(2) || 1} {config.unit}
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
          <div className="h-[400px] border border-default-200 rounded-lg p-4 bg-white dark:bg-gray-900 shadow-sm">
            <HistogramChart config={filteredConfig} />
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