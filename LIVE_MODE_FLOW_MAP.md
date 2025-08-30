# Live Mode Code Flow Map

## 🚀 Overview
This document provides a complete code flow map for how the live mode logic works in the IoT analytics platform, including state changes, logs, and UI loaders.

## 📋 Table of Contents
1. [Live Mode Components](#live-mode-components)
2. [State Flow Diagram](#state-flow-diagram)
3. [Code References](#code-references)
4. [Log Analysis](#log-analysis)
5. [Loader Behavior](#loader-behavior)
6. [Complete Scenarios](#complete-scenarios)

---

## 🧩 Live Mode Components

### Core Files
- **`analytics.tsx`** - Main analytics page with data fetching logic
- **`liveDataSlice.ts`** - Redux slice managing live connection state
- **`telemetrySlice.ts`** - Redux slice managing sensor data
- **`useLiveModeTransition.ts`** - Hook detecting mode changes
- **`useLiveDataReadiness.ts`** - Hook managing loading states
- **`useOptimizedDataFetch.ts`** - Hook for API data fetching

---

## 🔄 State Flow Diagram

```
Initial Page Load
       ↓
   [Analytics Component Mounts]
       ↓
   [Redux State: isLiveMode: false, isConnecting: false]
       ↓
   [useLiveModeTransition detects initial state]
       ↓
   [useLiveDataReadiness calculates loading state]
       ↓
   [Data fetching effect triggers]
       ↓
   [User clicks Live Mode Toggle]
       ↓
   [toggleLiveMode thunk dispatched]
       ↓
   [State: isConnecting: true, isLiveMode: false]
       ↓
   [initializeLiveConnection thunk]
       ↓
   [Fetch gateways → Start MQTT connection]
       ↓
   [State: isConnecting: false, isLiveMode: true]
       ↓
   [useLiveModeTransition detects transition]
       ↓
   [Live data starts arriving via MQTT]
       ↓
   [useLiveDataReadiness detects live data]
       ↓
   [Loading states resolve]
```

---

## 📝 Code References

### 1. Live Mode Toggle Action

**File**: `src/pages/analytics.tsx` (line ~1800+)
```tsx
// Live mode toggle button handler
const handleLiveModeToggle = () => {
  dispatch(toggleLiveMode({ enable: !isLiveMode }));
};
```

**Slice**: `src/store/liveDataSlice.ts` (lines 183-203)
```typescript
export const toggleLiveMode = createAsyncThunk(
  'liveData/toggleLiveMode',
  async ({ enable }: { enable: boolean }, { dispatch, getState }) => {
    const state = getState() as RootState;
    
    console.log('[ANALYTICS]: toggleLiveMode thunk triggered:', {
      enable,
      currentlyConnected: state.liveData.isConnected,
      currentLiveMode: state.liveData.isLiveMode
    });
    
    if (enable && !state.liveData.isConnected) {
      console.log('[ANALYTICS]: Enabling live mode - initializing connection');
      await dispatch(initializeLiveConnection());
    } else if (!enable && state.liveData.isConnected) {
      console.log('[ANALYTICS]: Disabling live mode - stopping connection');
      stopLive();
      dispatch(disconnectLive());
    }
    
    console.log('[ANALYTICS]: toggleLiveMode thunk completed:', { enable });
    return enable;
  }
);
```

### 2. Live Data Connection Initialization

**File**: `src/store/liveDataSlice.ts` (lines 49-168)
```typescript
export const initializeLiveConnection = createAsyncThunk(
  'liveData/initializeConnection',
  async (_, { dispatch, getState }) => {
    const state = getState() as RootState;
    const timestamp = Date.now();

    try {
      // First fetch all available gateways
      const gatewaysResponse = await dispatch(fetchGateways({ 
        page: 1, 
        limit: 100,
        search: '' 
      })).unwrap();

      const gatewayIds = gatewaysResponse.data.map((gateway: any) => gateway._id);
      
      // Start live connection with callbacks
      const callbacks: LiveCallbacks = {
        onData: (data) => {
          dispatch(addLiveData(data)); // Critical: Adds live data to telemetry
          // Update sensor last seen timestamps
        },
        onPresence: (topic, message) => {
          // Handle gateway presence updates
        },
        onError: (error) => {
          dispatch(setConnectionError(error.message));
        },
        onConnectionChange: (status) => {
          dispatch(setConnectionStatus(status));
        }
      };

      const startLiveResult = await startLive(gatewayIds, callbacks);
      return { gatewayIds, connected: true, timestamp };
    } catch (error) {
      return { gatewayIds: [], connected: false, timestamp, error: error.message };
    }
  }
);
```

### 3. Mode Transition Detection

**File**: `src/hooks/useLiveModeTransition.ts` (lines 18-44)
```typescript
useEffect(() => {
  const previousLiveMode = previousLiveModeRef.current;
  
  console.log('[ANALYTICS]: useLiveModeTransition useEffect triggered:', {
    previousLiveMode,
    currentLiveMode: isLiveMode,
    transitionDetected: previousLiveMode !== isLiveMode
  });
  
  if (previousLiveMode !== isLiveMode) {
    if (previousLiveMode && !isLiveMode) {
      console.log('[ANALYTICS]: TRANSITION DETECTED - Live to Offline mode');
      onLiveToOffline?.();
    } else if (!previousLiveMode && isLiveMode) {
      console.log('[ANALYTICS]: TRANSITION DETECTED - Offline to Live mode');
      onOfflineToLive?.();
    }
    
    previousLiveModeRef.current = isLiveMode;
  }
}, [isLiveMode, onLiveToOffline, onOfflineToLive]);
```

### 4. Live Data Readiness Logic

**File**: `src/hooks/useLiveDataReadiness.ts` (lines 154-178)
```typescript
// Determine what action to take
const shouldWaitForLiveData = shouldShowLoader;
const shouldFetchApiData = (!isLiveMode && !isConnecting) || // Not in live mode
                          isOfflineSensorFilter || // Filtering offline sensors
                          hasTimedOut || // Timed out waiting (4 seconds)
                          hasLiveData || // Already have live data
                          !sensorId || // No sensor selected
                          !shouldShowLoader; // Not currently waiting

const result = {
  shouldWaitForLiveData,
  hasReceivedLiveData: hasLiveData,
  shouldShowLoading: shouldShowLoader,
  shouldFetchApiData
};

console.log('[ANALYTICS]: useLiveDataReadiness result:', {
  ...result,
  factors: {
    isLiveMode,
    isConnecting,
    isOfflineSensorFilter,
    hasTimedOut,
    hasLiveData,
    sensorId: !!sensorId,
    shouldShowLoader
  }
});
```

### 5. Data Fetching Effect

**File**: `src/pages/analytics.tsx` (lines 664-764)
```typescript
React.useEffect(() => {
  console.log('[ANALYTICS]: Data fetching effect triggered:', {
    selectedSensor,
    timeRangeKey,
    isOfflineSensorFilter,
    isLiveMode,
    isConnecting,
    hasInitialLoadCompleted,
    lastTimeRangeRequest: lastTimeRangeRequestRef.current
  });

  if (!selectedSensor) {
    console.log('[ANALYTICS]: No selected sensor - skipping data fetch');
    return;
  }

  // Create request ID to prevent duplicates
  const currentRequest = `${selectedSensor}-${timeRangeKey}`;
  if (lastTimeRangeRequestRef.current === currentRequest) {
    console.log('[ANALYTICS]: Duplicate request detected - skipping:', currentRequest);
    return;
  }

  // Check if we should fetch API data based on live data readiness
  if (!liveDataReadiness.shouldFetchApiData) {
    console.log('[ANALYTICS]: shouldFetchApiData is false - skipping data fetch');
    return;
  }

  console.log('[ANALYTICS]: shouldFetchApiData is true - proceeding with data fetch');
  console.log('[ANALYTICS]: Calling fetchOptimizedData:', {
    selectedSensor,
    timeRange: { start: toISO(timeRangeToUse.start), end: toISO(timeRangeToUse.end) }
  });

  fetchOptimizedData({
    sensorIds: [selectedSensor],
    timeRange: { start: toISO(timeRangeToUse.start), end: toISO(timeRangeToUse.end) }
  });

}, [selectedSensor, timeRangeKey, isOfflineSensorFilter, isLiveMode, isConnecting, hasInitialLoadCompleted]);
```

---

## 📊 Log Analysis

### Expected Log Sequence When Enabling Live Mode

1. **User Clicks Live Toggle**
```
[ANALYTICS]: toggleLiveMode thunk triggered: {enable: true}
[ANALYTICS]: Enabling live mode - initializing connection
```

2. **Connection State Changes**
```
[ANALYTICS]: toggleLiveMode.pending - Setting connecting state
[ANALYTICS]: useLiveModeTransition - Current state: {isLiveMode: false, isConnecting: true}
```

3. **Gateway Fetching & MQTT Connection**
```
[ANALYTICS]: Fetching gateways for live connection
[ANALYTICS]: Starting live connection with gateway IDs: [...]
```

4. **Connection Success**
```
[ANALYTICS]: toggleLiveMode.fulfilled - Live mode updated: {newLiveModeState: true}
[ANALYTICS]: useLiveModeTransition useEffect triggered: {transitionDetected: true}
[ANALYTICS]: TRANSITION DETECTED - Offline to Live mode
```

5. **Live Data Arrival**
```
[ANALYTICS]: useLiveDataReadiness - hasLiveData check: {result: true, seriesLength: 100}
[ANALYTICS]: useLiveDataReadiness result: {shouldShowLoading: false, shouldFetchApiData: true}
```

### Key State Values to Monitor

- **`isLiveMode`**: Global live mode state (true/false)
- **`isConnecting`**: Connection in progress (true/false)
- **`liveSensorsCount`**: Number of sensors with live data
- **`shouldWaitForLiveData`**: Whether to show loading spinner
- **`shouldFetchApiData`**: Whether API calls are allowed
- **`hasReceivedLiveData`**: Whether live data has arrived for current sensor

---

## 🔄 Loader Behavior

### Loading States by Scenario

| Scenario | `isLoadingData` | `shouldShowLoading` | `effectiveIsLoading` | Visible Loader |
|----------|----------------|-------------------|-------------------|----------------|
| **Initial Page Load** | false | false | false | ❌ No |
| **Switching to Live Mode** | false | true | true | ✅ Yes |
| **Waiting for Live Data** | false | true | true | ✅ Yes |
| **Live Data Received** | false | false | false | ❌ No |
| **API Data Loading** | true | false | true | ✅ Yes |
| **Live Mode Stable** | false | false | false | ❌ No |

### Loader Component Usage

**File**: `src/pages/analytics.tsx` (lines 350-356)
```tsx
// Enhanced loading state that considers live data readiness
const effectiveIsLoading = isLoadingData || liveDataReadiness.shouldShowLoading;

console.log('[ANALYTICS]: Loading States:', {
  isLoadingData,
  'liveDataReadiness.shouldShowLoading': liveDataReadiness.shouldShowLoading,
  effectiveIsLoading,
  isConnecting
});
```

**Conditional Rendering**:
```tsx
{effectiveIsLoading && (
  <div className="flex items-center justify-center h-64">
    <LiveDataLoading isConnecting={isConnecting} />
  </div>
)}
```

---

## 🎯 Complete Scenarios

### Scenario 1: Enable Live Mode (Fresh Page Load)

**Initial State**:
```javascript
{
  isLiveMode: false,
  isConnecting: false,
  liveSensorsCount: 0,
  effectiveIsLoading: false
}
```

**User Action**: Click Live Mode Toggle

**State Progression**:
1. **Connecting State**
   ```javascript
   {
     isLiveMode: false,
     isConnecting: true,
     shouldShowLoading: true,
     effectiveIsLoading: true
   }
   ```
   **UI**: Shows "Connecting to live data..." loader

2. **Connected State**
   ```javascript
   {
     isLiveMode: true,
     isConnecting: false,
     shouldShowLoading: true, // Still waiting for data
     effectiveIsLoading: true
   }
   ```
   **UI**: Shows "Waiting for live data..." loader

3. **Live Data Received**
   ```javascript
   {
     isLiveMode: true,
     isConnecting: false,
     liveSensorsCount: 1,
     hasReceivedLiveData: true,
     shouldShowLoading: false,
     effectiveIsLoading: false
   }
   ```
   **UI**: Shows live chart with real-time data

**Expected Logs**:
```
[ANALYTICS]: toggleLiveMode thunk triggered: {enable: true}
[ANALYTICS]: toggleLiveMode.pending - Setting connecting state
[ANALYTICS]: useLiveModeTransition useEffect triggered: {transitionDetected: true}
[ANALYTICS]: TRANSITION DETECTED - Offline to Live mode
[ANALYTICS]: useLiveDataReadiness result: {shouldShowLoading: true}
[ANALYTICS]: hasLiveData check: {result: true, seriesLength: 100}
[ANALYTICS]: useLiveDataReadiness result: {shouldShowLoading: false}
```

### Scenario 2: Disable Live Mode

**Initial State**:
```javascript
{
  isLiveMode: true,
  isConnecting: false,
  liveSensorsCount: 1,
  effectiveIsLoading: false
}
```

**User Action**: Click Live Mode Toggle (to disable)

**State Progression**:
1. **Disconnecting**
   ```javascript
   {
     isLiveMode: false,
     isConnecting: false,
     shouldFetchApiData: true,
     effectiveIsLoading: true // API data loading
   }
   ```
   **UI**: Shows API data loading spinner

2. **API Data Loaded**
   ```javascript
   {
     isLiveMode: false,
     isConnecting: false,
     isLoadingData: false,
     effectiveIsLoading: false
   }
   ```
   **UI**: Shows historical chart data

**Expected Logs**:
```
[ANALYTICS]: toggleLiveMode thunk triggered: {enable: false}
[ANALYTICS]: Disabling live mode - stopping connection
[ANALYTICS]: TRANSITION DETECTED - Live to Offline mode
[ANALYTICS]: Offline to Live transition triggered
[ANALYTICS]: Fetching fresh data for comparison sensors in offline mode
```

### Scenario 3: Sensor Selection Change in Live Mode

**Initial State**: Live mode active with Sensor A selected

**User Action**: Select Sensor B

**State Progression**:
1. **Sensor Change Detected**
   ```javascript
   {
     selectedSensor: 'sensor-b-id',
     hasReceivedLiveData: false,
     shouldShowLoading: true
   }
   ```
   **UI**: Shows "Waiting for live data for Sensor B..." loader

2. **Live Data Arrives for Sensor B**
   ```javascript
   {
     selectedSensor: 'sensor-b-id',
     hasReceivedLiveData: true,
     shouldShowLoading: false
   }
   ```
   **UI**: Shows Sensor B live chart

**Expected Logs**:
```
[ANALYTICS]: Sensor change detected: {newSensorId: 'sensor-b-id', changed: true}
[ANALYTICS]: Resetting live data readiness state for new sensor
[ANALYTICS]: useLiveDataReadiness result: {shouldShowLoading: true}
[ANALYTICS]: hasLiveData check: {result: true, seriesLength: 50}
[ANALYTICS]: useLiveDataReadiness result: {shouldShowLoading: false}
```

---

## 🎛️ Redux State Structure

### liveDataSlice State
```typescript
interface LiveDataState {
  isConnected: boolean;        // MQTT connection status
  isConnecting: boolean;       // Connection in progress
  error: string | null;        // Connection errors
  connectedGateways: string[]; // List of connected gateway IDs
  gatewayPresence: Record<string, boolean>; // Gateway online status
  autoConnect: boolean;        // Auto-connect preference
  isLiveMode: boolean;         // Global live mode status
  lastConnectionAttempt: number | null; // Timestamp of last attempt
}
```

### telemetrySlice State (Live Data)
```typescript
// When live data arrives, it's stored as:
telemetryData[sensorId] = {
  series: [...], // Array of data points
  isLive: true,  // Indicates live data
  lastUpdated: timestamp
}
```

---

## 🔧 Debugging Tips

### 1. Check Console Logs
Look for `[ANALYTICS]:` prefixed logs to trace the flow:
- Toggle actions and state changes
- Transition detections
- Loading state calculations
- Data fetching decisions

### 2. Monitor Redux DevTools
Watch these state changes:
- `liveData.isLiveMode`
- `liveData.isConnecting`
- `telemetry.data[sensorId].isLive`
- `sensors.selectedSensorIds`

### 3. Network Tab
Monitor these requests:
- Gateway fetch: `/api/gateways`
- Sensor data: `/api/sensors/{id}/telemetry`
- WebSocket connections to MQTT broker

### 4. Performance Monitoring
Watch for:
- Excessive re-renders in React DevTools
- Memory leaks from uncleaned timeouts
- High-frequency data updates causing UI lag

---

This complete map shows exactly how the live mode system works, what state changes occur, what logs to expect, and how the UI responds in each scenario.
