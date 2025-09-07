// src/components/TableSkeleton.tsx
import React from 'react';
import { Skeleton } from '@heroui/react';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ 
  rows = 5, 
  columns = 4 
}) => {
  return (
    <div className="space-y-3">
      {/* Header skeleton */}
      <div className="flex gap-4 p-3 bg-default-100 rounded-lg">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="h-4 rounded flex-1" />
        ))}
      </div>
      
      {/* Rows skeleton */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-3 border-b border-default-200">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div key={colIndex} className="flex-1">
              {colIndex === 0 ? (
                // First column - avatar + name
                <div className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>
              ) : colIndex === columns - 1 ? (
                // Last column - actions
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-16 rounded" />
                  <Skeleton className="h-8 w-16 rounded" />
                </div>
              ) : (
                // Other columns
                <Skeleton className="h-4 w-20 rounded" />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
