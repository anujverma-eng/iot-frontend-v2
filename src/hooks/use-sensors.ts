import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchSensors, 
  fetchSensorById,
  toggleSensorStar, 
  updateSensorNickname,
  setFilters,
  setSelectedSensorIds,
  addSelectedSensorId,
  removeSelectedSensorId,
  clearSelectedSensorIds,
  selectSensors,
  selectSensorsLoading,
  selectFilters,
  selectSelectedSensorIds,
  selectSelectedSensor
} from '../store/sensorSlice';
import {
  fetchTelemetry,
  setTimeRange,
  selectTelemetryLoading,
  selectTelemetryData,
  selectTimeRange
} from '../store/telemetrySlice';
import { AppDispatch } from '../store';
import { SensorType, SensorStatus, TimeRange, FilterState } from '../types/sensor';

export const useSensors = () => {
  const dispatch = useDispatch<AppDispatch>();
  
  // Select state from Redux store
  const sensors = useSelector(selectSensors);
  const loading = useSelector(selectSensorsLoading);
  const filters = useSelector(selectFilters);
  const selectedSensorIds = useSelector(selectSelectedSensorIds);
  const selectedSensor = useSelector(selectSelectedSensor);
  const telemetryLoading = useSelector(selectTelemetryLoading);
  const telemetryData = useSelector(selectTelemetryData);
  const timeRange = useSelector(selectTimeRange);
  
  // Load sensors based on filters
  React.useEffect(() => {
    dispatch(fetchSensors({
      search: filters.search,
      type: filters.types,
      status: filters.status === 'all' ? undefined : filters.status
    }));
  }, [dispatch, filters.search, filters.types, filters.status]);
  
  // Fetch telemetry data when selected sensor or time range changes
  React.useEffect(() => {
    if (selectedSensorIds.length > 0) {
      dispatch(fetchTelemetry({
        sensorIds: selectedSensorIds,
        timeRange: {
          start: timeRange.start.toISOString(),
          end: timeRange.end.toISOString()
        }
      }));
    }
  }, [dispatch, selectedSensorIds, timeRange]);
  
  // Filter sensors based on current filters
  const filteredSensors = React.useMemo(() => {
    return sensors;
  }, [sensors]);
  
  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<FilterState>) => {
    dispatch(setFilters(newFilters));
  };
  
  // Toggle star status for a sensor
  const handleToggleStar = (sensorId: string) => {
    dispatch(toggleSensorStar(sensorId));
  };
  
  // Update sensor displayName
  const handleUpdateNickname = (sensorId: string, displayName: string) => {
    dispatch(updateSensorNickname({ id: sensorId, displayName }));
  };
  
  // Handle sensor selection
  const handleSensorSelect = (sensorId: string) => {
    dispatch(fetchSensorById(sensorId));
  };
  
  // Handle multi-select for comparison
  const handleMultiSelect = (ids: string[]) => {
    dispatch(setSelectedSensorIds(ids));
  };
  
  // Handle time range changes
  const handleTimeRangeChange = (newTimeRange: TimeRange) => {
    dispatch(setTimeRange(newTimeRange));
  };
  
  return {
    sensors: filteredSensors,
    loading,
    filters,
    selectedSensorIds,
    selectedSensor: selectedSensor.data,
    isLoadingData: telemetryLoading,
    sensorData: selectedSensor.data ? telemetryData[selectedSensor.data._id] : null,
    compareSensorData: telemetryData,
    setFilters: handleFiltersChange,
    setSelectedSensorIds: handleMultiSelect,
    toggleSensorStar: handleToggleStar,
    updateSensorNickname: handleUpdateNickname,
    fetchSensorData: handleSensorSelect,
    handleTimeRangeChange
  };
};