# Root Cause Found and Fixed: API Spam from useEffect Cascade

## 🔍 Root Cause Analysis

The repeated API calls to `/sensors/{mac}` were caused by a **React useEffect cascade** triggered by live data updates:

### The Problem Chain:
1. **WebSocket Message Arrives** (5 times per second)
2. **`dispatch(updateSensorLastSeen())`** called in telemetry slice
3. **`selectedSensor.data` object modified** (lastSeen, status updated)
4. **React detects object reference change** in solo-view component
5. **useEffect with `selectedSensorData.data?._id` dependency triggers**
6. **`dispatch(fetchSensorById(sensorId))` called repeatedly**

### The Specific Code Path:
```typescript
// telemetrySlice.ts - Called for every live message
data.sensors.forEach(reading => {
  dispatch(updateSensorLastSeen({ 
    mac: reading.mac, 
    lastSeen: now 
  }));
});

// sensorsSlice.ts - Updates selectedSensor object
updateSensorLastSeen: (state, action) => {
  if (state.selectedSensor.data && state.selectedSensor.data.mac === mac) {
    state.selectedSensor.data.lastSeen = lastSeen;  // ← Object reference changes
    state.selectedSensor.data.status = "live";     // ← Triggers React re-render
  }
}

// solo-view.tsx - useEffect triggered by object change
React.useEffect(() => {
  if (selectedSensorData.data?._id !== sensorId) {
    dispatch(fetchSensorById(sensorId)); // ← API call every time!
  }
}, [selectedSensorData.data?._id]); // ← This dependency changes on every lastSeen update
```

## ✅ Solution Implemented

### 1. **Stable Selector Approach**
Created stable selectors that only change when the actual sensor ID changes, not metadata:

```typescript
// New stable selectors in sensorsSlice.ts
export const selectSelectedSensorId = (state: RootState) => 
  state.sensors.selectedSensor.data?._id;

export const selectIsSensorLoaded = (sensorId: string) => (state: RootState) => 
  state.sensors.selectedSensor.data?._id === sensorId;
```

### 2. **Optimized useEffect Dependencies**
Updated solo-view to use stable sensor ID instead of full object:

```typescript
// BEFORE: Triggers on every lastSeen/status update
}, [selectedSensorData.data?._id]); 

// AFTER: Only triggers when actual sensor ID changes
}, [selectedSensorId]);
```

### 3. **Improved Conditional Logic**
Added better checks to prevent unnecessary API calls:

```typescript
// Only fetch if we don't have the sensor OR if ID is different
if (!selectedSensorId || selectedSensorId !== sensorId) {
  console.log('[SoloView] Fetching sensor by ID:', sensorId);
  dispatch(fetchSensorById(sensorId));
} else {
  console.log('[SoloView] Sensor already loaded, skipping fetch');
}
```

## 🎯 Expected Results

After this fix, you should see:

- ✅ **Zero repeated API calls** to `/sensors/{mac}` during live data
- ✅ **Console logs showing "Sensor already loaded, skipping fetch"** instead of fetch attempts
- ✅ **Live data continues to work** with real-time lastSeen/status updates
- ✅ **No impact on functionality** - sensor details still load when needed

## 🧪 Testing Validation

The fix addresses the core issue where:
- **Live data metadata updates** (lastSeen, status) no longer trigger sensor fetches
- **Only actual sensor selection changes** trigger the fetchSensorById API call
- **Object reference stability** prevents unnecessary React useEffect cascades

## 📝 Files Modified

1. **`sensorsSlice.ts`**: Added stable selectors (`selectSelectedSensorId`)
2. **`solo-view.tsx`**: Updated useEffect dependencies and logic to use stable selectors
3. **Import statements**: Added `selectSelectedSensorId` import

This fix eliminates the API spam while preserving all live data functionality and sensor management features.
