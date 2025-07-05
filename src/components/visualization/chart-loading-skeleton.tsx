import React from 'react';
import { Card, Skeleton } from '@heroui/react';

export const ChartLoadingSkeleton: React.FC = () => {
  return (
    <Card className="w-full h-full border border-default-200 shadow-md">
      <div className="p-4 border-b border-divider bg-default-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="w-6 h-6 rounded" />
            <div>
              <Skeleton className="w-32 h-4 rounded mb-1" />
              <Skeleton className="w-24 h-3 rounded" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded" />
            <Skeleton className="w-8 h-8 rounded" />
          </div>
        </div>
      </div>

      <div className="p-4 h-[calc(100%-64px)]">
        {/* Tab skeletons */}
        <div className="flex gap-4 mb-4">
          <Skeleton className="w-20 h-8 rounded" />
          <Skeleton className="w-20 h-8 rounded" />
        </div>
        
        {/* Chart area skeleton */}
        <div className="flex-1 space-y-4">
          {/* Chart header/legend */}
          <div className="flex justify-between items-center">
            <Skeleton className="w-40 h-6 rounded" />
            <Skeleton className="w-24 h-6 rounded" />
          </div>
          
          {/* Chart lines simulation */}
          <div className="h-64 flex items-end justify-between gap-2">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton 
                key={i} 
                className="w-3 rounded-t" 
                style={{ height: `${Math.random() * 80 + 20}%` }}
              />
            ))}
          </div>
          
          {/* Chart footer */}
          <div className="flex justify-between">
            <Skeleton className="w-16 h-4 rounded" />
            <Skeleton className="w-16 h-4 rounded" />
          </div>
        </div>
      </div>
    </Card>
  );
};
