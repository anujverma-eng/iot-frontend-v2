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

  }

  /**
   * Get gateway IDs for sensors
   * @param sensors Array of sensors to get gateway IDs for
   * @returns Promise<string[]> Array of unique gateway IDs
   */
  static async getGatewayIdsForSensors(sensors: Sensor[]): Promise<string[]> {

    const gatewayIds = new Set<string>();

    // Extract gateway IDs from sensors' lastSeenBy field
    sensors.forEach(sensor => {
      if (sensor.lastSeenBy && Array.isArray(sensor.lastSeenBy)) {

        sensor.lastSeenBy.forEach(gatewayId => {
          if (gatewayId) {
            gatewayIds.add(gatewayId);

          }
        });
      } else {

      }
    });

    // If no gateway IDs found in lastSeenBy, try to resolve from sensor MACs
    if (gatewayIds.size === 0) {

      const resolvedIds = await this.resolveGatewayIdsFromSensorMacs(
        sensors.map(s => s.mac)
      );

      resolvedIds.forEach(id => gatewayIds.add(id));
    }

    const result = Array.from(gatewayIds);

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

    const cacheKey = sensorMacs.sort().join(',');

    // Check if there's already a pending request for the same sensors
    if (this.pendingRequests.has(cacheKey)) {

      return this.pendingRequests.get(cacheKey)!;
    }

    // Create the promise and cache it to prevent duplicate requests
    const promise = this._resolveGatewayIdsFromSensorMacs(sensorMacs);
    this.pendingRequests.set(cacheKey, promise);

    try {
      const result = await promise;

      return result;
    } finally {
      // Clean up the pending request
      this.pendingRequests.delete(cacheKey);

    }
  }

  /**
   * Internal implementation of gateway ID resolution
   */
  private static async _resolveGatewayIdsFromSensorMacs(sensorMacs: string[]): Promise<string[]> {
    try {

      // Check cache first
      if (this.isCacheValid()) {

        const cachedIds = sensorMacs
          .map(mac => this.gatewayCache.get(mac))
          .filter(Boolean) as string[];
        
        if (cachedIds.length > 0) {

          return [...new Set(cachedIds)];
        } else {

        }
      } else {

      }

      const response = await GatewayService.getGateways(1, 50); // Reduced from 100 to 50 for faster response
      
      if (!response.data?.data || !Array.isArray(response.data.data)) {

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

          } else {

          }
        }
      }

      // Update cache timestamp
      this.cacheTimestamp = Date.now();

      const result = Array.from(gatewayIds);

      return result;

    } catch (error) {

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
