/**
 * 🚀 Centralized Chart Data Optimization Hook
 * 
 * This hook applies the SAME optimization logic as LineChart to ensure
 * consistent data processing across all visualization components:
 * - Distribution Chart
 * - Trend Analysis Chart  
 * - Anomaly Detection Chart
 * - Correlation Analysis Chart
 * 
 * Benefits:
 * ✅ Single source of truth for data optimization
 * ✅ Consistent performance across all charts
 * ✅ Reduced redundant processing
 * ✅ Better memory efficiency
 */

import React from 'react';
import { ChartConfig } from '../types/sensor';
import { 
  PERFORMANCE_THRESHOLDS, 
  WORKER_CONFIG,
  calculateOptimalPointsForChart,
  getDecimationInfo
} from '../constants/performance-config';
import { useTelemetryLOD } from './useTelemetryLOD';
import { PerformanceMonitor } from '../constants/feature-flags';

export interface OptimizedChartData {
  // Raw data (for reference)
  originalData: Array<{ timestamp: number; value: number }>;
  originalCount: number;
  
  // Optimized data (for rendering)
  optimizedData: Array<{ timestamp: number; value: number }>;
  optimizedCount: number;
  
  // Optimization stats
  decimationRatio: number;
  processingTimeMs: number;
  optimizationLevel: string;
  
  // Data quality indicators
  hasData: boolean;
  isProcessing: boolean;
  memoryFootprintMB: number;
}

export interface UseOptimizedChartDataOptions {
  enableWorkerProcessing?: boolean;
  qualityMode?: 'performance' | 'balanced' | 'quality';
  forceOptimization?: boolean;
}

