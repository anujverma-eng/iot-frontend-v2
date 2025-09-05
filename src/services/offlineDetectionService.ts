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

      return;
    }

    this.dispatch = dispatch;
    this.getSettings = getSettings;
    this.isInitialized = true;
  }

  // Initialize tracking for existing sensors (call this after sensors are loaded)
  public initializeSensorTracking(sensors: Sensor[]): void {
    console.log(`[OfflineDetection] Initializing tracking for ${sensors.length} sensors`);
    sensors.forEach((sensor: Sensor) => {
      if (sensor.lastSeen) {
        console.log(`[OfflineDetection] Init sensor ${sensor.mac}, lastSeen: ${sensor.lastSeen}, isOnline: ${sensor.isOnline}`);
        // Only initialize tracking data without starting timeout
        // The timeout should only start when we actually receive live data
        this.sensorTracker[sensor.mac] = {
          lastSeen: new Date(sensor.lastSeen),
          // Don't set timeoutId - this will start when live data arrives
        };
      }
    });

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

      }
    });

  }

  // Update last seen time for a sensor (called when new data arrives)
  public updateSensorLastSeen(mac: string, timestamp: Date = new Date()): void {
    console.log(`[OfflineDetection] Live data received for sensor ${mac} at ${timestamp.toISOString()}`);
    if (!this.isInitialized || !this.dispatch) {

      return;
    }

    // Check if this is actually a NEW timestamp or the same one
    const currentLastSeen = this.sensorTracker[mac]?.lastSeen;
    if (currentLastSeen) {
      const timeDiff = timestamp.getTime() - currentLastSeen.getTime();

      if (timeDiff === 0) {

        return; // Exit early - don't reset timeout for duplicate timestamps
      }
      
      if (timeDiff < 0) {

        return; // Exit early - don't update with older timestamps
      }
    }

    // Clear any existing timeout before setting new one
    if (this.sensorTracker[mac]?.timeoutId) {

      clearTimeout(this.sensorTracker[mac].timeoutId);
    }

    // Update tracker
    this.sensorTracker[mac] = {
      lastSeen: timestamp,
    };

    // Mark sensor as online immediately
    console.log(`[OfflineDetection] Marking sensor ${mac} as ONLINE in Redux`);
    this.dispatch(updateSensorOnlineStatus({ mac, isOnline: true }));

    // Set new offline timeout
    this.setSensorOfflineTimeout(mac);

  }

  // Set timeout to mark sensor offline based on user settings
  private setSensorOfflineTimeout(mac: string): void {
    if (!this.getSettings) {

      return;
    }

    const settings = this.getSettings();
    const timeoutMinutes = settings.offlineTimeoutMinutes;
    const timeoutMs = timeoutMinutes * 60 * 1000; // Convert to milliseconds

    // Clear existing timeout if any
    if (this.sensorTracker[mac]?.timeoutId) {

      clearTimeout(this.sensorTracker[mac].timeoutId);
    }

    const timeoutId = setTimeout(() => {

      this.markSensorOfflineByTimeout(mac);
    }, timeoutMs);

    // Update tracker with timeout ID
    if (this.sensorTracker[mac]) {
      this.sensorTracker[mac].timeoutId = timeoutId;

    } else {

    }

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
        console.log(`[OfflineDetection] TIMEOUT: Marking sensor ${mac} as OFFLINE (last seen ${Math.round(timeSinceLastSeen/60000)} minutes ago)`);

        // Update Redux state first
        this.dispatch(updateSensorOnlineStatus({ mac, isOnline: false }));

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
      console.log(`[OfflineDetection] PATCH API: Updating sensor ${mac} backend status to isOnline: ${isOnline}`);
      console.trace(`[OfflineDetection] Call stack for PATCH API call:`);

      await SensorService.updateSensor(mac, { isOnline });

    } catch (error) {

      // Don't throw error - we don't want to break the offline detection flow
      // The Redux state has already been updated, which is the primary source of truth for UI
    }
  }

  // Update gateway status
  public updateGatewayStatus(gatewayId: string, isOnline: boolean, timestamp: Date = new Date()): void {
    const wasOnline = this.gatewayTracker[gatewayId]?.isOnline ?? true;
    console.log(`[OfflineDetection] Gateway ${gatewayId} status change: ${wasOnline} -> ${isOnline}`);

    this.gatewayTracker[gatewayId] = {
      isOnline,
      lastSeen: timestamp,
    };

    // If gateway went offline, handle dependent sensors
    if (wasOnline && !isOnline) {
      console.log(`[OfflineDetection] Gateway ${gatewayId} went offline via updateGatewayStatus, calling handleGatewayOffline without sensors`);

      this.handleGatewayOffline(gatewayId);
    } else if (!wasOnline && isOnline) {

    }
  }

  // Handle when a gateway goes offline (needs sensors data passed in)
  public handleGatewayOffline(gatewayId: string, sensors?: Sensor[]): void {
    console.log(`[OfflineDetection] Gateway ${gatewayId} went offline, checking ${sensors?.length || 0} sensors`);
    if (!this.isInitialized || !this.dispatch || !sensors) {

      return;
    }

    const dispatch = this.dispatch; // Type guard to satisfy TypeScript

    sensors.forEach((sensor: Sensor) => {
      if (sensor.lastSeenBy && sensor.lastSeenBy.includes(gatewayId)) {

        // Check if this sensor depends only on the offline gateway
        const onlineGateways = sensor.lastSeenBy.filter(gwId => {
          const gatewayStatus = this.gatewayTracker[gwId];
          // If gateway is not tracked, assume it's online (conservative approach)
          // Only mark as offline if explicitly set to false
          const isOnline = gatewayStatus ? gatewayStatus.isOnline : true;

          return isOnline;
        });

        // If no online gateways left, mark sensor offline immediately
        if (onlineGateways.length === 0) {
          console.log(`[OfflineDetection] GATEWAY OFFLINE: Marking sensor ${sensor.mac} as OFFLINE (no online gateways)`);
          dispatch(updateSensorOnlineStatus({ mac: sensor.mac, isOnline: false }));

          // Update backend database
          this.updateSensorBackendStatus(sensor.mac, false);
          
          // Clear any pending timeout since we're marking it offline immediately
          if (this.sensorTracker[sensor.mac]?.timeoutId) {
            clearTimeout(this.sensorTracker[sensor.mac].timeoutId);
            delete this.sensorTracker[sensor.mac].timeoutId;
          }
        } else {

        }
      } else {

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

      return;
    }

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

    // Clear all timeouts
    Object.keys(this.sensorTracker).forEach(mac => {
      if (this.sensorTracker[mac].timeoutId) {

        clearTimeout(this.sensorTracker[mac].timeoutId);
      }
    });

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
