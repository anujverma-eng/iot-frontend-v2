import {
  Badge,
  Button,
  Card,
  Checkbox,
  Divider,
  Input,
  Spinner
} from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { FilterBar } from '../components/analytics/filter-bar';
import { ChartContainer } from '../components/visualization/chart-container';
import { chartColors, sensorTypes, statusOptions, timeRangePresets } from '../data/analytics';
import { AppDispatch } from '../store';
import {
  addSelectedSensorId,
  clearSelectedSensorIds,
  fetchSensors,
  removeSelectedSensorId,
  selectFilters,
  selectSelectedSensorIds,
  selectSensors,
  selectSensorsLoading,
  setFilters
} from '../store/sensorsSlice';
import {
  fetchTelemetry,
  selectTelemetryData,
  selectTelemetryLoading
} from '../store/telemetrySlice';
import { FilterState, MultiSeriesConfig, SensorType } from '../types/sensor';

export const ComparePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  // Get state from Redux
  const filters = useSelector(selectFilters);
  const selectedSensorIds = useSelector(selectSelectedSensorIds);
  const telemetryData = useSelector(selectTelemetryData);
  const isLoadingData = useSelector(selectTelemetryLoading);
  const sensors = useSelector(selectSensors);
  const loading = useSelector(selectSensorsLoading);
  
  // State for mobile view
  const [isMobile, setIsMobile] = React.useState(false);
  const [isSensorDrawerOpen, setIsSensorDrawerOpen] = React.useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState(false);
  const [searchText, setSearchText] = React.useState('');
  
  // Check window width on mount and resize
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Load sensors on component mount
  React.useEffect(() => {
    dispatch(fetchSensors({
      page: 1,
      limit: 50,
      claimed: true,
      search: filters.search || "",
      // type: filters.types,
      // status: filters.status === 'all' ? undefined : filters.status
    }));
  }, [dispatch, filters.search, filters.types, filters.status]);
  
  // Fetch data for comparison sensors
  React.useEffect(() => {
    if (selectedSensorIds.length > 0) {
      dispatch(fetchTelemetry({
        sensorIds: selectedSensorIds,
        timeRange: {
          start: filters.timeRange.start.toISOString(),
          end: filters.timeRange.end.toISOString()
        }
      }));
    }
  }, [selectedSensorIds, filters.timeRange, dispatch]);
  
  // Map sensors to the format expected by components
  const mappedSensors = React.useMemo(() => {
    return sensors.map(sensor => ({
      ...sensor,
      id: sensor._id,
      displayName: sensor.displayName,
      starred: sensor.isStarred
    }));
  }, [sensors]);
  
  // Filter sensors based on search text
  const filteredSensors = React.useMemo(() => {
    if (!searchText) return mappedSensors;
    
    const lowerSearch = searchText.toLowerCase();
    return mappedSensors.filter(sensor => 
      sensor.mac.toLowerCase().includes(lowerSearch) || 
      (sensor.displayName && sensor.displayName.toLowerCase().includes(lowerSearch))
    );
  }, [mappedSensors, searchText]);
  
  // Find selected sensors for comparison
  const selectedSensorsForCompare = React.useMemo(() => {
    return filteredSensors.filter(s => selectedSensorIds.includes(s.id));
  }, [filteredSensors, selectedSensorIds]);
  
  // Prepare multi-series chart config for comparison
  const multiSeriesConfig: MultiSeriesConfig | null = React.useMemo(() => {
    if (Object.keys(telemetryData).length === 0 || selectedSensorIds.length === 0) return null;
    
    // Find sensors with available telemetry data
    const availableSensors = selectedSensorIds.filter(id => telemetryData[id]);
    
    if (availableSensors.length === 0) return null;
    
    // Find a common type if possible
    const types = new Set(availableSensors.map(id => telemetryData[id].type));
    const commonType = types.size === 1 ? telemetryData[availableSensors[0]].type : 'generic';
    
    // Find a common unit if possible
    const units = new Set(availableSensors.map(id => telemetryData[id].unit));
    const commonUnit = units.size === 1 ? telemetryData[availableSensors[0]].unit : 'value';
    
    return {
      type: commonType,
      unit: commonUnit,
      series: availableSensors.map((id, index) => {
        const sensor = sensors.find(s => s._id === id);
        return {
          id,
          name: sensor?.displayName || sensor?.mac || id,
          color: chartColors[index % chartColors.length],
          data: telemetryData[id].series
        };
      })
    };
  }, [telemetryData, selectedSensorIds, sensors]);
  
  // Handle search change
  const handleSearchChange = (text: string) => {
    setSearchText(text);
  };
  
  // Handle filter changes
  const handleFiltersChange = (newFilters: Partial<FilterState>) => {
    dispatch(setFilters({ ...filters, ...newFilters }));
  };
  
  // Handle sensor selection toggle
  const handleSensorToggle = (id: string, isSelected: boolean) => {
    if (isSelected) {
      dispatch(addSelectedSensorId(id));
    } else {
      dispatch(removeSelectedSensorId(id));
    }
  };
  
  // Handle brush change for time range
  const handleBrushChange = (start: Date, end: Date) => {
    dispatch(setFilters({
      ...filters,
      timeRange: { start, end }
    }));
  };
  
  // Handle download CSV
  const handleDownloadCSV = () => {
    // In a real app, this would generate and download a CSV file
    console.log('Downloading CSV for selected sensors');
  };
  
  // Handle clear all selected sensors
  const handleClearAll = () => {
    dispatch(clearSelectedSensorIds());
  };
  
  // Handle back to analytics
  const handleBackToAnalytics = () => {
    navigate('/analytics');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-content1 border-b border-divider p-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button
              variant="light"
              isIconOnly
              onPress={handleBackToAnalytics}
            >
              <Icon icon="lucide:arrow-left" width={20} />
            </Button>
            <h1 className="text-xl font-medium">Compare Sensors</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {!isMobile && (
              <Input
                placeholder="Search sensors"
                value={searchText}
                onValueChange={handleSearchChange}
                startContent={<Icon icon="lucide:search" className="text-default-400" />}
                className="w-64"
                size="sm"
                isClearable
              />
            )}
            
            {isMobile && (
              <>
                <Button
                  variant="flat"
                  size="sm"
                  onPress={() => setIsFilterDrawerOpen(true)}
                  startContent={<Icon icon="lucide:filter" width={16} />}
                >
                  Filters
                </Button>
                <Button
                  variant="flat"
                  size="sm"
                  onPress={() => setIsSensorDrawerOpen(true)}
                  startContent={<Icon icon="lucide:list" width={16} />}
                >
                  Sensors
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sensor list - desktop only */}
        {!isMobile && (
          <div className="w-80 border-r border-divider flex flex-col">
            <div className="p-4 border-b border-divider">
              <Input
                placeholder="Search sensors"
                value={searchText}
                onValueChange={handleSearchChange}
                startContent={<Icon icon="lucide:search" className="text-default-400" />}
                size="sm"
                isClearable
              />
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {filteredSensors.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                  <Icon icon="lucide:wifi-off" className="text-default-300 mb-2" width={32} height={32} />
                  <p className="text-default-500">No sensors match your search</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSensors.map(sensor => (
                    <Card key={sensor.id} className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          isSelected={selectedSensorIds.includes(sensor.id)}
                          onValueChange={(isSelected) => handleSensorToggle(sensor.id, isSelected)}
                          size="sm"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${sensor.status === 'live' ? 'bg-success' : 'bg-danger'}`} />
                            <span className="text-sm font-medium truncate">
                              {sensor.displayName || sensor.mac}
                            </span>
                          </div>
                          
                          {sensor.displayName && (
                            <div className="text-xs text-default-500 truncate">
                              {sensor.mac}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              color={
                                sensor.type === 'temperature' ? 'danger' :
                                sensor.type === 'humidity' ? 'primary' :
                                sensor.type === 'pressure' ? 'secondary' :
                                sensor.type === 'battery' ? 'warning' :
                                sensor.type === 'co2' ? 'success' :
                                'default'
                              } 
                              variant="flat"
                              size="sm"
                            >
                              {sensor.type.charAt(0).toUpperCase() + sensor.type.slice(1)}
                            </Badge>
                            
                            {sensor.lastValue !== undefined && (
                              <span className="text-xs font-medium">
                                {sensor.lastValue} {sensor.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-divider">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  {selectedSensorIds.length} selected
                </span>
                
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={handleClearAll}
                  isDisabled={selectedSensorIds.length === 0}
                >
                  Clear All
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Chart area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filter bar */}
          <FilterBar 
            filters={filters} 
            onFiltersChange={handleFiltersChange}
          />
          
          {/* Chart */}
          <div className="flex-1 p-4 overflow-auto">
            {isLoadingData ? (
              <div className="flex items-center justify-center h-full">
                <Spinner />
              </div>
            ) : selectedSensorIds.length > 0 && multiSeriesConfig ? (
              <ChartContainer 
                config={multiSeriesConfig}
                isMultiSeries={true}
                onBrushChange={handleBrushChange}
                onDownloadCSV={handleDownloadCSV}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-4" width={48} height={48} />
                <h3 className="text-xl font-medium mb-2">Compare Sensors</h3>
                <p className="text-default-500 mb-6 max-w-md">
                  Select two or more sensors from the list to compare their data.
                </p>
                {isMobile && (
                  <Button
                    color="primary"
                    onPress={() => setIsSensorDrawerOpen(true)}
                    startContent={<Icon icon="lucide:list" width={16} />}
                  >
                    Select Sensors
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Sensor Drawer */}
      {isMobile && (
        <div className={`fixed inset-0 bg-overlay/50 z-50 transition-opacity ${isSensorDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
             onClick={() => setIsSensorDrawerOpen(false)}>
          <div 
            className={`absolute bottom-0 left-0 right-0 h-3/4 bg-content1 shadow-lg transition-transform rounded-t-xl ${isSensorDrawerOpen ? 'translate-y-0' : 'translate-y-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-divider flex justify-between items-center">
                <h3 className="text-lg font-medium">Select Sensors</h3>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => setIsSensorDrawerOpen(false)}
                >
                  <Icon icon="lucide:x" width={16} />
                </Button>
              </div>
              
              <div className="p-4 border-b border-divider">
                <Input
                  placeholder="Search sensors"
                  value={searchText}
                  onValueChange={handleSearchChange}
                  startContent={<Icon icon="lucide:search" className="text-default-400" />}
                  size="sm"
                  isClearable
                />
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {filteredSensors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <Icon icon="lucide:wifi-off" className="text-default-300 mb-2" width={32} height={32} />
                    <p className="text-default-500">No sensors match your search</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredSensors.map(sensor => (
                      <Card key={sensor.id} className="p-3">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            isSelected={selectedSensorIds.includes(sensor.id)}
                            onValueChange={(isSelected) => handleSensorToggle(sensor.id, isSelected)}
                            size="sm"
                          />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className={`w-2 h-2 rounded-full ${sensor.status === 'live' ? 'bg-success' : 'bg-danger'}`} />
                              <span className="text-sm font-medium truncate">
                                {sensor.displayName || sensor.mac}
                              </span>
                            </div>
                            
                            {sensor.displayName && (
                              <div className="text-xs text-default-500 truncate">
                                {sensor.mac}
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                color={
                                  sensor.type === 'temperature' ? 'danger' :
                                  sensor.type === 'humidity' ? 'primary' :
                                  sensor.type === 'pressure' ? 'secondary' :
                                  sensor.type === 'battery' ? 'warning' :
                                  sensor.type === 'co2' ? 'success' :
                                  'default'
                                } 
                                variant="flat"
                                size="sm"
                              >
                                {sensor.type.charAt(0).toUpperCase() + sensor.type.slice(1)}
                              </Badge>
                              
                              {sensor.lastValue !== undefined && (
                                <span className="text-xs font-medium">
                                  {sensor.lastValue} {sensor.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-3 border-t border-divider">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium">
                    {selectedSensorIds.length} selected
                  </span>
                  
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={handleClearAll}
                    isDisabled={selectedSensorIds.length === 0}
                  >
                    Clear All
                  </Button>
                </div>
                
                <Button
                  color="primary"
                  fullWidth
                  onPress={() => setIsSensorDrawerOpen(false)}
                  isDisabled={selectedSensorIds.length === 0}
                >
                  Apply Selection
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Filter Drawer */}
      {isMobile && (
        <div className={`fixed inset-0 bg-overlay/50 z-50 transition-opacity ${isFilterDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
             onClick={() => setIsFilterDrawerOpen(false)}>
          <div 
            className={`absolute bottom-0 left-0 right-0 h-3/4 bg-content1 shadow-lg transition-transform rounded-t-xl ${isFilterDrawerOpen ? 'translate-y-0' : 'translate-y-full'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-divider flex justify-between items-center">
                <h3 className="text-lg font-medium">Filters</h3>
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  onPress={() => setIsFilterDrawerOpen(false)}
                >
                  <Icon icon="lucide:x" width={16} />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Sensor Type Filter */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Sensor Type</h4>
                    <div className="flex flex-wrap gap-2">
                      {sensorTypes.map((type) => (
                        <Button
                          key={type.value}
                          size="sm"
                          variant={filters.types.includes(type.value as SensorType) ? "solid" : "bordered"}
                          color={filters.types.includes(type.value as SensorType) ? "primary" : "default"}
                          onPress={() => {
                            const newTypes = filters.types.includes(type.value as SensorType)
                              ? filters.types.filter(t => t !== type.value)
                              : [...filters.types, type.value as SensorType];
                            handleFiltersChange({ types: newTypes });
                          }}
                        >
                          {type.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <Divider />
                  
                  {/* Status Filter */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Status</h4>
                    <div className="flex flex-wrap gap-2">
                      {statusOptions.map((status) => (
                        <Button
                          key={status.value}
                          size="sm"
                          variant={filters.status === status.value ? "solid" : "bordered"}
                          color={filters.status === status.value ? "primary" : "default"}
                          onPress={() => handleFiltersChange({ status: status.value as FilterState['status'] })}
                        >
                          {status.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <Divider />
                  
                  {/* Time Range Filter */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Time Range</h4>
                    <div className="flex flex-wrap gap-2">
                      {timeRangePresets.map((preset, index) => (
                        <Button
                          key={index}
                          size="sm"
                          variant="bordered"
                          onPress={() => {
                            const newTimeRange = preset.getValue();
                            handleFiltersChange({ timeRange: newTimeRange });
                          }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-3 border-t border-divider">
                <Button
                  color="primary"
                  fullWidth
                  onPress={() => setIsFilterDrawerOpen(false)}
                >
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};