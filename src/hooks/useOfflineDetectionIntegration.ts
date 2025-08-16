import { useEffect } from 'react';
import { useAppSelector } from './useAppDispatch';
import { selectSensors } from '../store/sensorsSlice';
import { offlineDetectionService } from '../services/offlineDetectionService';

/**
 * Hook to initialize sensor tracking in the offline detection service
 * This should be called in components that have access to sensor data
 */
export const useOfflineDetectionIntegration = () => {
  const sensors = useAppSelector(selectSensors);

  useEffect(() => {
    // Initialize sensor tracking when sensors are loaded
    if (sensors.length > 0) {
      offlineDetectionService.initializeSensorTracking(sensors);
    }
  }, [sensors]);

  // Return a function to handle gateway offline events with current sensors
  const handleGatewayOffline = (gatewayId: string) => {
    offlineDetectionService.handleGatewayOffline(gatewayId, sensors);
  };

  return { handleGatewayOffline };
};
