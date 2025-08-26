import { Sensor } from '../types/sensor';
import { updateSensorOnlineStatus } from '../store/sensorsSlice';
import { SensorService } from '../api/sensor.service';

// Interface for tracking sensor last seen times
interface SensorLastSeenTracker {
  [mac: string]: {
    lastSeen: Date;
    timeoutId?: NodeJS.Timeout;
  };
}

// Interface for tracking gateway statuses
interface GatewayStatusTracker {
  [gatewayId: string]: {
    isOnline: boolean;
    lastSeen: Date;
  };
}

// Dispatch function type
type DispatchFunction = (action: any) => void;

class OfflineDetectionService {
  private sensorTracker: SensorLastSeenTracker = {};
  private gatewayTracker: GatewayStatusTracker = {};
  private isInitialized = false;
  private dispatch: DispatchFunction | null = null;
  private getSettings: (() => { offlineTimeoutMinutes: number }) | null = null;

  // Initialize the service with dispatch function and settings getter
  public initialize(
    dispatch: DispatchFunction,
    getSettings: () => { offlineTimeoutMinutes: number }
  ): void {
    if (this.isInitialized) {
      console.log('[OfflineDetection] Service already initialized');
      return;
    }

    console.log('[OfflineDetection] Initializing offline detection service');
    this.dispatch = dispatch;
    this.getSettings = getSettings;
    this.isInitialized = true;
  }

  // Initialize tracking for existing sensors (call this after sensors are loaded)
  public initializeSensorTracking(sensors: Sensor[]): void {
    sensors.forEach((sensor: Sensor) => {
      if (sensor.lastSeen) {
        this.updateSensorLastSeen(sensor.mac, new Date(sensor.lastSeen));
      }
    });

    console.log(`[OfflineDetection] Initialized tracking for ${sensors.length} sensors`);
  }

  // Initialize gateway tracking (call this when gateways are known to be active)
  public initializeGatewayTracking(gatewayIds: string[]): void {
    gatewayIds.forEach(gatewayId => {
      if (!this.gatewayTracker[gatewayId]) {
        // Initialize as online unless we receive an explicit offline message
        this.gatewayTracker[gatewayId] = {
          isOnline: true,
          lastSeen: new Date(),
        };
        console.log(`[OfflineDetection] Initialized gateway ${gatewayId} as online`);
      }
    });

    console.log(`[OfflineDetection] Initialized tracking for ${gatewayIds.length} gateways`);
  }

  // Update last seen time for a sensor (called when new data arrives)
  public updateSensorLastSeen(mac: string, timestamp: Date = new Date()): void {
    if (!this.isInitialized || !this.dispatch) {
      console.log(`[OfflineDetection] DEBUG: Cannot update sensor ${mac} - not initialized or missing dispatch`);
      return;
    }

    console.log(`[OfflineDetection] DEBUG: Updating last seen for ${mac} - current time: ${timestamp.toISOString()}`);
    
    // Check if this is actually a NEW timestamp or the same one
    const currentLastSeen = this.sensorTracker[mac]?.lastSeen;
    if (currentLastSeen) {
      const timeDiff = timestamp.getTime() - currentLastSeen.getTime();
      console.log(`[OfflineDetection] DEBUG: Time since last update for ${mac}: ${timeDiff}ms`);
      
      if (timeDiff === 0) {
        console.log(`[OfflineDetection] WARNING: Duplicate timestamp detected for ${mac} - IGNORING to prevent timeout reset!`);
        return; // Exit early - don't reset timeout for duplicate timestamps
      }
      
      if (timeDiff < 0) {
        console.log(`[OfflineDetection] WARNING: Older timestamp detected for ${mac} - IGNORING!`);
        return; // Exit early - don't update with older timestamps
      }
    }

    // Clear any existing timeout before setting new one
    if (this.sensorTracker[mac]?.timeoutId) {
      console.log(`[OfflineDetection] DEBUG: Clearing existing timeout for ${mac} before setting new one`);
      clearTimeout(this.sensorTracker[mac].timeoutId);
    }

    // Update tracker
    this.sensorTracker[mac] = {
      lastSeen: timestamp,
    };

    // Mark sensor as online immediately
    this.dispatch(updateSensorOnlineStatus({ mac, isOnline: true }));

    // Set new offline timeout
    this.setSensorOfflineTimeout(mac);

    console.log(`[OfflineDetection] Updated last seen for sensor ${mac} at ${timestamp.toISOString()}`);
  }

