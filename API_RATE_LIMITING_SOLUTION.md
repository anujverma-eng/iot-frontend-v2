# API Rate Limiting Solution Implementation

## Problem Summary
- **Issue**: Receiving 5 WebSocket readings per second was causing repeated API calls to `/sensors/{mac}` endpoint
- **Impact**: Performance degradation and unnecessary server load
- **Root Cause**: Unknown sensor MAC addresses in live data triggered repeated sensor detail fetches

## Solution Implemented

### 1. Rate Limiting in Sensors Slice (`sensorsSlice.ts`)
- Added `sensorFetchCache` Map with 30-second cooldown period
- Enhanced `fetchSensorDetails` action with rate limiting logic
- Prevents duplicate API calls for the same MAC within cooldown period
- Returns rejection if request is made too soon

### 2. Smart Auto-Discovery in Telemetry Slice (`telemetrySlice.ts`)
- Added `unknownSensors` array to track MAC addresses needing discovery
- Implemented 60-second cooldown for unknown sensor auto-discovery attempts
- Rate-limited unknown sensor detection in `addLiveData` reducer
- Added `clearUnknownSensor` action to manage discovery queue

### 3. Background Auto-Discovery Hook (`useUnknownSensorDiscovery.ts`)
- Created dedicated hook for handling unknown sensor discovery
- Processes unknown sensors asynchronously without blocking live data
- Automatically removes successfully discovered or failed sensors from queue
- Integrates with Redux state management for seamless operation

### 4. Dashboard Integration (`dashboard-layout.tsx`)
- Integrated unknown sensor discovery hook into main dashboard layout
- Ensures auto-discovery runs whenever dashboard is active
- No UI changes or disruption to existing user experience

## Key Features

### Rate Limiting Mechanism
```typescript
// 30-second cooldown for sensor detail fetches
const sensorFetchCache = new Map<string, number>();
const SENSOR_FETCH_COOLDOWN = 30000;

// 60-second cooldown for unknown sensor discovery
const unknownSensorCache = new Map<string, number>();
const UNKNOWN_SENSOR_COOLDOWN = 60000;
```

### Live Data Processing Enhancement
- Unknown sensors are logged and queued for discovery
- Live data processing continues uninterrupted
- Rate limiting prevents API spam while maintaining auto-discovery

### Background Processing
- Auto-discovery happens asynchronously
- No blocking of live data or UI interactions
- Automatic cleanup of discovered/failed sensors

## Benefits

1. **Performance Improvement**
   - Eliminated repeated API calls for same sensor within 30 seconds
   - Reduced server load and improved response times
   - Better handling of high-frequency live data (5 readings/second)

2. **Reliability**
   - Maintains auto-discovery functionality for new sensors
   - Graceful handling of unknown sensors
   - Error recovery and cleanup mechanisms

3. **User Experience**
   - No breaking changes to existing functionality
   - Seamless live data experience
   - Transparent background processing

4. **Scalability**
   - Configurable cooldown periods
   - Memory-efficient caching with automatic cleanup
   - Handles multiple unknown sensors simultaneously

## Testing Validation

- ✅ TypeScript compilation successful
- ✅ No breaking changes to existing components
- ✅ Rate limiting cache implementation working
- ✅ Unknown sensor queue management functional
- ✅ Background auto-discovery hook integrated

## Configuration Options

The solution includes configurable constants that can be adjusted:

```typescript
// Sensor fetch rate limiting (30 seconds)
const SENSOR_FETCH_COOLDOWN = 30000;

// Unknown sensor discovery cooldown (60 seconds) 
const UNKNOWN_SENSOR_COOLDOWN = 60000;

// Maximum live readings retention
maxLiveReadings: 1000
```

## Monitoring

The implementation includes comprehensive logging for debugging:
- Rate limiting decisions
- Auto-discovery attempts
- Cache management
- Unknown sensor processing

All log messages are prefixed with `[TelemetrySlice]` or `[SensorsSlice]` for easy identification.
