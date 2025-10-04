/**
 * ⚠️ TEMPORARY DEBUG HOOK - FOR DEVELOPMENT ONLY ⚠️
 * 
 * Hook to manage debug UI state and collect performance data
 * TO REMOVE: Delete this file when removing debug UI functionality
 */

import { useState, useEffect } from 'react';

export interface DebugUIState {
  isVisible: boolean;
  performanceData: {
    renderStart: number;
    renderEnd: number;
    workerProcessingTime: number;
    pointsOriginal: number;
    pointsDisplayed: number;
    decimationRatio: number;
    cacheHitRate: number;
  };
  memorySnapshots: Array<{
    timestamp: number;
    usedHeap: number;
    totalHeap: number;
  }>;
}

export const useChartDebugUI = () => {
  const [debugState, setDebugState] = useState<DebugUIState>({
    isVisible: false,
    performanceData: {
      renderStart: 0,
      renderEnd: 0,
      workerProcessingTime: 0,
      pointsOriginal: 0,
      pointsDisplayed: 0,
      decimationRatio: 0,
      cacheHitRate: 0
    },
    memorySnapshots: []
  });

  // Toggle debug UI visibility
  const toggleDebugUI = () => {
    setDebugState(prev => ({
      ...prev,
      isVisible: !prev.isVisible
    }));
  };

  // Record performance metrics
  const recordPerformanceMetrics = (metrics: Partial<DebugUIState['performanceData']>) => {
    setDebugState(prev => ({
      ...prev,
      performanceData: {
        ...prev.performanceData,
        ...metrics
      }
    }));
  };

  // Take memory snapshot
  const takeMemorySnapshot = () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const snapshot = {
        timestamp: Date.now(),
        usedHeap: memory.usedJSHeapSize,
        totalHeap: memory.totalJSHeapSize
      };

      setDebugState(prev => ({
        ...prev,
        memorySnapshots: [...prev.memorySnapshots.slice(-19), snapshot] // Keep last 20 snapshots
      }));
    }
  };

  // Auto-collect memory snapshots
  useEffect(() => {
    if (!debugState.isVisible) return;

    const interval = setInterval(takeMemorySnapshot, 2000); // Every 2 seconds
    return () => clearInterval(interval);
  }, [debugState.isVisible]);

  // Mark render start
  const markRenderStart = () => {
    recordPerformanceMetrics({ renderStart: performance.now() });
  };

  // Mark render end
  const markRenderEnd = () => {
    recordPerformanceMetrics({ renderEnd: performance.now() });
  };

  // Calculate render time
  const getRenderTime = () => {
    const { renderStart, renderEnd } = debugState.performanceData;
    return renderEnd > renderStart ? renderEnd - renderStart : 0;
  };

  return {
    debugState,
    toggleDebugUI,
    recordPerformanceMetrics,
    takeMemorySnapshot,
    markRenderStart,
    markRenderEnd,
    getRenderTime,
    isDebugVisible: debugState.isVisible
  };
};