# Memory Overflow and API Spam Fix

## Issues Identified

### 1. Memory Overflow Error
- **Root Cause**: `heroui-chat-script` in `index.html` was trying to clone large Redux state objects for debugging
- **Symptom**: `DataCloneError: Failed to execute 'postMessage' on 'Window': Data cannot be cloned, out of memory`
- **Fix**: Removed the problematic script from `index.html`

### 2. Excessive Console Logging
- **Root Cause**: High-frequency console logging on every WebSocket message was consuming memory
- **Symptoms**: Console spam with detailed sensor readings, series data, and debug info
- **Locations Fixed**:
  - `telemetrySlice.ts`: Reduced logging frequency to 5-10% of messages
  - `analytics.tsx`: Reduced debug logging to 1-2% of renders
  - `line-chart.tsx`: Reduced render logging to 1% of renders

### 3. Expensive Unknown Sensor Warnings
- **Root Cause**: Complex object serialization in console.warn for every unknown sensor reading
- **Symptom**: `console.warn` with full sensor state objects being logged repeatedly
- **Fix**: Implemented rate-limited logging (1 minute cooldown per unknown MAC)

## Changes Made

### `/index.html`
```html
<!-- REMOVED: heroui-chat-script was causing memory overflow -->
<!-- <script src="https://cdn.jsdelivr.net/npm/heroui-chat-script@0/dist/index.min.js"></script> -->
```

### `/src/store/telemetrySlice.ts`
- Reduced `addLiveData` logging from 100% to 5% frequency
- Simplified unknown sensor warnings with rate limiting
- Removed per-reading debug logs
- Added conditional logging for data trimming

### `/src/pages/analytics.tsx`
- Reduced debug logging from 100% to 1-2% frequency
- Removed heavy sensor iteration logs
- Simplified series length logging

### `/src/components/visualization/line-chart.tsx`
- Reduced render logging from 100% to 1% frequency
- Removed redundant debug output

## API Call Prevention

### Confirmed No Unnecessary API Calls
- ✅ `useUnknownSensorDiscovery` hook is disabled in `dashboard-layout.tsx`
- ✅ Auto-discovery thunk exists but is not called anywhere
- ✅ `updateSensorLastSeen` is a local Redux action, not an API call
- ✅ No components are auto-fetching unknown sensor details

### Why Unknown Sensors Appear
The logs show sensors like `54:64:DE:12:C9:89` appearing as "unknown" because:
1. They are sending data via WebSocket
2. They are not in the current Redux state (not claimed/loaded)
3. Auto-discovery is disabled (correctly) to prevent API spam
4. The system now safely ignores them without memory issues

## Results

### Memory Issues Resolved
- ✅ Removed memory-intensive chat script
- ✅ Drastically reduced console log volume
- ✅ Implemented rate-limited logging for unknown sensors
- ✅ Application should no longer crash with "out of memory" errors

### Performance Improvements
- ✅ Reduced CPU usage from excessive logging
- ✅ Lower memory consumption in browser DevTools
- ✅ Faster WebSocket message processing

### API Spam Prevention
- ✅ No unnecessary `/sensor/mac` API calls
- ✅ Unknown sensors are safely ignored
- ✅ Auto-discovery remains disabled as intended

## Testing Recommendations

1. **Monitor Memory Usage**: Check browser DevTools memory tab during live data streaming
2. **Verify Console Volume**: Ensure console logs are significantly reduced
3. **Check Network Tab**: Confirm no unexpected `/sensor/mac` API calls
4. **Live Data Performance**: Test with multiple sensors sending frequent data

## Notes

- The unknown sensors (`54:64:DE:12:C9:89`) in the logs are legitimate data from unclaimed sensors
- They will continue to appear in WebSocket messages but are now safely ignored
- If these sensors need to be tracked, they should be manually claimed through the UI
- The system is now optimized for high-frequency real-time data without memory issues
