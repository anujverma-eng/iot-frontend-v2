import { Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import {
  Area,
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartConfig, MultiSeriesConfig } from "../../types/sensor";

interface LineChartProps {
  config: ChartConfig | MultiSeriesConfig;
  isMultiSeries?: boolean;
  onDownloadCSV?: () => void;
  onZoomChange?: (isZoomed: boolean) => void;
}

export const LineChart: React.FC<LineChartProps> = ({
  config,
  isMultiSeries = false,
  onDownloadCSV,
  onZoomChange,
}) => {
  console.log("Rendering LineChart with config:", config);

  // Add clear check for empty data
  const hasData = isMultiSeries ? config.series?.some((s: any) => s.data?.length > 0) : config.series?.length > 0;

  console.log(config.series);

  // If no data for the selected range, show a clear message
  if (!hasData) {
    return (
      <div className="h-full w-full flex items-center justify-center flex-col">
        <Icon icon="lucide:calendar-x" className="text-default-300 mb-2" width={32} height={32} />
        <p className="text-default-500">No data available for the selected time range</p>
      </div>
    );
  }

  const formatTooltipDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Track zoom state
  const [zoomDomain, setZoomDomain] = React.useState<{ x: [number, number]; y: [number, number] } | null>(null);

  // Notify parent about zoom state changes
  React.useEffect(() => {
    if (onZoomChange) {
      onZoomChange(!!zoomDomain);
    }
  }, [zoomDomain, onZoomChange]);

  // Add check for empty data with better error handling
  if (isMultiSeries) {
    const multiConfig = config as MultiSeriesConfig;
    if (
      !multiConfig.series ||
      multiConfig.series.length === 0 ||
      multiConfig.series.every((s) => !s.data || s.data.length === 0)
    ) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-2 mx-auto" width={32} height={32} />
            <p className="text-default-500">No data available for selected sensors</p>
          </div>
        </div>
      );
    }
  } else {
    const singleConfig = config as ChartConfig;
    if (!singleConfig.series || singleConfig.series.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-2 mx-auto" width={32} height={32} />
            <p className="text-default-500">No data available for this sensor</p>
          </div>
        </div>
      );
    }
  }

  const handleDownloadCSV = () => {
    if (!onDownloadCSV) return;
    onDownloadCSV();
  };

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

  // Add moving average calculation
  const chartDataWithMA = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return chartData;

    if (isMultiSeries || !(config as ChartConfig).showMovingAverage) {
      return chartData;
    }

    // Define a type that includes movingAverage
    type MovingAverageDataPoint = { timestamp: number; value: number; movingAverage?: number };
    const typedChartData = chartData as Array<{ timestamp: number; value: number }>;
    const result: MovingAverageDataPoint[] = typedChartData.map((point) => ({ ...point }));

    for (let i = 0; i < result.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = Math.max(0, i - 10 + 1); j <= i; j++) {
        sum += result[j].value;
        count++;
      }

      result[i].movingAverage = sum / count;
    }

    return result;
  }, [chartData, config, isMultiSeries]);

  const orderedData = React.useMemo(
    () => [...chartDataWithMA].sort((a, b) => a.timestamp - b.timestamp),
    [chartDataWithMA]
  );

  // Decide whether we're looking at more than one day
  const multiDay = React.useMemo(() => {
    if (orderedData.length < 2) return false;
    const spanMs = orderedData[orderedData.length - 1].timestamp - orderedData[0].timestamp;
    return spanMs > 24 * 60 * 60 * 1000; // > 1 day
  }, [orderedData]);

  const formatXAxis = (timestamp: number) => {
    const d = new Date(timestamp);
    return multiDay
      ? d.toLocaleDateString([], { month: "short", day: "numeric" }) // e.g. "May 24"
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); // e.g. "14:30"
  };

  const dailyRangeData = React.useMemo(() => {
    if (isMultiSeries || !(config as ChartConfig).showDailyRange || orderedData.length === 0) return [];

    const byDay: Record<string, { min: number; max: number }> = {};
    orderedData.forEach((p) => {
      const point = p as { timestamp: number; value: number };
      const key = new Date(point.timestamp).toISOString().slice(0, 10); // "2025-05-24"
      byDay[key] = byDay[key]
        ? { min: Math.min(byDay[key].min, point.value), max: Math.max(byDay[key].max, point.value) }
        : { min: point.value, max: point.value };
    });

    return Object.entries(byDay).map(([day, r]) => ({
      timestamp: new Date(`${day}T12:00:00Z`).getTime(),
      min: r.min,
      max: r.max,
      range: r.max - r.min,
    }));
  }, [orderedData, isMultiSeries, config]);

  console.log(dailyRangeData);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm font-medium text-primary-600">
          {isMultiSeries ? "Comparison Chart" : `${config.type.charAt(0).toUpperCase() + config.type.slice(1)} Data`}
          <span className="text-sm text-gray-500 ml-2">{config.unit}</span>
        </div>
        {onDownloadCSV && (
          <Button size="sm" variant="light" isIconOnly onPress={handleDownloadCSV} title="Download CSV">
            <Icon icon="lucide:download" width={16} className="text-primary-500" />
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
          <RechartsLineChart data={orderedData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#374151"
              tick={{ fill: "#374151" }}
              axisLine={{ stroke: "#94a3b8" }}
              fontSize={12}
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickMargin={10}
              height={50}
            />
            <YAxis
              stroke="#374151"
              tick={{ fill: "#374151" }}
              axisLine={{ stroke: "#94a3b8" }}
              fontSize={12}
              tickMargin={10}
              label={{
                value: config.unit,
                angle: -90,
                position: "insideLeft",
                style: {
                  textAnchor: "middle",
                  fill: "#4b5563",
                  fontSize: 12,
                  fontWeight: 500,
                },
                offset: -10,
              }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "movingAverage") {
                  return [`${value.toFixed(4)} ${config.unit} (MA)`, "Moving Avg"];
                }
                return [`${value} ${config.unit}`, ""];
              }}
              labelFormatter={(label: number) => formatTooltipDate(label)}
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                padding: "8px 12px",
              }}
              itemStyle={{ color: "#4b5563" }}
              cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
            />

            {(config as ChartConfig).showDailyRange && !isMultiSeries && dailyRangeData.length > 0 && (
              <>
                <defs>
                  <linearGradient id="dailyRangeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                {/* Daily range area */}
                <Area
                  data={dailyRangeData}
                  type="stepBefore"
                  dataKey="min"
                  stackId="range"
                  stroke="none"
                  fill="none"
                  isAnimationActive={false}
                />
                <Area
                  data={dailyRangeData}
                  type="stepBefore"
                  dataKey="range"
                  stackId="range"
                  stroke="none"
                  fill="url(#dailyRangeGradient)"
                  isAnimationActive={false}
                />
              </>
            )}

            {isMultiSeries ? (
              <>
                <Legend
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  iconSize={12}
                  iconType="circle"
                />
                {(config as MultiSeriesConfig).series.map((series) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.id}
                    name={series.name}
                    stroke={series.color || "#4f46e5"}
                    dot={false}
                    activeDot={{ r: 6, strokeWidth: 2 }}
                    strokeWidth={2.5}
                    animationDuration={1000}
                  />
                ))}
              </>
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={(config as ChartConfig).color || "#4f46e5"}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: "#4f46e5",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                    style: { filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))" },
                  }}
                  strokeWidth={2.5}
                  animationDuration={1000}
                />

                {(config as ChartConfig).showMovingAverage && (
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4 }}
                    strokeDasharray="5 5"
                    animationDuration={1500}
                  />
                )}
              </>
            )}

            <Brush
              dataKey="timestamp"
              height={36}
              stroke="#f59e0b"
              fill="#f3f4f6"
              travellerWidth={10}
              gap={1}
              tickFormatter={formatXAxis}
              startIndex={0}
              endIndex={orderedData.length ? orderedData.length - 1 : 0}
              // y={10}
              // style={{
              //   fill: "#f3f4f6",
              //   fillOpacity: 0.8,
              //   stroke: "#d1d5db",
              //   strokeWidth: 1
              // }}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm font-medium">
          {isMultiSeries ? "Comparison Chart" : `${config.type.charAt(0).toUpperCase() + config.type.slice(1)} Data`}
          <span className="text-sm text-gray-500 ml-2">{config.unit}</span>
        </div>
        <Button size="sm" variant="light" isIconOnly onPress={handleDownloadCSV} title="Download CSV">
          <Icon icon="lucide:download" width={16} />
        </Button>
      </div>

      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" className="overflow-visible">
          <RechartsLineChart data={orderedData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              stroke="#374151"
              tick={{ fill: "#374151" }}
              axisLine={{ stroke: "#d1d5db" }}
              fontSize={12}
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
            />
            <YAxis
              stroke="#374151"
              tick={{ fill: "#374151" }}
              axisLine={{ stroke: "#d1d5db" }}
              fontSize={12}
              label={{
                value: config.unit,
                angle: -90,
                position: "insideLeft",
                style: {
                  textAnchor: "middle",
                  fill: "#374151",
                  fontSize: 12,
                },
              }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "movingAverage") {
                  return [`${value.toFixed(4)} ${config.unit} (MA)`, "Moving Avg"];
                }
                return [`${value} ${config.unit}`, ""];
              }}
              labelFormatter={(label: number) => formatTooltipDate(label)}
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
              itemStyle={{ color: "#4b5563" }}
            />

            {(config as ChartConfig).showDailyRange && !isMultiSeries && dailyRangeData.length > 0 && (
              <>
                <defs>
                  <linearGradient id="dailyRangeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                  </linearGradient>
                </defs>

                {/* Daily range area */}
                <Area
                  data={dailyRangeData}
                  type="stepBefore"
                  dataKey="min"
                  stackId="range"
                  stroke="none"
                  fill="none"
                  isAnimationActive={false}
                />
                <Area
                  data={dailyRangeData}
                  type="stepBefore"
                  dataKey="range"
                  stackId="range"
                  stroke="none"
                  fill="url(#dailyRangeGradient)"
                  isAnimationActive={false}
                />
              </>
            )}

            {isMultiSeries ? (
              <>
                <Legend
                  wrapperStyle={{ paddingTop: 20 }}
                  formatter={(value) => <span className="text-sm text-gray-600">{value}</span>}
                  iconSize={12}
                  iconType="circle"
                />
                {(config as MultiSeriesConfig).series.map((series) => (
                  <Line
                    key={series.id}
                    type="monotone"
                    dataKey={series.id}
                    name={series.name}
                    stroke={series.color || "#4f46e5"}
                    dot={false}
                    activeDot={{ r: 4 }}
                    strokeWidth={2}
                  />
                ))}
              </>
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={(config as ChartConfig).color || "#4f46e5"}
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: "#4f46e5",
                    stroke: "#ffffff",
                    strokeWidth: 2,
                    style: { filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))" },
                  }}
                  strokeWidth={2}
                />

                {(config as ChartConfig).showMovingAverage && (
                  <Line
                    type="monotone"
                    dataKey="movingAverage"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4 }}
                    strokeDasharray="5 5"
                  />
                )}
              </>
            )}

            <Brush
              dataKey="timestamp"
              height={30}
              stroke="#f59e0b"
              fill="#f3f4f6"
              travellerWidth={10}
              gap={1}
              tickFormatter={formatXAxis}
              startIndex={0}
              endIndex={orderedData.length ? orderedData.length - 1 : 0}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
