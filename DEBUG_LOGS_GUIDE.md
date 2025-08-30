# Debug Logs Guide for Analytics Live Mode Issues

## Overview
Added comprehensive debug logging with `[ANALYTICS]:` prefix to track live mode transitions, loading states, and data fetching behavior across the analytics system.

## Debug Log Locations

### 1. `useLiveModeTransition.ts` Hook
**Purpose**: Track live/offline mode transitions and callback execution

**Logs Added**:
- Initial state logging (live mode, previous mode, callback presence)
- useEffect trigger detection with transition details
- Explicit transition detection logs:
  - `[ANALYTICS]: TRANSITION DETECTED - Live to Offline mode`
  - `[ANALYTICS]: TRANSITION DETECTED - Offline to Live mode`

### 2. `analytics.tsx` Page Component
**Purpose**: Main analytics page state tracking and loader conditions

**Logs Added**:
- **State Overview**: Live mode status, connection state, sensor counts, loading state
- **Transition Callbacks**: Detailed logging when live-to-offline and offline-to-live transitions occur
- **Live Data Readiness**: Full state object with conditions
- **Loading States**: Which type of loader is being shown and why
- **Fallback States**: When no chart config or sensor is available

**Key Log Examples**:
```javascript
[ANALYTICS]: Analytics Page State: {
  isLiveMode, isConnecting, liveSensorsCount, maxLiveReadings,
  selectedSensorIds, isLoadingData, telemetryDataKeys, isSoloMode
}

[ANALYTICS]: Live to Offline transition triggered
[ANALYTICS]: Rendering Loading State: { isLiveMode, shouldWaitForLiveData }
[ANALYTICS]: Showing LiveDataLoading component
[ANALYTICS]: Showing regular Spinner
```

### 3. `telemetrySlice.ts` Redux Slice
**Purpose**: Track data fetching, API calls, and Redux state updates

**Logs Added**:
- **fetchTelemetry Thunk**: 
  - Start parameters (sensor IDs, time range)
  - Bucket size calculation
  - API response details (sensor count, data points)
  - Success/error states
- **Redux Reducers**:
  - Pending state (loading = true)
  - Fulfilled state (data processing)
  - Rejected state (error handling)
  - Empty response handling

**Key Log Examples**:
```javascript
[ANALYTICS]: fetchTelemetry thunk started: { sensorIds, timeRange, timestamp }
[ANALYTICS]: TelemetryService.query response: { responseLength, sensorIds, dataPointsPerSensor }
[ANALYTICS]: fetchTelemetry.fulfilled - Processing response: { payloadKeys, requestedSensorIds }
[ANALYTICS]: Empty response - clearing data for requested sensors
```

### 4. `liveDataSlice.ts` Redux Slice  
**Purpose**: Track live connection management and mode toggling

**Logs Added**:
- **toggleLiveMode Thunk**:
  - Trigger conditions (enable/disable, current state)
  - Connection initialization/termination
  - Completion status
- **Redux Reducers**:
  - Pending, fulfilled, rejected states
  - Live mode state updates

**Key Log Examples**:
```javascript
[ANALYTICS]: toggleLiveMode thunk triggered: { enable, currentlyConnected, currentLiveMode }
[ANALYTICS]: Enabling live mode - initializing connection
[ANALYTICS]: Disabling live mode - stopping connection
[ANALYTICS]: toggleLiveMode.fulfilled - Live mode updated: { newLiveModeState }
```

### 5. `useOptimizedDataFetch.ts` Hook
**Purpose**: Track optimized data fetching with throttling and cancellation

**Logs Added**:
- **Request Initiation**: Parameters, immediate flag, duplicate detection
- **Request Execution**: Abort controller management, throttling behavior
- **Cancellation**: Pending request cleanup

**Key Log Examples**:
```javascript
[ANALYTICS]: useOptimizedDataFetch.fetchData called: { sensorIds, timeRange, immediate, requestId }
[ANALYTICS]: Skipping duplicate request
[ANALYTICS]: Executing fetch request: { requestId, requestInProgress, hasAbortController }
[ANALYTICS]: Dispatching fetchTelemetry action
[ANALYTICS]: Throttling fetch by 200ms
```

### 6. `useLiveDataReadiness.ts` Hook
**Purpose**: Track live data waiting logic and loader decisions

**Logs Added**:
- **Hook Initialization**: Parameters and selector values
- **Live Data Detection**: Data availability checks
- **State Changes**: Sensor changes, timeout management
- **Decision Logic**: Final return values and contributing factors

**Key Log Examples**:
```javascript
[ANALYTICS]: useLiveDataReadiness called: { sensorId, isOfflineSensorFilter }
[ANALYTICS]: hasLiveData check: { sensorId, hasDataForSensor, isLive, seriesLength, result }
[ANALYTICS]: Sensor change detected: { currentSensorId, newSensorId, changed }
[ANALYTICS]: useLiveDataReadiness result: { shouldWaitForLiveData, shouldShowLoading, factors }
```

## How to Use These Logs

### 1. **Monitor Live Mode Transitions**
Look for transition logs to see when mode changes occur:
```
[ANALYTICS]: TRANSITION DETECTED - Live to Offline mode
[ANALYTICS]: Live to Offline transition triggered
```

### 2. **Track Data Fetching**
Follow the complete data flow:
```
[ANALYTICS]: useOptimizedDataFetch.fetchData called
[ANALYTICS]: fetchTelemetry thunk started
[ANALYTICS]: TelemetryService.query response
[ANALYTICS]: fetchTelemetry.fulfilled - Processing response
```

### 3. **Understand Loading States**
See which loader is shown and why:
```
[ANALYTICS]: Live Data Readiness State
[ANALYTICS]: Loading States
[ANALYTICS]: Rendering Loading State
[ANALYTICS]: Showing LiveDataLoading component / regular Spinner
```

### 4. **Debug Issues**
- **Stale Data**: Check if transitions trigger fresh data fetches
- **Loading Loops**: Monitor loading state changes and timeouts
- **Mode Switching**: Verify live/offline transitions work correctly
- **Data Refresh**: Confirm API calls happen when expected

## Debug Flow for Common Scenarios

### Scenario 1: User Enables Live Mode
1. `[ANALYTICS]: toggleLiveMode thunk triggered: { enable: true }`
2. `[ANALYTICS]: Enabling live mode - initializing connection`
3. `[ANALYTICS]: TRANSITION DETECTED - Offline to Live mode`
4. `[ANALYTICS]: useLiveDataReadiness` shows waiting state
5. `[ANALYTICS]: Showing LiveDataLoading component`

### Scenario 2: User Disables Live Mode  
1. `[ANALYTICS]: toggleLiveMode thunk triggered: { enable: false }`
2. `[ANALYTICS]: Disabling live mode - stopping connection`
3. `[ANALYTICS]: TRANSITION DETECTED - Live to Offline mode`
4. `[ANALYTICS]: Live to Offline transition triggered`
5. `[ANALYTICS]: useOptimizedDataFetch.fetchData called` (fresh data)
6. `[ANALYTICS]: fetchTelemetry thunk started`

### Scenario 3: Data Loading Issues
1. Check `[ANALYTICS]: Analytics Page State` for overall context
2. Look at `[ANALYTICS]: Live Data Readiness State` for loading decisions
3. Follow `[ANALYTICS]: fetchTelemetry` logs for API behavior
4. Monitor `[ANALYTICS]: Loading States` for UI state

All logs include contextual data to help diagnose specific issues. Open browser console and filter by `[ANALYTICS]:` to see the complete flow.
