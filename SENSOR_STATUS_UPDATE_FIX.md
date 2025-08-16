# Sensor Status Update Fix

## Problem Analysis
The offline detection service was working correctly and updating Redux state, but the sensor cards were not re-rendering to show the updated status. This was causing two main issues:

1. **Sensor cards not updating**: Status indicators (LIVE/OFFLINE) remained static
2. **Stats not updating**: "Live Sensors" and "Offline Sensors" counts weren't refreshing

## Root Cause
The `SensorCard` component was wrapped with `React.memo()`, which prevents re-rendering when props have the same reference. Since Redux updates sensor properties in-place using Immer, the sensor object reference doesn't change, causing the memoized component to skip re-renders.

## Solutions Implemented

### 1. Fixed Component Re-rendering
**File**: `src/components/analytics/sensor-card.tsx`
- **Change**: Removed `React.memo()` wrapper from `SensorCard` component
- **Reason**: Allows component to re-render when sensor status properties change
- **Impact**: Sensor cards now properly show real-time status updates

### 2. Fixed Redux Action Dispatching
**File**: `src/services/offlineDetectionService.ts`
- **Change**: Import and use proper action creator `updateSensorOnlineStatus`
- **Before**: `dispatch({ type: 'sensors/updateSensorOnlineStatus', payload: { mac, isOnline: false } })`
- **After**: `dispatch(updateSensorOnlineStatus({ mac, isOnline: false }))`
- **Impact**: Ensures Redux actions are properly typed and dispatched

### 3. Improved Service Initialization
**File**: `src/App.tsx`
- **Change**: Initialize offline detection service with fallback timeout value
- **Before**: Only initialized when `offlineTimeout` was truthy
- **After**: Always initializes with default 10-minute timeout if settings not loaded
- **Impact**: Service works immediately on app startup

## What's Working Now

### ✅ Visual Status Indicators
- Sensor cards show colored status dots (green/red with pulse animation)
- "LIVE"/"OFFLINE" text updates in real-time
- Mobile-responsive badges for better visibility

### ✅ Real-time Stats Updates
- "Live Sensors" count updates when sensors go online/offline
- "Offline Sensors" count reflects current offline status
- Stats selector properly counts based on both `status` and `isOnline` fields

### ✅ Timeout Configuration
- Settings page allows changing timeout (1 min - 5 hours)
- Changes apply immediately to all monitoring
- Service properly re-evaluates all sensors with new timeout

## Testing Instructions

### 1. Test Offline Detection
1. Go to Settings page
2. Set timeout to "1 minute" 
3. Go to Analytics page
4. Watch sensor cards - they should show status updates after 1 minute of no data

### 2. Test Status Indicators
- **Green dot + "LIVE"**: Sensor receiving data
- **Red dot + "OFFLINE"**: Sensor timed out or gateway disconnected
- **Pulse animation**: Indicates active status

### 3. Test Stats Updates
- Watch "Live Sensors" and "Offline Sensors" counts in analytics header
- Numbers should change when sensors go online/offline
- Counts should match visual indicators on sensor cards

### 4. Test Settings Changes
1. Change timeout in Settings
2. Go back to Analytics
3. Existing timers should reset with new timeout value

## Technical Details

### Redux State Flow
```
Offline Detection Service → updateSensorOnlineStatus → Redux State → Component Re-render
```

### Status Logic
```javascript
// A sensor is considered ONLINE if:
sensor.status === "live" || sensor.isOnline === true

// A sensor is considered OFFLINE if:
sensor.status === "offline" || sensor.isOnline === false
```

### Performance Impact
- Removed `React.memo` may cause more frequent re-renders
- Impact is minimal since sensor cards only re-render when Redux state changes
- UI remains responsive with proper loading states

## Verification Logs
Look for these console messages to verify the fix is working:

```
[SensorsSlice] Updated sensor 94:54:93:20:D1:26 online status: offline
[OfflineDetection] Marked sensor 94:54:93:20:D1:26 offline due to timeout (1min)
```

The implementation is now complete with proper visual feedback and real-time updates! 🎉
