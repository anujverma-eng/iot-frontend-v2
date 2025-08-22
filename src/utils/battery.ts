// Battery utility functions and constants
import React from 'react';
import { Battery, BatteryLow, BatteryWarning } from 'lucide-react';

export const LOW_BATTERY_THRESHOLD = 20; // Constant to mark sensor as low battery

export type BatteryLevel = 'critical' | 'low' | 'moderate' | 'good';

/**
 * Get battery level category based on percentage
 */
export const getBatteryLevel = (battery: number | undefined): BatteryLevel => {
  if (battery === undefined || battery < 0 || battery > 100) return 'critical';
  
  if (battery <= LOW_BATTERY_THRESHOLD) return 'critical'; // 0-20% = critical (red)
  if (battery <= 60) return 'moderate'; // 21-60% = moderate (yellow)
  return 'good'; // 61-100% = good (green)
};

/**
 * Get battery color based on level
 */
export const getBatteryColor = (battery: number | undefined): string => {
  const level = getBatteryLevel(battery);
  
  switch (level) {
    case 'critical':
      return 'text-red-500'; // Red for critical/low battery
    case 'moderate':
      return 'text-yellow-500'; // Yellow for moderate
    case 'good':
      return 'text-green-500'; // Green for good battery
    default:
      return 'text-gray-400'; // Gray for unknown
  }
};

/**
 * Get battery icon component based on level
 */
export const getBatteryIconComponent = (battery: number | undefined, className?: string) => {
  if (battery === undefined) {
    return React.createElement(BatteryWarning, { 
      className: `${className || ''} text-gray-400`,
      size: 16 
    });
  }
  
  const level = getBatteryLevel(battery);
  const colorClass = getBatteryColor(battery);
  
  switch (level) {
    case 'critical':
      return React.createElement(BatteryWarning, { 
        className: `${className || ''} ${colorClass}`,
        size: 16 
      });
    case 'moderate':
      return React.createElement(BatteryLow, { 
        className: `${className || ''} ${colorClass}`,
        size: 16 
      });
    case 'good':
      return React.createElement(Battery, { 
        className: `${className || ''} ${colorClass}`,
        size: 16 
      });
    default:
      return React.createElement(BatteryWarning, { 
        className: `${className || ''} text-gray-400`,
        size: 16 
      });
  }
};

/**
 * Get battery icon string based on level (for legacy Icon component)
 */
export const getBatteryIcon = (battery: number | undefined): string => {
  if (battery === undefined) return 'lucide:battery-warning';
  
  const level = getBatteryLevel(battery);
  
  switch (level) {
    case 'critical':
      return 'lucide:battery-warning';
    case 'moderate':
      return 'lucide:battery-low';
    case 'good':
      return 'lucide:battery';
    default:
      return 'lucide:battery-warning';
  }
};

/**
 * Format battery display text
 */
export const formatBatteryDisplay = (battery: number | undefined): string => {
  if (battery === undefined || battery < 0 || battery > 100) {
    return 'Unknown';
  }
  return `${Math.round(battery)}%`;
};

/**
 * Check if sensor has low battery
 */
export const isLowBattery = (battery: number | undefined): boolean => {
  return battery !== undefined && battery >= 0 && battery <= 100 && battery <= LOW_BATTERY_THRESHOLD;
};

/**
 * Get card background class for low battery highlighting
 */
export const getBatteryCardClass = (battery: number | undefined): string => {
  if (isLowBattery(battery)) {
    return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/30';
  }
  return '';
};

/**
 * Sort sensors by battery level (lowest battery last)
 */
export const sortSensorsByBattery = <T extends { battery?: number }>(sensors: T[]): T[] => {
  return [...sensors].sort((a, b) => {
    // Handle undefined batteries - put them at the end
    if (a.battery === undefined && b.battery === undefined) return 0;
    if (a.battery === undefined) return 1;
    if (b.battery === undefined) return -1;
    
    // Sort by battery level (highest first, lowest last)
    return b.battery - a.battery;
  });
};
