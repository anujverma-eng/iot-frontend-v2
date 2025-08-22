import { Card, CardBody, Chip } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { 
  CartesianGrid, 
  Line, 
  LineChart, 
  ReferenceArea, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis,
  Brush
} from "recharts";
import { ChartConfig } from "../../../types/sensor";
import { formatNumericValue } from '../../../utils/numberUtils';

interface TrendAnalysisChartProps {
  config: ChartConfig;
  showCards?: boolean;
  showChart?: boolean;
  isLiveMode?: boolean;
}

export const TrendAnalysisChart: React.FC<TrendAnalysisChartProps> = ({ 
  config, 
  showCards, 
  showChart, 
  isLiveMode = false 
}) => {
  const [brushDomain, setBrushDomain] = React.useState<[number, number] | null>(null);
  // Calculate trend data - recalculates in live mode when data changes
  const trendData = React.useMemo(() => {
    if (!config.series || config.series.length < 2) return null;

    // Safely extract numeric values and filter out invalid data
    const validData = config.series.filter(point => {
      const numValue = Number(point.value);
      return !isNaN(numValue) && isFinite(numValue);
    });

    if (validData.length < 2) return null;

    const values = validData.map((point) => {
      const numValue = Number(point.value);
      return isNaN(numValue) ? 0 : numValue;
    });
    const timestamps = validData.map((point) => point.timestamp);

    // Calculate moving average with safe math
    const windowSize = Math.max(5, Math.floor(values.length / 20)); // Dynamic window size
    const movingAvg = [];

    for (let i = 0; i < values.length; i++) {
      let sum = 0;
      let count = 0;

      for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
        const value = values[j];
        if (!isNaN(value) && isFinite(value)) {
          sum += value;
          count++;
        }
      }

      const avgValue = count > 0 ? sum / count : 0;
      movingAvg.push({
        timestamp: timestamps[i],
        value: values[i],
        ma: isNaN(avgValue) ? 0 : avgValue,
      });
    }

    // Calculate linear regression with safe math
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    // Normalize timestamps to days from start for better numerical stability
    const startTime = timestamps[0];
    const normalizedX = timestamps.map((t) => (t - startTime) / (24 * 60 * 60 * 1000)); // days

    normalizedX.forEach((x, i) => {
      const y = values[i];
      if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
      }
    });

    const n = values.length;
    const denominator = n * sumX2 - sumX * sumX;
    const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
    const intercept = n > 0 ? (sumY - slope * sumX) / n : 0;

    // Calculate trend line points
    const trendLine = [
      {
        timestamp: timestamps[0],
        trend: isNaN(intercept) ? 0 : intercept,
      },
      {
        timestamp: timestamps[timestamps.length - 1],
        trend: isNaN(intercept + slope * normalizedX[normalizedX.length - 1]) ? 0 : intercept + slope * normalizedX[normalizedX.length - 1],
      },
    ];

    // Calculate trend direction and strength
    const trendDirection = slope > 0 ? "up" : slope < 0 ? "down" : "neutral";

    // Calculate R-squared to measure trend strength with safe math
    const meanY = n > 0 ? sumY / n : 0;
    let totalVariation = 0;
    let explainedVariation = 0;

    normalizedX.forEach((x, i) => {
      const y = values[i];
      if (!isNaN(x) && !isNaN(y) && isFinite(x) && isFinite(y)) {
        const yPred = intercept + slope * x;
        if (!isNaN(yPred) && isFinite(yPred)) {
          totalVariation += Math.pow(y - meanY, 2);
          explainedVariation += Math.pow(yPred - meanY, 2);
        }
      }
    });

    const rSquared = totalVariation > 0 ? explainedVariation / totalVariation : 0;

    // Identify significant changes (segments where slope changes significantly)
    const segments = [];
    const segmentSize = Math.max(5, Math.floor(values.length / 10));

    for (let i = 0; i < values.length - segmentSize; i += segmentSize) {
      const segValues = values.slice(i, i + segmentSize);
      const segTimestamps = timestamps.slice(i, i + segmentSize);

      // Calculate segment slope
      let segSumX = 0;
      let segSumY = 0;
      let segSumXY = 0;
      let segSumX2 = 0;

      const segNormalizedX = segTimestamps.map((t) => (t - segTimestamps[0]) / (24 * 60 * 60 * 1000));

      segNormalizedX.forEach((x, j) => {
        const y = segValues[j];
        segSumX += x;
        segSumY += y;
        segSumXY += x * y;
        segSumX2 += x * x;
      });

      const segN = segValues.length;
      const segSlope = (segN * segSumXY - segSumX * segSumY) / (segN * segSumX2 - segSumX * segSumX);

      // If slope is significantly different from overall slope, mark as significant
      if (Math.abs(segSlope - slope) > Math.abs(slope) * 0.5) {
        segments.push({
          start: segTimestamps[0],
          end: segTimestamps[segTimestamps.length - 1],
          slope: segSlope,
          direction: segSlope > 0 ? "up" : "down",
        });
      }
    }

    return {
      movingAvg,
      trendLine,
      slope,
      intercept,
      rSquared,
      trendDirection,
      segments,
      normalizedSlope: slope * (24 * 60 * 60 * 1000), // Convert to change per day
    };
  }, [config.series]);

  if (!trendData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-default-500">Insufficient data for trend analysis</p>
      </div>
    );
  }

  const getTrendDescription = () => {
    const { trendDirection, rSquared, normalizedSlope } = trendData;

    let strength = "no";
    if (rSquared > 0.7) strength = "strong";
    else if (rSquared > 0.3) strength = "moderate";
    else if (rSquared > 0.1) strength = "weak";

    const absSlope = Math.abs(normalizedSlope);
    let rate = "";

    if (absSlope > 0) {
      rate = ` at ${formatNumericValue(absSlope)} ${config.unit}/day`;
    }

    return `${strength} ${trendDirection} trend${rate}`;
  };

  const getTrendColor = () => {
    const { trendDirection } = trendData;

    switch (trendDirection) {
      case "up":
        return "success";
      case "down":
        return "danger";
      default:
        return "default";
    }
  };

  return (
    <div className={`w-full ${showChart ? "h-full" : ""}`}>
      <div className="flex flex-col h-full">
        {showCards && (
          <div className="mb-4">
            <Card className="shadow-sm">
              <CardBody className="p-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary-50 text-primary">
                      <Icon
                        icon={
                          trendData.trendDirection === "up"
                            ? "lucide:trending-up"
                            : trendData.trendDirection === "down"
                              ? "lucide:trending-down"
                              : "lucide:minus"
                        }
                        width={18}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Trend Analysis</p>
                      <p className="text-xs text-default-500">Based on {config.series.length} data points</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Chip
                      color={getTrendColor()}
                      variant="flat"
                      startContent={
                        <Icon
                          icon={
                            trendData.trendDirection === "up"
                              ? "lucide:trending-up"
                              : trendData.trendDirection === "down"
                                ? "lucide:trending-down"
                                : "lucide:minus"
                          }
                          width={14}
                        />
                      }
                    >
                      {getTrendDescription()}
                    </Chip>

                    <Chip variant="flat" color="secondary">
                      R² = {formatNumericValue(trendData.rSquared)}
                    </Chip>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {showChart && (
          <div className={`flex-1 ${showChart ? "h-full mt-5" : "min-h-[300px]"}`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData.movingAvg} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="timestamp"
                  stroke="#374151"
                  tick={{ fill: "#374151" }}
                  axisLine={{ stroke: "#94a3b8" }}
                  fontSize={12}
                  tickMargin={10}
                  tickFormatter={(timestamp) => {
                    const date = new Date(timestamp);
                    return date.toLocaleDateString("en-US", { 
                      month: "short", 
                      day: "numeric",
                      ...(brushDomain ? { hour: "2-digit", minute: "2-digit" } : {})
                    });
                  }}
                  type="number"
                  scale="time"
                  domain={brushDomain || ["dataMin", "dataMax"]}
                />
                <YAxis
                  stroke="#374151"
                  tick={{ fill: "#374151" }}
                  axisLine={{ stroke: "#94a3b8" }}
                  fontSize={12}
                  tickMargin={10}
                  domain={["auto", "auto"]}
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
                    if (name === "ma") return [`${formatNumericValue(value)} ${config.unit}`, "Moving Avg"];
                    if (name === "value") return [`${formatNumericValue(value)} ${config.unit}`, "Value"];
                    return [`${formatNumericValue(value)} ${config.unit}`, name];
                  }}
                  labelFormatter={(timestamp) => new Date(timestamp).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric", 
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                    padding: "8px 12px",
                  }}
                />

                {/* Raw data */}
                <Line type="monotone" dataKey="value" stroke="#94a3b8" dot={false} strokeWidth={1} opacity={0.5} />

                {/* Moving average */}
                <Line type="monotone" dataKey="ma" stroke="#4f46e5" dot={false} strokeWidth={2.5} />

                {/* Trend line */}
                <Line
                  data={trendData.trendLine}
                  type="monotone"
                  dataKey="trend"
                  stroke={
                    trendData.trendDirection === "up"
                      ? "#10b981"
                      : trendData.trendDirection === "down"
                        ? "#ef4444"
                        : "#6b7280"
                  }
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />

                {/* Significant change segments */}
                {trendData.segments.map((segment, index) => (
                  <ReferenceArea
                    key={index}
                    x1={segment.start}
                    x2={segment.end}
                    fill={segment.direction === "up" ? "#10b98133" : "#ef444433"}
                    fillOpacity={0.3}
                  />
                ))}

                {/* Add brush for interactive time selection - disabled in live mode */}
                {!isLiveMode && (
                  <Brush 
                    dataKey="timestamp" 
                    height={30}
                    stroke="#4f46e5"
                    fill="rgba(79, 70, 229, 0.1)"
                    tickFormatter={(timestamp) => {
                      const date = new Date(timestamp);
                      return date.toLocaleDateString("en-US", { 
                        month: "short", 
                        day: "numeric" 
                      });
                    }}
                    onChange={(brushData) => {
                      if (brushData?.startIndex !== undefined && brushData?.endIndex !== undefined) {
                      const startTimestamp = trendData.movingAvg[brushData.startIndex]?.timestamp;
                      const endTimestamp = trendData.movingAvg[brushData.endIndex]?.timestamp;
                      if (startTimestamp && endTimestamp) {
                        setBrushDomain([startTimestamp, endTimestamp]);
                      }
                    } else {
                      setBrushDomain(null);
                    }
                  }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
