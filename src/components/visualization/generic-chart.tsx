import React from 'react';
import { LineChart } from './line-chart';
import { AreaChart } from './area-chart';
import { BarChart } from './bar-chart';
import { GaugeChart } from './gauge-chart';
import { ChartConfig, VisualizationType } from '../../types/sensor';

interface GenericChartProps {
  config: ChartConfig;
  visualizationType: VisualizationType;
  onBrushChange?: (start: Date, end: Date) => void;
  onZoomChange?: (isZoomed: boolean) => void;
}

export const GenericChart: React.FC<GenericChartProps> = ({
  config,
  visualizationType,
  onBrushChange,
  onZoomChange
}) => {
  switch (visualizationType) {
    case 'area':
      return (
        <AreaChart 
          config={config}
          onBrushChange={onBrushChange}
          onZoomChange={onZoomChange}
        />
      );
    case 'bar':
      return (
        <BarChart 
          config={config}
          onBrushChange={onBrushChange}
          onZoomChange={onZoomChange}
        />
      );
    case 'gauge':
      return (
        <GaugeChart config={config} />
      );
    default:
      return (
        <LineChart 
          config={config}
          onZoomChange={onZoomChange}
        />
      );
  }
};