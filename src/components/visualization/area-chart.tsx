import React from "react";
import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Brush,
  Legend,
} from "recharts";
import { ChartConfig, MultiSeriesConfig } from "../../types/sensor";
import { axisStyle, brushConfig, CHART_COLORS, tooltipStyle } from "../../data/analytics";

interface AreaChartProps {
  config: ChartConfig | MultiSeriesConfig;
  isMultiSeries?: boolean;
  onBrushChange?: (start: Date, end: Date) => void;
  onZoomChange?: (isZoomed: boolean) => void;
}

export const AreaChart: React.FC<AreaChartProps> = ({ config, isMultiSeries = false, onBrushChange, onZoomChange }) => {
  // Prepare data for single or multi-series
  const chartData = React.useMemo(() => {
    if (isMultiSeries) {
      const multiConfig = config as MultiSeriesConfig;
      if (multiConfig.series.length === 0 || multiConfig.series[0].data.length === 0) return [];

      // Create a map of timestamps to values for each series
      const timestampMap: Record<number, Record<string, number>> = {};

      multiConfig.series.forEach((series) => {
        series.data.forEach((point) => {
          if (!timestampMap[point.timestamp]) {
            timestampMap[point.timestamp] = {};
          }
          timestampMap[point.timestamp][series.id] = point.value;
        });
      });

      // Convert the map to an array of objects
      return Object.entries(timestampMap).map(([timestamp, values]) => ({
        timestamp: Number(timestamp),
        ...values,
      }));
    } else {
      const singleConfig = config as ChartConfig;
      return singleConfig.series;
    }
  }, [config, isMultiSeries]);

  // Decide whether we're looking at more than one day
  const multiDay = React.useMemo(() => {
    if (chartData.length < 2) return false;
    const timestamps = chartData.map((d) => d.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const spanMs = maxTime - minTime;
    return spanMs > 24 * 60 * 60 * 1000; // > 1 day
  }, [chartData]);

  // Format functions
  const formatXAxis = (timestamp: number) => {
    const d = new Date(timestamp);
    return multiDay
      ? d.toLocaleDateString([], { month: "short", day: "numeric" }) // e.g. "May 24"
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); // e.g. "14:30"
  };

  const formatTooltipDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle brush change
  const handleBrushChange = (data: any) => {
    if (!onBrushChange || !data.startIndex || !data.endIndex) return;

    if (isMultiSeries) {
      const multiConfig = config as MultiSeriesConfig;
      if (multiConfig.series.length === 0 || multiConfig.series[0].data.length === 0) return;

      const startTimestamp = multiConfig.series[0].data[data.startIndex].timestamp;
      const endTimestamp = multiConfig.series[0].data[data.endIndex].timestamp;

      onBrushChange(new Date(startTimestamp), new Date(endTimestamp));
      if (onZoomChange) onZoomChange(true);
    } else {
      const singleConfig = config as ChartConfig;
      if (singleConfig.series.length === 0) return;

      const startTimestamp = singleConfig.series[data.startIndex].timestamp;
      const endTimestamp = singleConfig.series[data.endIndex].timestamp;

      onBrushChange(new Date(startTimestamp), new Date(endTimestamp));
      if (onZoomChange) onZoomChange(true);
    }
  };

  // Check for empty data
  if (isMultiSeries) {
    const multiConfig = config as MultiSeriesConfig;
    if (!multiConfig.series || multiConfig.series.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-default-500">No data available for selected sensors</p>
        </div>
      );
    }
  } else {
    const singleConfig = config as ChartConfig;
    if (!singleConfig.series || singleConfig.series.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-default-500">No data available for this sensor</p>
        </div>
      );
    }
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--heroui-divider)" />
          <XAxis dataKey="timestamp" tickFormatter={formatXAxis} {...axisStyle} />
          <YAxis
            {...axisStyle}
            label={{
              value: isMultiSeries ? (config as MultiSeriesConfig).unit : (config as ChartConfig).unit,
              angle: -90,
              position: "insideLeft",
              style: { ...axisStyle, fill: CHART_COLORS.text },
            }}
          />
          <Tooltip
            formatter={(value: number) => [
              `${value} ${isMultiSeries ? (config as MultiSeriesConfig).unit : (config as ChartConfig).unit}`, ''
            ]}
            labelFormatter={formatTooltipDate}
            contentStyle={tooltipStyle}
            itemStyle={{ color: CHART_COLORS.text }}
          />

          {isMultiSeries ? (
            <>
             <Legend wrapperStyle={{ paddingTop: 20 }} />
              {(config as MultiSeriesConfig).series.map((series, index) => (
                <Area
                  key={series.id}
                  type="monotone"
                  dataKey={series.id}
                  name={series.name}
                  stroke={series.color || CHART_COLORS.primary}
                  fill={`${series.color}33`} // Add transparency
                  activeDot={{ r: 4 }}
                />
              ))}
            </>
          ) : (
            <Area
              type="monotone"
              dataKey="value"
              stroke={(config as ChartConfig).color || "var(--heroui-primary)"}
              fill={(config as ChartConfig).color ? `${(config as ChartConfig).color}33` : "var(--heroui-primary-200)"}
              activeDot={{ r: 4 }}
            />
          )}

          <Brush
            dataKey="timestamp"
            {...brushConfig}
            tickFormatter={formatXAxis}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
};
