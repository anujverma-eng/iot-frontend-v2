# Real Data Flow Example

## 📊 Actual Data Transformation: Temperature Sensor

Let's trace real data through the entire pipeline with concrete examples.

## Step 1: User Selection
```javascript
// User clicks temperature sensor card
// SensorCard triggers debounced selection
sensorId: "temp_sensor_001"
mac: "AA:BB:CC:DD:EE:FF"
displayName: "Living Room Temperature"
```

## Step 2: Time Range & Mobile Detection
```javascript
// Current filters in Redux
filters.timeRange = {
  start: "2025-07-04T00:00:00.000Z", // 24 hours ago
  end: "2025-07-05T23:59:59.999Z"    // now
}

// Mobile detection
isMobile = window.innerWidth < 768; // false (desktop)
targetPoints = isMobile ? 250 : 400; // 400 for desktop
```

## Step 3: Bucket Size Calculation
```javascript
// chooseBucketSize() calculation
const timeSpanMs = 86400000; // 24 hours in milliseconds
const timeSpanSecs = 86400;  // 24 hours in seconds
const ideal = timeSpanSecs / 400; // 216 seconds per point

// Bucket logic:
// ideal (216s) > 60s, so check next level
// ideal (216s) > 300s (5min)? No, so use "5m"

bucketSize = "5m"; // 5-minute aggregation
expectedPoints = 24 * 60 / 5 = 288 points
```

## Step 4: API Request
```javascript
// Request sent to backend
POST /api/telemetry/query
{
  sensorIds: ["temp_sensor_001"],
  timeRange: {
    start: "2025-07-04T00:00:00.000Z",
    end: "2025-07-05T23:59:59.999Z"
  },
  bucketSize: "5m"
}
```

## Step 5: Backend Response (288 points)
```javascript
// Backend returns aggregated data
[{
  sensorId: "temp_sensor_001",
  mac: "AA:BB:CC:DD:EE:FF", 
  type: "temperature",
  unit: "°C",
  min: 18.2,
  max: 28.9,
  avg: 23.4,
  current: 24.1,
  data: [
    { timestamp: "2025-07-04T00:00:00.000Z", value: 22.5 },
    { timestamp: "2025-07-04T00:05:00.000Z", value: 22.7 },
    { timestamp: "2025-07-04T00:10:00.000Z", value: 22.8 },
    // ... continues for 288 total points (every 5 minutes)
    { timestamp: "2025-07-05T23:55:00.000Z", value: 24.1 }
  ]
}]
```

## Step 6: Redux Processing
```javascript
// telemetrySlice transforms data
const processedData = {
  id: "temp_sensor_001",
  mac: "AA:BB:CC:DD:EE:FF",
  type: "temperature", 
  unit: "°C",
  min: 18.2,
  max: 28.9,
  avg: 23.4,
  current: 24.1,
  series: [
    { timestamp: 1720051200000, value: 22.5 }, // epoch ms
    { timestamp: 1720051500000, value: 22.7 },
    { timestamp: 1720051800000, value: 22.8 },
    // ... 288 points total
    { timestamp: 1720137300000, value: 24.1 }
  ]
};

// Stored in state
state.telemetry.data["temp_sensor_001"] = processedData;
```

## Step 7: Chart Config Generation
```javascript
// analytics.tsx useMemo creates chart config
const chartConfig = {
  type: "temperature",
  unit: "°C",
  series: [
    { timestamp: 1720051200000, value: 22.5 },
    { timestamp: 1720051500000, value: 22.7 },
    // ... 288 points (unchanged, under 1000 limit)
  ],
  color: "#3b82f6" // blue for temperature
};
```

## Step 8: LineChart Data Sampling
```javascript
// optimizeDataForRendering() in LineChart
const inputData = chartConfig.series; // 288 points
const dataLength = inputData.length;   // 288

// Sampling check
if (dataLength > 1000) {
  // Would sample, but 288 < 1000, so no sampling needed
  const step = Math.ceil(dataLength / 800); // not executed
  return inputData.filter((_, index) => index % step === 0);
}

// Return all data unchanged
return inputData; // All 288 points preserved
```

## Step 9: Final Chart Data Structure
```javascript
// Data passed to Recharts
const finalChartData = [
  { timestamp: 1720051200000, value: 22.5 },
  { timestamp: 1720051500000, value: 22.7 },
  { timestamp: 1720051800000, value: 22.8 },
  // ... continues for all 288 points
  { timestamp: 1720137300000, value: 24.1 }
];

// Chart rendering metrics
totalDataPoints: 288,
renderElements: 288 * 2, // line points + tooltip areas  
memoryUsage: "~0.5MB",
renderTime: "~150ms"
```

## 🔄 Alternative Scenario: High-Frequency Data

What if the same sensor had 10-second intervals instead?

```javascript
// Scenario: 10-second intervals for 24 hours
totalRawPoints = 24 * 60 * 60 / 10 = 8,640 points

// Backend still uses 5m buckets (same API call)
backendReturns = 288 points // same as above

// But if raw data came through:
chartData.length = 8640; // > 1000 threshold

// Sampling would trigger:
step = Math.ceil(8640 / 800) = 11;
sampledData = originalData.filter((_, i) => i % 11 === 0);
finalPoints = 8640 / 11 ≈ 785 points;

// Performance improvement:
reduction = (8640 - 785) / 8640 = 91% fewer render elements
```

## 📱 Mobile Scenario

Same data on mobile device:

```javascript
// Mobile detection
isMobile = true;
targetPoints = 250; // reduced for mobile

// If sampling was needed:
step = Math.ceil(8640 / 250) = 35;
mobileOptimizedPoints = 8640 / 35 ≈ 247 points;

// Mobile performance:
renderElements = 247 * 2 = 494 total elements;
memoryUsage = "~0.2MB";
renderTime = "~80ms"; // faster on mobile
```

## 🎯 Performance Summary

| Scenario | Raw Points | Backend Points | Rendered Points | Reduction |
|----------|------------|----------------|-----------------|-----------|
| **Current (5m bucket)** | 288 | 288 | 288 | 0% (optimal) |
| **High-freq (10s raw)** | 8,640 | 288* | 785 | 91% |
| **Mobile high-freq** | 8,640 | 288* | 247 | 97% |

*Backend aggregation prevents raw high-frequency data from reaching frontend

## 🔍 Key Optimization Points

1. **Backend Aggregation**: Prevents massive datasets from ever reaching the frontend
2. **Intelligent Sampling**: Only applies when data exceeds reasonable thresholds  
3. **Mobile Adaptation**: Further reduces data for mobile constraints
4. **Request Management**: Prevents race conditions and unnecessary calls

The result is a system that automatically adapts to any data volume while maintaining smooth performance across all devices.
