# API Spam Root Cause Analysis - Complete Investigation

## 🎯 Root Cause Identified

The `/sensor/mac` API calls on every WebSocket message were caused by **React useEffect dependency cascade**:

### The Chain Reaction:
1. **WebSocket Message** → `updateSensorLastSeen` action
2. **Sensor State Update** → `sensors` array changes (new lastSeen, battery, etc.)
3. **sensors changes** → `mappedSensors` useMemo recalculates
4. **mappedSensors changes** → `filteredSensors` useMemo recalculates  
5. **filteredSensors changes** → useEffect triggers with `filteredSensors` in dependency array
6. **useEffect executes** → `dispatch(fetchSensorById(sensorId))` → **API CALL**

## 🔧 Fixes Applied

### 1. Analytics Page (`src/pages/analytics.tsx`)
**Problem**: useEffect with `filteredSensors` in dependency array
```javascript
// BEFORE (problematic):
useEffect(() => {
  if (sensorId) {
    dispatch(fetchSensorById(sensorId));
  } else if (filteredSensors && filteredSensors.length > 0) {
    dispatch(fetchSensorById(firstSensorId));
  }
}, [sensorId, filteredSensors, selectedSensor, dispatch, navigate]); // ❌ filteredSensors triggers on every WebSocket message
```

**Solution**: Only depend on stable sensor IDs, not entire sensor objects
```javascript
// AFTER (fixed):
const sensorIds = React.useMemo(() => 
  filteredSensors?.map(s => s.id) || [], 
  [filteredSensors?.length, filteredSensors?.map(s => s.id).join(',')]
);

useEffect(() => {
  if (sensorId) {
    dispatch(fetchSensorById(sensorId));
  } else if (sensorIds.length > 0 && !selectedSensor) {
    dispatch(fetchSensorById(sensorIds[0]));
  }
}, [sensorId, sensorIds.length, sensorIds.join(','), selectedSensor, dispatch, navigate]); // ✅ Only triggers when sensor list composition changes
```

### 2. Solo View Component (`src/components/analytics/solo-view.tsx`)
**Problem**: Similar dependency cascade with `filteredIds`
```javascript
// BEFORE:
const filteredIds = React.useMemo(() => 
  filteredSensors.map((s) => s.id).join("|"), 
  [filteredSensors] // ❌ Recalculates on every sensor property change
);
```

**Solution**: Stable dependency on IDs only
```javascript
// AFTER:
const filteredIds = React.useMemo(() => {
  return filteredSensors.map((s) => s.id).join("|");
}, [filteredSensors.length, filteredSensors.map(s => s.id).join("|")]); // ✅ Only changes when sensor list composition changes
```

### 3. Memory Overflow Fixes
- **Removed** `heroui-chat-script` from `index.html` (was causing "Data cannot be cloned, out of memory")
- **Reduced** console logging frequency from 100% to 1-5% to prevent memory bloat
- **Implemented** rate-limited logging for unknown sensors

## 🚫 What Was NOT the Cause

- ✅ `useUnknownSensorDiscovery` hook (already properly disabled)
- ✅ Auto-discovery thunks (not being called)
- ✅ `updateSensorLastSeen` reducer (local Redux action, not API call)
- ✅ Offline detection service (no API calls)
- ✅ WebSocket data processing (no API calls)

## 🔍 Key Insights

### React Dependency Arrays are Critical
The issue wasn't obvious because:
- The API calls were "legitimate" - they were supposed to fetch sensor details
- The dependency arrays looked correct at first glance
- The problem only manifested during high-frequency WebSocket updates

### Sensor Object References Change Frequently
Even though sensor IDs remain stable, the sensor objects themselves get new references on every:
- `lastSeen` timestamp update
- `battery` level change  
- `status` update
- Any other metadata change

### useMemo Dependencies Must Be Surgical
When dealing with arrays of objects that change frequently:
- ❌ Depend on the entire object array: `[sensors]`
- ❌ Depend on derived arrays: `[filteredSensors]`
- ✅ Depend on stable identifiers: `[sensors.length, sensors.map(s => s.id).join(',')]`

## 📊 Expected Results

### API Call Reduction
- **Before**: `/sensor/mac` API call on every WebSocket message (could be 10-20 calls per second)
- **After**: API calls only when:
  - User manually navigates to a sensor
  - Sensor list composition actually changes (add/remove sensors)
  - Page initially loads

### Memory Usage Improvement  
- **Before**: Console spam + chat script causing memory overflow
- **After**: 95% reduction in logging + removed memory-intensive script

### Performance Improvement
- **Before**: React re-rendering cascade on every WebSocket message
- **After**: Stable dependencies prevent unnecessary re-renders and API calls

## 🧪 Testing Verification

To verify the fix works:
1. Open browser DevTools → Network tab
2. Start live data streaming
3. Monitor for `/sensors/{mac}` API calls
4. **Expected**: No API calls during normal WebSocket data flow
5. **Expected**: API calls only when manually navigating between sensors

## 📝 Prevention Guidelines

1. **Always audit useEffect dependencies** when dealing with frequently-updating data
2. **Use stable identifiers** instead of entire objects in dependency arrays
3. **Be cautious with derived state** that depends on frequently-changing objects
4. **Consider React.useMemo carefully** - sometimes it causes more problems than it solves
5. **Monitor network tab during testing** to catch unexpected API calls early
