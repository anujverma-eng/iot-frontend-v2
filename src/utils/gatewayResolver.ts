import { Sensor } from '../types/sensor';
import { GatewayService } from '../api/gateway.service';

/**
 * Resolves gateway IDs from sensor data
 * Sensors have a `lastSeenBy` field containing gateway IDs,
 * but we need to validate these exist and get proper gateway IDs
 */
export class GatewayResolver {
  private static gatewayCache: Map<string, string> = new Map();
  private static cacheTimestamp: number = 0;
  private static readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (increased from 5)
  private static pendingRequests: Map<string, Promise<string[]>> = new Map();

  static {
    console.log('[GatewayResolver] Class initialized with cache duration:', this.CACHE_DURATION, 'ms');
  }

  /**
   * Get gateway IDs for sensors
   * @param sensors Array of sensors to get gateway IDs for
   * @returns Promise<string[]> Array of unique gateway IDs
   */
  static async getGatewayIdsForSensors(sensors: Sensor[]): Promise<string[]> {
    console.log('[GatewayResolver] getGatewayIdsForSensors called with', sensors.length, 'sensors');
    console.log('[GatewayResolver] Sensor details:', sensors.map(s => ({ id: s.id, mac: s.mac, lastSeenBy: s.lastSeenBy })));
    
    const gatewayIds = new Set<string>();

    // Extract gateway IDs from sensors' lastSeenBy field
    sensors.forEach(sensor => {
      if (sensor.lastSeenBy && Array.isArray(sensor.lastSeenBy)) {
        console.log('[GatewayResolver] Found lastSeenBy for sensor', sensor.mac, ':', sensor.lastSeenBy);
        sensor.lastSeenBy.forEach(gatewayId => {
          if (gatewayId) {
            gatewayIds.add(gatewayId);
            console.log('[GatewayResolver] Added gateway ID:', gatewayId);
          }
        });
      } else {
        console.log('[GatewayResolver] No lastSeenBy found for sensor:', sensor.mac);
      }
    });

    console.log('[GatewayResolver] Initial gateway IDs from lastSeenBy:', Array.from(gatewayIds));

    // If no gateway IDs found in lastSeenBy, try to resolve from sensor MACs
    if (gatewayIds.size === 0) {
      console.warn('[GatewayResolver] No gateway IDs found in lastSeenBy, attempting resolution from sensor MACs');
      const resolvedIds = await this.resolveGatewayIdsFromSensorMacs(
        sensors.map(s => s.mac)
      );
      console.log('[GatewayResolver] Resolved IDs from sensor MACs:', resolvedIds);
      resolvedIds.forEach(id => gatewayIds.add(id));
    }

    const result = Array.from(gatewayIds);
    console.log('[GatewayResolver] Final resolved gateway IDs:', result);
    return result;
  }

  /**
   * Get gateway IDs for a single sensor
   * @param sensor Sensor to get gateway IDs for
   * @returns Promise<string[]> Array of gateway IDs for this sensor
   */
  static async getGatewayIdsForSensor(sensor: Sensor): Promise<string[]> {
    return this.getGatewayIdsForSensors([sensor]);
  }

  /**
   * Resolve gateway IDs from sensor MACs by checking which gateways contain these sensors
   * This is a fallback when lastSeenBy is not available
   */
  private static async resolveGatewayIdsFromSensorMacs(sensorMacs: string[]): Promise<string[]> {
    console.log('[GatewayResolver] resolveGatewayIdsFromSensorMacs called with MACs:', sensorMacs);
    
    const cacheKey = sensorMacs.sort().join(',');
    console.log('[GatewayResolver] Cache key:', cacheKey);
    
    // Check if there's already a pending request for the same sensors
    if (this.pendingRequests.has(cacheKey)) {
      console.log('[GatewayResolver] Using pending request for sensor MACs');
      return this.pendingRequests.get(cacheKey)!;
    }

    // Create the promise and cache it to prevent duplicate requests
    const promise = this._resolveGatewayIdsFromSensorMacs(sensorMacs);
    this.pendingRequests.set(cacheKey, promise);
    console.log('[GatewayResolver] Created new pending request for cache key:', cacheKey);
    
    try {
      const result = await promise;
      console.log('[GatewayResolver] Pending request completed with result:', result);
      return result;
    } finally {
      // Clean up the pending request
      this.pendingRequests.delete(cacheKey);
      console.log('[GatewayResolver] Cleaned up pending request for cache key:', cacheKey);
    }
  }

