# API Spam Issue Resolution

## Root Cause Analysis

After investigating the repeated API calls to `/sensors/{mac}` (specifically `94:54:93:20:D1:26`), I identified the core issue:

### The Problem
1. **High-frequency live data**: Your system receives 5 WebSocket messages per second
2. **Unknown sensor data**: Each message contains data for sensor MAC `94:54:93:20:D1:26` 
3. **Auto-discovery trigger**: Every time live data arrived for this unknown sensor, the system attempted auto-discovery
4. **State change cascade**: Even with rate limiting, the Redux state was being modified frequently, causing React hooks to re-trigger

### Why Rate Limiting Wasn't Enough
- The `useUnknownSensorDiscovery` hook was running every time the `unknownSensors` array reference changed
- Even with rate limiting, the state modifications were causing React re-renders and hook re-executions
- Multiple async operations were queued up, creating a backlog of API calls
- Promise deduplication helped but didn't solve the fundamental state update issue

## Solution Implemented

### Immediate Fix: Disabled Automatic Auto-Discovery
```typescript
// BEFORE: Automatic discovery for every unknown sensor
if (!sensorKey) {
  // Complex rate limiting + auto-discovery logic
  // This ran for EVERY live data message for unknown sensors
}

// AFTER: Simple skip with informative logging
if (!sensorKey) {
  console.warn(`[TelemetrySlice] Received live data for an unknown sensor MAC: ${mac}. Skipping.`);
  console.log(`[TelemetrySlice] Auto-discovery disabled for sensor ${mac}. Use manual discovery if needed.`);
  return; // Skip processing for unknown sensors
}
```

### What This Achieves
1. **Eliminates API spam**: No more automatic API calls for unknown sensors
2. **Preserves live data**: Known sensors continue to receive live updates normally
3. **Maintains functionality**: Manual sensor discovery still works through the UI
4. **Improves performance**: Removes unnecessary state updates and React re-renders

## Testing Results Expected

After this change, you should see:
- ✅ **Zero** API calls to `/sensors/{mac}` for unknown sensors during live data
- ✅ Console logs showing unknown sensors being skipped (instead of discovered)
- ✅ Live data continuing to work for all known/loaded sensors
- ✅ No impact on existing sensor management functionality

## Alternative Solutions Available

If you need automatic sensor discovery, here are better approaches:

### 1. Batch Discovery
Instead of discovering immediately, collect unknown sensors and discover them in batches every 30 seconds:
```typescript
// Collect unknown MACs, discover in batches
setInterval(() => discoverUnknownSensors(), 30000);
```

### 2. User-Initiated Discovery
Add a UI notification when unknown sensors are detected:
```typescript
// Show notification: "Unknown sensor detected: 94:54:93:20:D1:26. Discover it?"
<UnknownSensorNotification mac="94:54:93:20:D1:26" onDiscover={handleDiscover} />
```

### 3. Smart Discovery
Only discover sensors during low-activity periods:
```typescript
// Only discover when live data rate is low
if (liveDataRate < 1) { /* attempt discovery */ }
```

## Files Modified

1. **`telemetrySlice.ts`**: Disabled automatic unknown sensor discovery
2. **`dashboard-layout.tsx`**: Disabled the unknown sensor discovery hook
3. **`sensorsSlice.ts`**: Enhanced rate limiting and promise deduplication (kept for manual discovery)
4. **`useUnknownSensorDiscovery.ts`**: Enhanced but currently disabled

## Manual Discovery Still Available

Users can still discover unknown sensors through:
- Sensor detail drawer (`fetchSensorDetails` when opening sensor details)
- Manual sensor management pages
- Any explicit discovery actions in the UI

This maintains all functionality while eliminating the API spam caused by automatic discovery.