export function useOptimizedChartData(
  config: ChartConfig | null,
  options: UseOptimizedChartDataOptions = {}
): OptimizedChartData {
  const {
    enableWorkerProcessing = true,
    qualityMode = 'balanced',
    forceOptimization = false
  } = options;

  // LOD System for high-performance processing
  const lodSystem = useTelemetryLOD();

  // Apply the EXACT same optimization logic as LineChart
  const optimizeDataForRendering = React.useCallback((data: any[]) => {
    if (!data || data.length === 0) return data;
    
    const isMobile = window.innerWidth < 768;
    const dataSize = data.length;
    
    // BIG DATA MODE: Aggressive sampling for massive datasets
    if (dataSize > PERFORMANCE_THRESHOLDS.BIG_DATA_MODE || forceOptimization) {
      const screenWidth = window.innerWidth;
      let targetPoints;
      
      if (isMobile) {
        targetPoints = Math.min(800, screenWidth * 0.5);
      } else if (screenWidth >= 2560) {
        targetPoints = 2000; // 4K+ displays
      } else if (screenWidth >= 1920) {
        targetPoints = 1500; // Full HD displays
      } else {
        targetPoints = 1000; // Smaller displays
      }
      
      const step = Math.ceil(dataSize / targetPoints);
      console.log(`🚀 useOptimizedChartData: Big data sampling ${dataSize.toLocaleString()} → ${targetPoints} points (step: ${step})`);
      
      // Use stride sampling with first/last point preservation
      const sampled = [];
      sampled.push(data[0]); // Always include first point
      
      for (let i = step; i < dataSize - 1; i += step) {
        sampled.push(data[i]);
      }
      
      sampled.push(data[dataSize - 1]); // Always include last point
      return sampled;
    }
    
    // SMART DECIMATION: Based on chart physical capabilities
    if (dataSize > PERFORMANCE_THRESHOLDS.CHART_BASIC_SAMPLING) {
      const screenWidth = window.innerWidth;
      const chartWidth = isMobile ? 
        Math.min(WORKER_CONFIG.MOBILE_CHART_WIDTH, screenWidth * 0.9) :
        Math.min(WORKER_CONFIG.DESKTOP_CHART_WIDTH, screenWidth * 0.6);
      
      const optimalPoints = calculateOptimalPointsForChart(dataSize, chartWidth);
      const decimationInfo = getDecimationInfo(dataSize, chartWidth);
      
      console.log(`🎯 useOptimizedChartData: Smart decimation ${dataSize.toLocaleString()} → ${optimalPoints.toLocaleString()} points`);
      
      if (decimationInfo.shouldDecimate) {
        const step = decimationInfo.decimationStep;
        
        // Stride sampling with preservation
        const sampledData = [];
        sampledData.push(data[0]);
        
        for (let i = step; i < dataSize - 1; i += step) {
          sampledData.push(data[i]);
        }
        
        sampledData.push(data[dataSize - 1]);
        
        console.log(`✅ useOptimizedChartData: Decimation complete ${sampledData.length.toLocaleString()} points (${(dataSize/sampledData.length).toFixed(1)}:1 ratio)`);
        return sampledData;
      }
    }
    
    // Mobile optimization for smaller datasets
    if (dataSize > 500 && isMobile) {
      const mobileChartWidth = Math.min(WORKER_CONFIG.MOBILE_CHART_WIDTH, window.innerWidth * 0.9);
      const optimalPoints = Math.min(dataSize, mobileChartWidth * WORKER_CONFIG.OPTIMAL_POINTS_PER_PIXEL);
      const step = Math.ceil(dataSize / optimalPoints);
      
      console.log(`📱 useOptimizedChartData: Mobile optimization ${dataSize} → ${optimalPoints} points`);
      return data.filter((_, index) => index % step === 0);
    }
    
    return data;
  }, [forceOptimization]);

  // Main optimization processing
  const optimizedResult = React.useMemo(() => {
    const startTime = performance.now();
    
    if (!config || !config.series || config.series.length === 0) {
      return {
        originalData: [],
        originalCount: 0,
        optimizedData: [],
        optimizedCount: 0,
        decimationRatio: 1,
        processingTimeMs: 0,
        optimizationLevel: 'NONE',
        hasData: false,
        isProcessing: false,
        memoryFootprintMB: 0
      };
    }

    // Extract and prepare data
    const rawData = config.series.map(point => ({
      timestamp: point.timestamp,
      value: point.value
    }));

    // Apply optimization
    const optimizedData = optimizeDataForRendering(rawData);
    
    const processingTime = performance.now() - startTime;
    const originalCount = rawData.length;
    const optimizedCount = optimizedData.length;
    const decimationRatio = originalCount / optimizedCount;
    
    // Determine optimization level
    let optimizationLevel = 'STANDARD';
    if (originalCount > PERFORMANCE_THRESHOLDS.BIG_DATA_MODE) {
      optimizationLevel = 'BIG_DATA_MODE';
    } else if (originalCount > PERFORMANCE_THRESHOLDS.LOD_DECIMATION) {
      optimizationLevel = 'LOD_DECIMATION';
    } else if (originalCount > PERFORMANCE_THRESHOLDS.CHART_BASIC_SAMPLING) {
      optimizationLevel = 'CHART_DECIMATION';
    }
    
    // Estimate memory footprint
    const memoryFootprintMB = (optimizedCount * (8 + 4 + 8)) / (1024 * 1024); // timestamp + value + overhead

    const result = {
      originalData: rawData,
      originalCount,
      optimizedData,
      optimizedCount,
      decimationRatio,
      processingTimeMs: processingTime,
      optimizationLevel,
      hasData: optimizedCount > 0,
      isProcessing: false,
      memoryFootprintMB
    };

    // Performance monitoring
    if (processingTime > 50) {
      console.log(`⚡ useOptimizedChartData: Processed ${originalCount.toLocaleString()} → ${optimizedCount.toLocaleString()} points in ${processingTime.toFixed(2)}ms (${optimizationLevel})`);
    }

    return result;
  }, [config?.series, optimizeDataForRendering]);

  return optimizedResult;
}

// Utility function to create optimized config from result
export function createOptimizedChartConfig(
  baseConfig: ChartConfig,
  optimizedData: OptimizedChartData
): ChartConfig {
  return {
    ...baseConfig,
    series: optimizedData.optimizedData
  };
}