  /**
   * Internal implementation of gateway ID resolution
   */
  private static async _resolveGatewayIdsFromSensorMacs(sensorMacs: string[]): Promise<string[]> {
    try {
      console.log('[GatewayResolver] _resolveGatewayIdsFromSensorMacs starting with MACs:', sensorMacs);
      
      // Check cache first
      if (this.isCacheValid()) {
        console.log('[GatewayResolver] Cache is valid, checking for cached entries');
        const cachedIds = sensorMacs
          .map(mac => this.gatewayCache.get(mac))
          .filter(Boolean) as string[];
        
        if (cachedIds.length > 0) {
          console.log('[GatewayResolver] Using cached gateway IDs:', cachedIds);
          return [...new Set(cachedIds)];
        } else {
          console.log('[GatewayResolver] No cached entries found for the requested MACs');
        }
      } else {
        console.log('[GatewayResolver] Cache is invalid or expired');
      }

      console.log('[GatewayResolver] Fetching all gateways from API...');
      console.log('[GatewayResolver] Fetching gateways to resolve sensor mappings');
      const response = await GatewayService.getGateways(1, 50); // Reduced from 100 to 50 for faster response
      
      if (!response.data?.data || !Array.isArray(response.data.data)) {
        console.error('[GatewayResolver] Invalid gateway response format');
        return [];
      }

      const gatewayIds = new Set<string>();
      
      // For each gateway, check if it contains any of our sensors
      for (const gateway of response.data.data) {
        try {
          const sensorsResponse = await GatewayService.getSensorsByGateway(gateway._id, true, 1, 50); // Reduced page size
          
          if (sensorsResponse.data?.data && Array.isArray(sensorsResponse.data.data)) {
            const gatewaySensorMacs = sensorsResponse.data.data.map((s: any) => s.mac);
            
            // Check if any of our target sensors are in this gateway
            const hasMatchingSensor = sensorMacs.some(mac => gatewaySensorMacs.includes(mac));
            
            if (hasMatchingSensor) {
              gatewayIds.add(gateway._id);
              
              // Update cache
              gatewaySensorMacs.forEach((mac: string) => {
                this.gatewayCache.set(mac, gateway._id);
              });
            }
          }
        } catch (error: any) {
          // Log warning but don't fail the entire operation
          if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            console.warn(`[GatewayResolver] Timeout fetching sensors for gateway ${gateway._id}, skipping`);
          } else {
            console.warn(`[GatewayResolver] Failed to fetch sensors for gateway ${gateway._id}:`, error.message);
          }
        }
      }

      // Update cache timestamp
      this.cacheTimestamp = Date.now();

      const result = Array.from(gatewayIds);
      console.log('[GatewayResolver] Resolved gateway IDs from sensor MACs:', result);
      return result;

    } catch (error) {
      console.error('[GatewayResolver] Failed to resolve gateway IDs:', error);
      return [];
    }
  }

  /**
   * Check if cache is still valid
   */
  private static isCacheValid(): boolean {
    return Date.now() - this.cacheTimestamp < this.CACHE_DURATION;
  }

  /**
   * Clear the gateway cache and pending requests
   */
  static clearCache(): void {
    this.gatewayCache.clear();
    this.cacheTimestamp = 0;
    this.pendingRequests.clear();
  }

  /**
   * Get gateway ID directly from sensor's lastSeenBy field (preferred method)
   * @param sensor Sensor object
   * @returns string[] Array of gateway IDs from lastSeenBy
   */
  static getDirectGatewayIds(sensor: Sensor): string[] {
    if (sensor.lastSeenBy && Array.isArray(sensor.lastSeenBy)) {
      return sensor.lastSeenBy.filter(Boolean);
    }
    return [];
  }
}