  // Set timeout to mark sensor offline based on user settings
  private setSensorOfflineTimeout(mac: string): void {
    if (!this.getSettings) {
      console.warn('[OfflineDetection] Settings getter not available');
      return;
    }

    const settings = this.getSettings();
    const timeoutMinutes = settings.offlineTimeoutMinutes;
    const timeoutMs = timeoutMinutes * 60 * 1000; // Convert to milliseconds

    console.log(`[OfflineDetection] DEBUG: Setting timeout for ${mac} - ${timeoutMinutes} minutes (${timeoutMs}ms)`);
    
    // Clear existing timeout if any
    if (this.sensorTracker[mac]?.timeoutId) {
      console.log(`[OfflineDetection] DEBUG: Clearing existing timeout for ${mac}`);
      clearTimeout(this.sensorTracker[mac].timeoutId);
    }

    const timeoutId = setTimeout(() => {
      console.log(`[OfflineDetection] DEBUG: ⏰ Timeout triggered for sensor ${mac} after ${timeoutMinutes} minutes`);
      this.markSensorOfflineByTimeout(mac);
    }, timeoutMs);

    // Update tracker with timeout ID
    if (this.sensorTracker[mac]) {
      this.sensorTracker[mac].timeoutId = timeoutId;
      console.log(`[OfflineDetection] DEBUG: Timeout ID stored for ${mac}:`, timeoutId);
    } else {
      console.log(`[OfflineDetection] ERROR: Sensor tracker not found for ${mac} when setting timeout`);
    }

    console.log(`[OfflineDetection] Set offline timeout for sensor ${mac}: ${timeoutMinutes} minutes`);
  }

  // Mark sensor offline due to timeout
  private markSensorOfflineByTimeout(mac: string): void {
    if (!this.isInitialized || !this.dispatch || !this.getSettings) {
      return;
    }

    // Check if sensor is still being tracked and hasn't received new data
    if (this.sensorTracker[mac]) {
      const settings = this.getSettings();
      const timeoutMinutes = settings.offlineTimeoutMinutes;
      const now = new Date();
      const timeSinceLastSeen = now.getTime() - this.sensorTracker[mac].lastSeen.getTime();
      const timeoutMs = timeoutMinutes * 60 * 1000;

      // Only mark offline if timeout has actually passed (safety check)
      if (timeSinceLastSeen >= timeoutMs) {
        console.log(`[OfflineDetection] DEBUG: About to dispatch Redux action for sensor ${mac}`);
        console.log(`[OfflineDetection] DEBUG: Dispatch function available:`, !!this.dispatch);
        console.log(`[OfflineDetection] DEBUG: Action payload:`, { mac, isOnline: false });
        
        // Update Redux state first
        this.dispatch(updateSensorOnlineStatus({ mac, isOnline: false }));
        console.log(`[OfflineDetection] ✅ DISPATCHED Redux action - marked sensor ${mac} offline due to timeout (${timeoutMinutes}min)`);
        
        // Update backend database
        this.updateSensorBackendStatus(mac, false, timeoutMinutes);
        
        // Clean up timeout ID
        delete this.sensorTracker[mac].timeoutId;
      }
    }
  }

