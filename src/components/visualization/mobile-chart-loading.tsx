import { Card, Skeleton, Spinner } from '@heroui/react';
import React from 'react';

interface MobileChartLoadingProps {
  sensorName?: string;
  sensorMac?: string;
}

export const MobileChartLoading: React.FC<MobileChartLoadingProps> = ({
  sensorName,
  sensorMac
}) => {
  return (
    <Card className="w-full h-full border border-default-200 shadow-md">
      <div className="p-3 border-b border-divider bg-default-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-5 h-5 rounded" />
            <div>
              <Skeleton className="w-24 h-3 rounded mb-1" />
              <Skeleton className="w-16 h-2 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="w-6 h-6 rounded" />
          </div>
        </div>
      </div>

      <div className="p-3 h-[calc(100%-60px)] flex flex-col">
        {/* Mobile tabs */}
        <div className="flex gap-2 mb-3">
          <Skeleton className="w-16 h-6 rounded" />
          <Skeleton className="w-16 h-6 rounded" />
        </div>
        
        {/* Chart area optimized for mobile */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-3">
          <Spinner size="md" color="primary" />
          <div className="text-center">
            <p className="text-sm text-default-500 mb-1">Loading chart data...</p>
            {sensorName && (
              <p className="text-xs text-default-400">{sensorName}</p>
            )}
          </div>
          
          {/* Simple chart skeleton for mobile */}
          <div className="w-full h-32 bg-default-100 rounded-lg flex items-end justify-center gap-1 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div 
                key={i} 
                className="bg-default-200 rounded-sm animate-pulse"
                style={{ 
                  width: '8px',
                  height: `${Math.random() * 60 + 20}%`,
                  animationDelay: `${i * 100}ms`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};
