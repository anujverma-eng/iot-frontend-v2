# Settings and Offline Detection Implementation

## Overview

This implementation adds a comprehensive settings system and offline detection functionality to the IoT platform. Users can now configure how long to wait before marking sensors as offline, and the system intelligently manages sensor online/offline status based on real-time data reception and gateway connectivity.

## 🏗️ Implementation Components

### 1. Settings Page (`/dashboard/settings`)

**Location**: `src/pages/settings.tsx`

- **Modern Hero UI Design**: Clean, responsive interface with breadcrumbs and organized sections
- **Sensor Offline Timeout**: Configurable options (5min, 10min, 30min, 1hr, 5hr)
- **Real-time Updates**: Settings applied immediately without page refresh
- **Future-ready**: Structure prepared for additional settings categories

**Key Features**:
- Immediate settings persistence to localStorage
- Redux integration for app-wide settings access
- Visual feedback for configuration changes
- Responsive design for mobile/desktop

### 2. Settings Store Management (`settingsSlice.ts`)

**Location**: `src/store/settingsSlice.ts`

- **Redux Toolkit**: Modern state management with actions and selectors
- **Persistent Storage**: Automatic localStorage synchronization
- **Type Safety**: Full TypeScript interfaces for all settings
- **Default Values**: Sensible defaults (5 minutes timeout)

**Actions**:
- `loadSettings()`: Initialize from localStorage
- `updateSensorSettings()`: Update sensor-specific settings
- `resetSettings()`: Reset to defaults

### 3. Offline Detection Service (`offlineDetectionService.ts`)

**Location**: `src/services/offlineDetectionService.ts`

**Core Business Logic**:
- **Timeout-based Detection**: Mark sensors offline after user-defined period
- **Gateway Dependency Tracking**: Handle gateway offline scenarios
- **Real-time Updates**: Immediate status changes via Redux
- **Memory Management**: Efficient timeout handling and cleanup

**Key Methods**:
- `updateSensorLastSeen()`: Update sensor activity timestamp
- `updateGatewayStatus()`: Handle gateway online/offline events
- `updateTimeoutSettings()`: Apply new timeout configurations
- `handleGatewayOffline()`: Intelligent sensor status management

### 4. Enhanced Sensor Interface

**Location**: `src/types/sensor.ts`

**New Field**:
```typescript
export interface Sensor {
  // ... existing fields
  isOnline?: boolean; // Online/offline status based on detection logic
}
```

### 5. Sensor State Management Updates

**Location**: `src/store/sensorsSlice.ts`

**New Action**:
- `updateSensorOnlineStatus()`: Update sensor online/offline status

**Integration**:
- Seamless integration with existing sensor data
- Maintains backward compatibility
- Efficient state updates

## 🔄 Data Flow

### Real-time Data Reception
```
MQTT Socket → liveDataSlice → offlineDetectionService.updateSensorLastSeen()
                            ↓
                     Sets timeout timer → sensorsSlice.updateSensorOnlineStatus()
```

### Gateway Status Changes
```
Gateway Offline → liveDataSlice → offlineDetectionService.updateGatewayStatus()
                                ↓
                         Evaluates sensor dependencies → Mark dependent sensors offline
```

### Settings Changes
```
Settings Page → settingsSlice.updateSensorSettings() → offlineDetectionService.updateTimeoutSettings()
                                                     ↓
                                              Re-evaluate all sensor timeouts
```

## 📋 Business Logic Implementation

### Sensor Offline Detection Rules

1. **Timeout-based Detection**:
   - User selects timeout (5min, 10min, 30min, 1hr, 5hr)
   - Service tracks last data reception for each sensor
   - Sensor marked offline if no data received within timeout period

2. **Gateway Dependency Logic**:
   - If gateway goes offline → check affected sensors
   - Sensor with single gateway dependency → immediate offline
   - Sensor with multiple gateways → offline only if ALL gateways offline
   - Takes precedence over timeout-based detection

3. **Real-time Status Updates**:
   - Immediate online status when data received
   - Redux state updates trigger UI refresh
   - Consistent status across all components

### Integration Points

- **Live Data Stream**: Automatic sensor activity tracking
- **Gateway Status**: Real-time presence monitoring
- **Settings Changes**: Dynamic timeout reconfiguration
- **UI Components**: Consistent status display

## 🚀 Usage

### Accessing Settings
1. Click profile dropdown in dashboard navbar
2. Select "Settings" option
3. Navigate to `/dashboard/settings`

### Configuring Sensor Timeouts
1. Go to Settings page
2. Select desired timeout from "Offline Detection" dropdown
3. Settings applied immediately
4. All sensors re-evaluated with new timeout

### Monitoring Status
- Sensor cards show real-time online/offline status
- Status updates automatically based on data reception
- Gateway offline events immediately affect dependent sensors

## 🛡️ Error Handling & Edge Cases

### Robust Service Management
- **Initialization Safety**: Service initializes only once
- **Memory Cleanup**: Automatic timeout clearing on unmount
- **Error Recovery**: Graceful handling of localStorage failures
- **Service Restart**: Proper cleanup and re-initialization

### Data Consistency
- **State Synchronization**: Redux and service state always in sync
- **Timeout Management**: Efficient timer cleanup prevents memory leaks
- **Settings Persistence**: Fallback to defaults if localStorage fails

## 🔧 Technical Details

### Performance Optimizations
- **Efficient Timeout Handling**: Single timer per sensor
- **Selective Updates**: Only update sensors with actual changes
- **Memory Management**: Automatic cleanup of inactive sensors
- **Throttled Updates**: Prevent excessive state updates

### Type Safety
- Full TypeScript coverage
- Strongly typed Redux actions
- Interface definitions for all data structures
- Compile-time error prevention

## 🧪 Testing Scenarios

### Basic Functionality
1. **Settings Persistence**: Change timeout → reload page → verify setting maintained
2. **Immediate Application**: Change setting → verify sensors re-evaluated immediately
3. **Default Reset**: Reset settings → verify 5-minute default applied

### Offline Detection
1. **Timeout Detection**: Stop sensor data → verify offline after configured timeout
2. **Gateway Offline**: Disconnect gateway → verify dependent sensors offline immediately
3. **Multi-gateway Sensors**: Test partial gateway failures

### Edge Cases
1. **Rapid Setting Changes**: Multiple quick changes → verify stable final state
2. **Service Restart**: Page refresh during operation → verify proper re-initialization
3. **Memory Management**: Long operation → verify no memory leaks

## 📈 Future Enhancements

### Planned Features
- **Notification Settings**: Email/SMS alerts for offline sensors
- **Appearance Settings**: Theme, color, display preferences
- **Advanced Timeouts**: Per-sensor custom timeout configurations
- **Historical Tracking**: Offline duration analytics

### API Integration
- **Backend Settings**: Move from localStorage to user profile API
- **Sensor Configuration**: Per-sensor settings storage
- **Audit Trail**: Settings change history

## ✅ Implementation Status

**Completed Features**:
- ✅ Settings page with Hero UI design
- ✅ Redux-based settings management
- ✅ Offline detection service
- ✅ Real-time timeout application
- ✅ Gateway dependency logic
- ✅ Settings navigation integration
- ✅ TypeScript interfaces and type safety
- ✅ localStorage persistence
- ✅ Service initialization and cleanup

**All Components Working**:
- ✅ Settings page accessible via dashboard navbar
- ✅ Timeout configuration with immediate effect
- ✅ Sensor online/offline status tracking
- ✅ Gateway offline detection integration
- ✅ Redux state management integration
- ✅ No TypeScript compilation errors

The implementation is now complete and ready for production use! 🎉