  // Update sensor online status in backend database
  private async updateSensorBackendStatus(mac: string, isOnline: boolean, timeoutMinutes?: number): Promise<void> {
    try {
      console.log(`[OfflineDetection] 🔄 Updating backend for sensor ${mac}: isOnline=${isOnline}`);
      
      await SensorService.updateSensor(mac, { isOnline });
      
      console.log(`[OfflineDetection] ✅ Successfully updated backend for sensor ${mac}: isOnline=${isOnline}${timeoutMinutes ? ` (timeout: ${timeoutMinutes}min)` : ''}`);
    } catch (error) {
      console.error(`[OfflineDetection] ❌ Failed to update backend for sensor ${mac}:`, error);
      // Don't throw error - we don't want to break the offline detection flow
      // The Redux state has already been updated, which is the primary source of truth for UI
    }
  }

  // Update gateway status
  public updateGatewayStatus(gatewayId: string, isOnline: boolean, timestamp: Date = new Date()): void {
    const wasOnline = this.gatewayTracker[gatewayId]?.isOnline ?? true;
    
    console.log(`[OfflineDetection] DEBUG: Gateway ${gatewayId} status change: ${wasOnline ? 'online' : 'offline'} -> ${isOnline ? 'online' : 'offline'}`);
    
    this.gatewayTracker[gatewayId] = {
      isOnline,
      lastSeen: timestamp,
    };

    console.log(`[OfflineDetection] ✅ Updated gateway ${gatewayId} status: ${isOnline ? 'online' : 'offline'}`);

    // If gateway went offline, handle dependent sensors
    if (wasOnline && !isOnline) {
      console.log(`[OfflineDetection] 🚨 Gateway ${gatewayId} went OFFLINE - checking dependent sensors`);
      this.handleGatewayOffline(gatewayId);
    } else if (!wasOnline && isOnline) {
      console.log(`[OfflineDetection] ✅ Gateway ${gatewayId} came back ONLINE`);
    }
  }

  // Handle when a gateway goes offline (needs sensors data passed in)
  public handleGatewayOffline(gatewayId: string, sensors?: Sensor[]): void {
    if (!this.isInitialized || !this.dispatch || !sensors) {
      console.warn('[OfflineDetection] Cannot handle gateway offline - missing dependencies');
      return;
    }

    console.log(`[OfflineDetection] 🚨 Processing gateway ${gatewayId} offline event for ${sensors.length} sensors`);
    console.log(`[OfflineDetection] Current gateway tracker state:`, Object.keys(this.gatewayTracker).map(id => `${id}=${this.gatewayTracker[id].isOnline}`));

    const dispatch = this.dispatch; // Type guard to satisfy TypeScript

    sensors.forEach((sensor: Sensor) => {
      if (sensor.lastSeenBy && sensor.lastSeenBy.includes(gatewayId)) {
        console.log(`[OfflineDetection] 🔍 Checking sensor ${sensor.mac} that depends on offline gateway ${gatewayId}`);
        console.log(`[OfflineDetection] Sensor ${sensor.mac} lastSeenBy: [${sensor.lastSeenBy.join(', ')}]`);
        console.log(`[OfflineDetection] Sensor ${sensor.mac} current isOnline: ${sensor.isOnline}`);
        
        // Check if this sensor depends only on the offline gateway
        const onlineGateways = sensor.lastSeenBy.filter(gwId => {
          const gatewayStatus = this.gatewayTracker[gwId];
          // If gateway is not tracked, assume it's online (conservative approach)
          // Only mark as offline if explicitly set to false
          const isOnline = gatewayStatus ? gatewayStatus.isOnline : true;
          console.log(`[OfflineDetection] Gateway ${gwId} status: ${gatewayStatus ? `isOnline=${gatewayStatus.isOnline}` : 'not tracked (assumed online)'} -> considered ${isOnline ? 'online' : 'offline'}`);
          return isOnline;
        });

        console.log(`[OfflineDetection] Sensor ${sensor.mac} has ${onlineGateways.length} online gateways: [${onlineGateways.join(', ')}]`);

        // If no online gateways left, mark sensor offline immediately
        if (onlineGateways.length === 0) {
          dispatch(updateSensorOnlineStatus({ mac: sensor.mac, isOnline: false }));
          console.log(`[OfflineDetection] ✅ Marked sensor ${sensor.mac} offline due to ALL dependent gateways being offline`);
          
          // Update backend database
          this.updateSensorBackendStatus(sensor.mac, false);
          
          // Clear any pending timeout since we're marking it offline immediately
          if (this.sensorTracker[sensor.mac]?.timeoutId) {
            clearTimeout(this.sensorTracker[sensor.mac].timeoutId);
            delete this.sensorTracker[sensor.mac].timeoutId;
          }
        } else {
          console.log(`[OfflineDetection] ✅ Sensor ${sensor.mac} kept online - still has ${onlineGateways.length} online gateways: [${onlineGateways.join(', ')}]`);
        }
      } else {
        console.log(`[OfflineDetection] ⏭️ Skipping sensor ${sensor.mac} - not dependent on gateway ${gatewayId} (lastSeenBy: [${sensor.lastSeenBy?.join(', ') || 'none'}])`);
      }
    });
  }

