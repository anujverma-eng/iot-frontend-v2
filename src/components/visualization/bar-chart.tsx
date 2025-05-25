import React from "react";
import {
  Bar,
  Brush,
  CartesianGrid,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartConfig } from "../../types/sensor";
import { axisStyle, brushConfig, CHART_COLORS, tooltipStyle } from "../../data/analytics";

interface BarChartProps {
  config: ChartConfig;
  onBrushChange?: (start: Date, end: Date) => void;
  onZoomChange?: (isZoomed: boolean) => void;
}

export const BarChart: React.FC<BarChartProps> = ({ config, onBrushChange, onZoomChange }) => {
  // Format functions
  const formatXAxis = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTooltipDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check for empty data
  if (!config.series || config.series.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-default-500">No data available for this sensor</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={config.series} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
          <XAxis dataKey="timestamp" tickFormatter={formatXAxis} {...axisStyle} />
          <YAxis
            {...axisStyle}
            label={{
              value: config.unit,
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "var(--heroui-foreground-500)", fontSize: 12 },
            }}
          />
          <Tooltip
            formatter={(value: number) => [`${value} ${config.unit}`, ""]}
            labelFormatter={formatTooltipDate}
            contentStyle={tooltipStyle}
            itemStyle={{ color: CHART_COLORS.text }}
          />
          <Bar dataKey="value" fill={config.color || CHART_COLORS.primary} radius={[4, 4, 0, 0]} />

          <Brush dataKey="timestamp" {...brushConfig} tickFormatter={formatXAxis} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
};
