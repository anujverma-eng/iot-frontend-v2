/**
 * ⚠️ TEMPORARY DEBUG UI - FOR DEVELOPMENT ONLY ⚠️
 * 
 * This component provides comprehensive monitoring of chart performance optimizations.
 * Shows data flow, memory usage, optimization decisions, and system behavior.
 * 
 * TO REMOVE: Simply delete this file and remove the import from analytics page.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Tabs,
  Tab,
  Button,
  Progress,
  Chip,
  Divider,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { formatNumericValue } from '../../utils/numberUtils';
import { 
  PERFORMANCE_THRESHOLDS,
  MEMORY_CONFIG,
  WORKER_CONFIG,
  UI_CONFIG,
  getThresholdForDataSize,
  shouldUseOptimization,
  calculateOptimalPointsForChart,
  getDecimationInfo
} from '../../constants/performance-config';
import { TIME_CONSTANTS, TIME_FORMATTING, convertToMinutes } from '../../constants/time-constants';
import { ChartConfig } from '../../types/sensor';

interface DebugUIProps {
  config: ChartConfig;
  actualDisplayedData?: Array<{ timestamp: number; value: number; }>; // NEW: Actual chart data for accurate stats
  lodSystem?: {
    isWorkerReady?: boolean;
    isProcessing?: boolean;
    stats?: {
      pointsProcessed?: number;
      pointsReturned?: number;
      processingTimeMs?: number;
      memoryUsageMB?: number;
      seriesCount?: number;
      longTasksCount?: number;
      cacheHits?: number;
    } | null;
    qualityMode?: string;
    config?: any;
    activeRequests?: number;
  };
  isVisible?: boolean;
  onToggle?: () => void;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface OptimizationDecision {
  feature: string;
  active: boolean;
  reason: string;
  dataSize: number;
  threshold: number;
  impact: 'high' | 'medium' | 'low';
}

export const ChartPerformanceDebugUI: React.FC<DebugUIProps> = ({ 
  config, 
  actualDisplayedData, // NEW: Use actual chart data
  lodSystem, 
  isVisible = false, 
  onToggle 
}) => {
  // State for real-time monitoring
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [optimizationDecisions, setOptimizationDecisions] = useState<OptimizationDecision[]>([]);
  const [processingStats, setProcessingStats] = useState({
    renderTime: 0,
    workerProcessingTime: 0,
    decimationRatio: 0,
    pointsOriginal: 0,
    pointsDisplayed: 0,
    cacheHitRate: 0
  });

  const [workerLogs, setWorkerLogs] = useState<string[]>([]);
  const [isWorkerActive, setIsWorkerActive] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState({
    memory: 0,
    cores: 0,
    connection: 'unknown'
  });

  const {isOpen, onOpen, onClose} = useDisclosure();
  const updateInterval = useRef<NodeJS.Timeout>();

  // Calculate current data statistics
  const dataStats = React.useMemo(() => {
    if (!config.series || config.series.length === 0) {
      return {
        totalPoints: 0,
        timeSpan: 0,
        seriesCount: 0,
        dataSize: 0,
        avgPointsPerSeries: 0,
        memoryFootprint: 0
      };
    }

    const totalPoints = config.series.length;
    const seriesCount = 1; // Single series for now
    
    // Calculate time span
    const timestamps = config.series.map(p => new Date(p.timestamp).getTime()).filter(t => !isNaN(t));
    const timeSpan = timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;

    // Estimate memory footprint (rough calculation)
    const memoryFootprint = totalPoints * (8 + 4 + 8); // timestamp(8) + value(4) + overhead(8)

    return {
      totalPoints,
      timeSpan,
      seriesCount,
      dataSize: totalPoints,
      avgPointsPerSeries: totalPoints / seriesCount,
      memoryFootprint
    };
  }, [config.series]);

  // Analyze optimization decisions
  const analyzeOptimizations = React.useCallback(() => {
    const decisions: OptimizationDecision[] = [];
    const dataSize = dataStats.totalPoints;

    // Basic Optimization
    decisions.push({
      feature: 'TypedArrays & Basic Caching',
      active: shouldUseOptimization(dataSize, 'BASIC_OPTIMIZATION'),
      reason: `Data size: ${dataSize.toLocaleString()} > ${PERFORMANCE_THRESHOLDS.BASIC_OPTIMIZATION.toLocaleString()}`,
      dataSize,
      threshold: PERFORMANCE_THRESHOLDS.BASIC_OPTIMIZATION,
      impact: 'low'
    });

    // Enhanced Processing
    decisions.push({
      feature: 'Worker Processing',
      active: shouldUseOptimization(dataSize, 'ENHANCED_PROCESSING'),
      reason: `Data size: ${dataSize.toLocaleString()} > ${PERFORMANCE_THRESHOLDS.ENHANCED_PROCESSING.toLocaleString()}`,
      dataSize,
      threshold: PERFORMANCE_THRESHOLDS.ENHANCED_PROCESSING,
      impact: 'medium'
    });

    // LOD Decimation
    decisions.push({
      feature: 'Level-of-Detail Decimation',
      active: shouldUseOptimization(dataSize, 'LOD_DECIMATION'),
      reason: `Data size: ${dataSize.toLocaleString()} > ${PERFORMANCE_THRESHOLDS.LOD_DECIMATION.toLocaleString()}`,
      dataSize,
      threshold: PERFORMANCE_THRESHOLDS.LOD_DECIMATION,
      impact: 'high'
    });

    // Big Data Mode
    decisions.push({
      feature: 'Big Data Mode (All Optimizations)',
      active: shouldUseOptimization(dataSize, 'BIG_DATA_MODE'),
      reason: `Data size: ${dataSize.toLocaleString()} > ${PERFORMANCE_THRESHOLDS.BIG_DATA_MODE.toLocaleString()}`,
      dataSize,
      threshold: PERFORMANCE_THRESHOLDS.BIG_DATA_MODE,
      impact: 'high'
    });

    // Massive Dataset Mode
    decisions.push({
      feature: 'Streaming & Aggressive Caching',
      active: shouldUseOptimization(dataSize, 'MASSIVE_DATASET'),
      reason: `Data size: ${dataSize.toLocaleString()} > ${PERFORMANCE_THRESHOLDS.MASSIVE_DATASET.toLocaleString()}`,
      dataSize,
      threshold: PERFORMANCE_THRESHOLDS.MASSIVE_DATASET,
      impact: 'high'
    });

    setOptimizationDecisions(decisions);
  }, [dataStats.totalPoints]);

  // Get device information and setup console monitoring
  useEffect(() => {
    const getDeviceInfo = () => {
      const memory = (navigator as any).deviceMemory || 4;
      const cores = navigator.hardwareConcurrency || 4;
      const connection = (navigator as any).connection?.effectiveType || 'unknown';

      setDeviceInfo({ memory, cores, connection });
    };

    getDeviceInfo();
    
    // Capture console logs related to worker activity
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const captureLog = (level: string, ...args: any[]) => {
      const message = args.join(' ');
      // Enhanced capture for worker and chart activity
      if (message.includes('Worker') || 
          message.includes('LOD') || 
          message.includes('decimation') ||
          message.includes('brush') ||
          message.includes('zoom') ||
          message.includes('processing') ||
          message.includes('🔄') || 
          message.includes('📊') || 
          message.includes('🚀') || 
          message.includes('✅') ||
          message.includes('⚡') ||
          message.includes('🎯') ||
          message.includes('📈')) {
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        setWorkerLogs(prev => {
          const newLogs = [...prev, logEntry];
          return newLogs.slice(-20); // Keep last 20 logs
        });
        
        // Mark worker as active when we see activity
        if (message.includes('LOD') || message.includes('decimation') || message.includes('Worker') || message.includes('processing')) {
          setIsWorkerActive(true);
          setTimeout(() => setIsWorkerActive(false), 2000);
        }
      }
    };

    console.log = (...args) => {
      captureLog('log', ...args);
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      captureLog('warn', ...args);
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      captureLog('error', ...args);
      originalError.apply(console, args);
    };

    // Initial welcome message
    console.log('🔧 Debug UI: Worker monitoring active! Try moving the brush selector.');

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
    
    return () => {
      console.log = originalLog;
    };
  }, []);

  // Monitor memory usage and worker activity
  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit
        });
      }
      
      // Monitor worker activity
      if (lodSystem?.activeRequests && lodSystem.activeRequests > 0) {
        setIsWorkerActive(true);
      } else {
        setIsWorkerActive(false);
      }
      
      // Update cache hit rate if available
      if (lodSystem?.stats?.cacheHits) {
        setProcessingStats(prev => ({
          ...prev,
          cacheHitRate: lodSystem.stats?.cacheHits || 0,
          workerProcessingTime: lodSystem.stats?.processingTimeMs || 0
        }));
      }
    };

    updateMemoryInfo();
    updateInterval.current = setInterval(updateMemoryInfo, 1000);

    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [lodSystem]);

  // Update optimization analysis when data changes
  useEffect(() => {
    analyzeOptimizations();
    
    // Calculate ACCURATE displayed points using same logic as chart optimization
    if (config.series && config.series.length > 0) {
      const originalPoints = config.series.length;
      let estimatedDisplayedPoints = originalPoints;
      
      // Apply same optimization logic as line-chart.tsx
      const isMobile = window.innerWidth < 768;
      
      // First check: Smart decimation based on chart capabilities (from performance-config)
      if (originalPoints > PERFORMANCE_THRESHOLDS.CHART_BASIC_SAMPLING) {
        const screenWidth = window.innerWidth;
        const chartWidth = isMobile ? 
          Math.min(WORKER_CONFIG.MOBILE_CHART_WIDTH, screenWidth * 0.9) :
          Math.min(WORKER_CONFIG.DESKTOP_CHART_WIDTH, screenWidth * 0.6);
        
        const optimalPoints = calculateOptimalPointsForChart(originalPoints, chartWidth);
        const decimationInfo = getDecimationInfo(originalPoints, chartWidth);
        
        if (decimationInfo.shouldDecimate) {
          // Calculate points after stride sampling (same as line-chart.tsx)
          const step = decimationInfo.decimationStep;
          const sampledPoints = Math.floor((originalPoints - 2) / step) + 2; // +2 for first/last points
          estimatedDisplayedPoints = Math.min(sampledPoints, originalPoints);
        }
      }
      
      // Second check: Big data mode aggressive sampling
      if (originalPoints > PERFORMANCE_THRESHOLDS.BIG_DATA_MODE) {
        const screenWidth = window.innerWidth;
        let targetPoints;
        
        if (isMobile) {
          targetPoints = Math.min(800, screenWidth * 0.5);
        } else if (screenWidth >= 2560) {
          targetPoints = 2000;
        } else if (screenWidth >= 1920) {
          targetPoints = 1500;
        } else {
          targetPoints = 1000;
        }
        
        if (originalPoints > targetPoints * 3) { // Only if significantly larger
          estimatedDisplayedPoints = Math.min(estimatedDisplayedPoints, targetPoints);
        }
      }
      
      // Use actual data if provided, otherwise use calculated estimate
      const displayedPoints = actualDisplayedData && actualDisplayedData.length > 0 ? 
        actualDisplayedData.length : estimatedDisplayedPoints;
      const ratio = displayedPoints > 0 ? originalPoints / displayedPoints : 1;
      
      setProcessingStats(prev => ({
        ...prev,
        pointsOriginal: originalPoints,
        pointsDisplayed: displayedPoints,
        decimationRatio: ratio
      }));
    }
  }, [analyzeOptimizations, config.series, actualDisplayedData]);

  // Get memory budget information
  const memoryBudget = MEMORY_CONFIG.calculateMemoryBudget();
  const memoryUsagePercentage = memoryInfo 
    ? (memoryInfo.usedJSHeapSize / memoryBudget) * 100 
    : 0;

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Get threshold level color
  const getThresholdColor = (active: boolean, impact: string) => {
    if (!active) return 'default';
    switch (impact) {
      case 'high': return 'danger';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'primary';
    }
  };

  if (!isVisible) {
    return (
      <Button
        size="sm"
        variant="flat"
        color="warning"
        startContent={<Icon icon="material-symbols:bug-report" />}
        onPress={onToggle}
        className="fixed bottom-4 right-4 z-50"
      >
        Debug UI
      </Button>
    );
  }

  return (
    <>
      {/* Debug Panel */}
      <Card className="w-full mb-4 border-2 border-warning-200 bg-warning-50/50">
        <CardHeader className="flex justify-between items-center bg-warning-100">
          <div className="flex items-center gap-2">
            <Icon icon="material-symbols:bug-report" className="text-warning-600" />
            <h3 className="text-lg font-semibold text-warning-800">
              ⚠️ Chart Performance Debug UI (TEMPORARY)
            </h3>
            <Chip size="sm" color="warning" variant="flat">
              DEV ONLY
            </Chip>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onPress={onOpen} startContent={<Icon icon="material-symbols:fullscreen" />}>
              Full Details
            </Button>
            <Button size="sm" variant="light" onPress={onToggle}>
              <Icon icon="material-symbols:close" />
            </Button>
          </div>
        </CardHeader>

        <CardBody>
          <Tabs aria-label="Debug Information">
            {/* Data Overview Tab */}
            <Tab key="data" title={
              <div className="flex items-center gap-2">
                <Icon icon="material-symbols:data-usage" />
                Data Overview
                <Chip color="primary" size="sm" variant="flat">
                  {dataStats.totalPoints.toLocaleString()}
                </Chip>
              </div>
            }>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <Card>
                  <CardBody className="text-center">
                    <div className="text-2xl font-bold text-primary">{dataStats.totalPoints.toLocaleString()}</div>
                    <div className="text-sm text-gray-600">Total Data Points</div>
                  </CardBody>
                </Card>
                
                <Card>
                  <CardBody className="text-center">
                    <div className="text-2xl font-bold text-secondary">
                      {TIME_FORMATTING.formatDuration(dataStats.timeSpan)}
                    </div>
                    <div className="text-sm text-gray-600">Time Span</div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody className="text-center">
                    <div className="text-2xl font-bold text-success">
                      {formatBytes(dataStats.memoryFootprint)}
                    </div>
                    <div className="text-sm text-gray-600">Est. Memory</div>
                  </CardBody>
                </Card>

                <Card>
                  <CardBody className="text-center">
                    <div className="text-2xl font-bold text-warning">
                      {getThresholdForDataSize(dataStats.totalPoints)}
                    </div>
                    <div className="text-sm text-gray-600">Optimization Level</div>
                  </CardBody>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Raw Data Analysis</h4>
                  </CardHeader>
                  <CardBody className="space-y-2">
                    <div className="flex justify-between">
                      <span>Series Count:</span>
                      <span className="font-mono">{dataStats.seriesCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Points/Series:</span>
                      <span className="font-mono">{Math.round(dataStats.avgPointsPerSeries).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Data Density:</span>
                      <span className="font-mono">
                        {dataStats.timeSpan > 0 
                          ? `${Math.round(dataStats.totalPoints / (dataStats.timeSpan / TIME_CONSTANTS.MINUTE_MS))} pts/min`
                          : 'N/A'
                        }
                      </span>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Processing Pipeline</h4>
                    <Chip size="sm" color="success" variant="flat">
                      CALCULATED - Uses same optimization logic as chart
                    </Chip>
                  </CardHeader>
                  <CardBody className="space-y-2">
                    <div className="flex justify-between">
                      <span>Points Original:</span>
                      <span className="font-mono text-blue-600">{processingStats.pointsOriginal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Points Displayed:</span>
                      <span className="font-mono text-green-600">{processingStats.pointsDisplayed.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Decimation Ratio:</span>
                      <span className="font-mono text-orange-600">{processingStats.decimationRatio.toFixed(2)}x</span>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* Optimizations Tab */}
            <Tab key="optimizations" title={
              <div className="flex items-center gap-2">
                <Icon icon="material-symbols:speed" />
                Optimizations
                <Chip color="success" size="sm" variant="flat">
                  {optimizationDecisions.filter(d => d.active).length}
                </Chip>
              </div>
            }>
              <div className="space-y-3">
                {optimizationDecisions.map((decision, index) => (
                  <Card key={index} className={decision.active ? 'border-success-200' : 'border-default-200'}>
                    <CardBody>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Chip
                            color={getThresholdColor(decision.active, decision.impact)}
                            variant={decision.active ? 'flat' : 'bordered'}
                            size="sm"
                          >
                            {decision.active ? '✓ ACTIVE' : '○ INACTIVE'}
                          </Chip>
                          <div>
                            <div className="font-semibold">{decision.feature}</div>
                            <div className="text-sm text-gray-600">{decision.reason}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono">
                            {decision.dataSize.toLocaleString()} / {decision.threshold.toLocaleString()}
                          </div>
                          <Progress
                            value={Math.min((decision.dataSize / decision.threshold) * 100, 100)}
                            color={decision.active ? 'success' : 'default'}
                            size="sm"
                            className="w-24"
                          />
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </Tab>

            {/* Memory Tab */}
            <Tab key="memory" title={
              <div className="flex items-center gap-2">
                <Icon icon="material-symbols:memory" />
                Memory
                <Chip 
                  color={memoryUsagePercentage > 80 ? 'danger' : memoryUsagePercentage > 60 ? 'warning' : 'success'}
                  size="sm"
                  variant="flat"
                >
                  {`${memoryUsagePercentage.toFixed(1)}%`}
                </Chip>
              </div>
            }>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">JavaScript Heap</h4>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    {memoryInfo ? (
                      <>
                        <div>
                          <div className="flex justify-between mb-1">
                            <span>Used Heap</span>
                            <span className="font-mono">{formatBytes(memoryInfo.usedJSHeapSize)}</span>
                          </div>
                          <Progress
                            value={(memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100}
                            color="primary"
                            size="sm"
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between mb-1">
                            <span>Total Heap</span>
                            <span className="font-mono">{formatBytes(memoryInfo.totalJSHeapSize)}</span>
                          </div>
                          <Progress
                            value={(memoryInfo.totalJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100}
                            color="secondary"
                            size="sm"
                          />
                        </div>

                        <div className="flex justify-between">
                          <span>Heap Limit:</span>
                          <span className="font-mono">{formatBytes(memoryInfo.jsHeapSizeLimit)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-gray-500">Memory API not available</div>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Memory Budget</h4>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Allocated Budget</span>
                        <span className="font-mono">{formatBytes(memoryBudget)}</span>
                      </div>
                      <Progress
                        value={memoryUsagePercentage}
                        color={memoryUsagePercentage > 80 ? 'danger' : memoryUsagePercentage > 60 ? 'warning' : 'success'}
                        size="sm"
                      />
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Device Memory:</span>
                        <span className="font-mono">{deviceInfo.memory} GB</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CPU Cores:</span>
                        <span className="font-mono">{deviceInfo.cores}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Connection:</span>
                        <span className="font-mono">{deviceInfo.connection}</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* Worker Status Tab */}
            <Tab key="worker" title={
              <div className="flex items-center gap-2">
                <Icon icon="material-symbols:precision-manufacturing" />
                Worker Status
                <Chip 
                  color={lodSystem?.isWorkerReady ? 'success' : 'warning'}
                  size="sm"
                  variant="flat"
                >
                  {lodSystem?.isWorkerReady ? 'Ready' : 'Loading'}
                </Chip>
              </div>
            }>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Worker Configuration</h4>
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Chunk Size:</span>
                      <span className="font-mono">{WORKER_CONFIG.CHUNK_SIZE.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Chunk Size:</span>
                      <span className="font-mono">{WORKER_CONFIG.MAX_CHUNK_SIZE.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Batch Timeout:</span>
                      <span className="font-mono">{WORKER_CONFIG.BATCH_TIMEOUT_MS}ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Batch Size:</span>
                      <span className="font-mono">{WORKER_CONFIG.MAX_BATCH_SIZE.toLocaleString()}</span>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">LOD System Status</h4>
                  </CardHeader>
                  <CardBody className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Worker Ready:</span>
                      <Chip size="sm" color={lodSystem?.isWorkerReady ? 'success' : 'danger'} variant="flat">
                        {lodSystem?.isWorkerReady ? 'YES' : 'NO'}
                      </Chip>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Requests:</span>
                      <span className="font-mono">{lodSystem?.activeRequests || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cache Hits:</span>
                      <span className="font-mono">{lodSystem?.stats?.cacheHits || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Processing Time:</span>
                      <span className="font-mono">{lodSystem?.stats?.processingTimeMs || 0}ms</span>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* Worker Activity Tab */}
            <Tab key="activity" title={
              <div className="flex items-center gap-2">
                <Icon icon="material-symbols:activity-zone" />
                Worker Activity
                <Chip 
                  color={isWorkerActive ? 'success' : 'default'}
                  size="sm"
                  variant="flat"
                >
                  {isWorkerActive ? 'ACTIVE' : 'IDLE'}
                </Chip>
              </div>
            }>
              <div className="space-y-4">
                {/* Real-time Worker Logs */}
                <Card>
                  <CardHeader>
                    <h4 className="font-semibold">Real-time Worker Console</h4>
                  </CardHeader>
                  <CardBody>
                    <div className="bg-black text-green-400 p-3 rounded font-mono text-xs max-h-40 overflow-y-auto">
                      {workerLogs.length === 0 ? (
                        <div className="text-gray-500">No worker activity yet. Try moving the brush or zooming...</div>
                      ) : (
                        workerLogs.map((log, index) => (
                          <div key={index} className="mb-1">
                            {log}
                          </div>
                        ))
                      )}
                    </div>
                  </CardBody>
                </Card>

                {/* Processing Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">Current Processing</h4>
                    </CardHeader>
                    <CardBody className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Points Original:</span>
                        <span className="font-mono text-blue-600">
                          {processingStats.pointsOriginal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Points Displayed:</span>
                        <span className="font-mono text-green-600">
                          {processingStats.pointsDisplayed.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Decimation Ratio:</span>
                        <span className="font-mono text-orange-600">
                          {processingStats.decimationRatio.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Processing Time:</span>
                        <span className="font-mono">
                          {processingStats.workerProcessingTime}ms
                        </span>
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h4 className="font-semibold">Performance Stats</h4>
                    </CardHeader>
                    <CardBody className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Cache Hit Rate:</span>
                        <span className="font-mono text-purple-600">
                          {processingStats.cacheHitRate}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Worker Status:</span>
                        <Chip 
                          size="sm" 
                          color={lodSystem?.isWorkerReady ? 'success' : 'danger'} 
                          variant="flat"
                        >
                          {lodSystem?.isWorkerReady ? 'READY' : 'NOT READY'}
                        </Chip>
                      </div>
                      <div className="flex justify-between">
                        <span>Active Requests:</span>
                        <span className="font-mono">
                          {lodSystem?.activeRequests || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Processing Mode:</span>
                        <Chip 
                          size="sm" 
                          color={lodSystem?.isWorkerReady ? 'success' : 'warning'} 
                          variant="flat"
                        >
                          {lodSystem?.isWorkerReady ? 'WORKER' : 'FALLBACK'}
                        </Chip>
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Detailed Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="5xl" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Icon icon="material-symbols:analytics" />
              Complete Performance Analysis
            </div>
          </ModalHeader>
          <ModalBody className="pb-6">
            <div className="space-y-6">
              {/* Configuration Display */}
              <Card>
                <CardHeader>
                  <h4 className="font-semibold">Performance Configuration</h4>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h5 className="font-semibold mb-2">Thresholds</h5>
                      <div className="space-y-1 font-mono">
                        <div>BASIC_OPTIMIZATION: {PERFORMANCE_THRESHOLDS.BASIC_OPTIMIZATION.toLocaleString()}</div>
                        <div>ENHANCED_PROCESSING: {PERFORMANCE_THRESHOLDS.ENHANCED_PROCESSING.toLocaleString()}</div>
                        <div>LOD_DECIMATION: {PERFORMANCE_THRESHOLDS.LOD_DECIMATION.toLocaleString()}</div>
                        <div>BIG_DATA_MODE: {PERFORMANCE_THRESHOLDS.BIG_DATA_MODE.toLocaleString()}</div>
                        <div>MASSIVE_DATASET: {PERFORMANCE_THRESHOLDS.MASSIVE_DATASET.toLocaleString()}</div>
                        <div className="text-green-600">HIGH_PRECISION_MULTIPLIER: {WORKER_CONFIG.HIGH_PRECISION_MULTIPLIER} pts/px ✅</div>
                      </div>
                    </div>
                    <div>
                      <h5 className="font-semibold mb-2">UI Configuration</h5>
                      <div className="space-y-1 font-mono">
                        <div>DEBOUNCE_STANDARD: {UI_CONFIG.DEBOUNCE_STANDARD_MS}ms</div>
                        <div>MAX_CONCURRENT_REQUESTS: {UI_CONFIG.MAX_CONCURRENT_REQUESTS}</div>
                        <div>REQUEST_TIMEOUT: {UI_CONFIG.REQUEST_TIMEOUT_MS}ms</div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Time Analysis */}
              <Card>
                <CardHeader>
                  <h4 className="font-semibold">Time Window Analysis</h4>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="font-semibold mb-2">Window Duration</div>
                      <div className="font-mono">{TIME_FORMATTING.formatDuration(dataStats.timeSpan)}</div>
                    </div>
                    <div>
                      <div className="font-semibold mb-2">Precision Level</div>
                      <div className="font-mono">{TIME_FORMATTING.getPrecisionLevel(dataStats.timeSpan)}</div>
                    </div>
                    <div>
                      <div className="font-semibold mb-2">Chart Width</div>
                      <div className="font-mono">
                        {TIME_FORMATTING.getChartWidthForPrecision(
                          TIME_FORMATTING.getPrecisionLevel(dataStats.timeSpan)
                        )}px
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Raw Data Inspection */}
              <Card>
                <CardHeader>
                  <h4 className="font-semibold">Data Sample (First 10 Points)</h4>
                </CardHeader>
                <CardBody>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Index</th>
                          <th className="text-left p-2">Timestamp</th>
                          <th className="text-left p-2">Value</th>
                          <th className="text-left p-2">Type</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {config.series?.slice(0, 10).map((point, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-2">{index}</td>
                            <td className="p-2">{new Date(point.timestamp).toISOString()}</td>
                            <td className="p-2">{formatNumericValue(Number(point.value))}</td>
                            <td className="p-2">{typeof point.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </div>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
};