  // Check if sensor should be considered offline based on current settings
  public isSensorOffline(mac: string): boolean {
    if (!this.sensorTracker[mac] || !this.getSettings) {
      return true; // If not tracked, consider offline
    }

    const settings = this.getSettings();
    const timeoutMinutes = settings.offlineTimeoutMinutes;
    const now = new Date();
    const timeSinceLastSeen = now.getTime() - this.sensorTracker[mac].lastSeen.getTime();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    return timeSinceLastSeen >= timeoutMs;
  }

  // Update timeout settings for all sensors
  public updateTimeoutSettings(): void {
    if (!this.isInitialized) {
      console.warn('[OfflineDetection] Service not initialized, skipping timeout update');
      return;
    }

    console.log('[OfflineDetection] Updating timeout settings for all sensors');
    
    // Clear all existing timeouts
    Object.values(this.sensorTracker).forEach(tracker => {
      if (tracker.timeoutId) {
        clearTimeout(tracker.timeoutId);
      }
    });

    // Re-evaluate all sensors with new timeout
    Object.keys(this.sensorTracker).forEach(mac => {
      const isCurrentlyOffline = this.isSensorOffline(mac);
      
      if (isCurrentlyOffline && this.dispatch) {
        this.dispatch(updateSensorOnlineStatus({ mac, isOnline: false }));
      } else if (!isCurrentlyOffline && this.dispatch) {
        this.dispatch(updateSensorOnlineStatus({ mac, isOnline: true }));
        this.setSensorOfflineTimeout(mac);
      }
    });
  }

  // Get current status for debugging
  public getStatus(): { sensors: SensorLastSeenTracker; gateways: GatewayStatusTracker } {
    return {
      sensors: { ...this.sensorTracker },
      gateways: { ...this.gatewayTracker },
    };
  }

  // Clean up resources
  public cleanup(): void {
    console.log('[OfflineDetection] DEBUG: Cleanup called - clearing all timeouts');
    
    // Clear all timeouts
    Object.keys(this.sensorTracker).forEach(mac => {
      if (this.sensorTracker[mac].timeoutId) {
        console.log(`[OfflineDetection] DEBUG: Clearing timeout for sensor ${mac}`);
        clearTimeout(this.sensorTracker[mac].timeoutId);
      }
    });

    console.log('[OfflineDetection] Cleaning up offline detection service');
    
    // Reset trackers
    this.sensorTracker = {};
    this.gatewayTracker = {};
    this.isInitialized = false;
    this.dispatch = null;
    this.getSettings = null;
  }
}

// Export singleton instance
export const offlineDetectionService = new OfflineDetectionService();

// Export for use in components and other services
export { OfflineDetectionService };
