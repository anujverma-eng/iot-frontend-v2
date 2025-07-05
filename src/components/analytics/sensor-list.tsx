import { Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { Sensor } from '../../types/sensor';
import { SensorCard } from './sensor-card';
import { useDebouncedSensorSelection } from '../../hooks/useDebouncedSensorSelection';

interface SensorListProps {
  sensors: Sensor[];
  selectedSensorIds: string[];
  currentSelectedSensor: string | null; // Current single selected sensor
  onSensorSelect: (id: string) => void;
  onSensorToggleStar: (mac: string) => void;
  onSearch: (text: string) => void;
  searchText: string;
  onMultiSelect: (ids: string[]) => void;
  isComparing: boolean;
  onSensorUpdated?: () => void;
  isDataLoading?: boolean; // Loading state for better UX
  isSensorLoading?: (sensorId: string) => boolean; // Individual sensor loading check
  isCompareLoading?: boolean; // Compare mode loading state
  shouldShowComparison?: (count: number) => boolean; // Check if comparison should be shown
}

export const SensorList: React.FC<SensorListProps> = ({
  sensors,
  selectedSensorIds,
  currentSelectedSensor, // Add current selected sensor
  onSensorSelect,
  onSensorToggleStar,
  onSearch,
  searchText = "", // default to empty string
  onMultiSelect,
  isComparing,
  onSensorUpdated,
  isDataLoading = false, // Loading state
  isSensorLoading = () => false, // Individual sensor loading check
  isCompareLoading = false, // Compare mode loading state
  shouldShowComparison = () => true // Should show comparison check
}) => {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  
  // Use debounced sensor selection to prevent race conditions
  const { debouncedSelect } = useDebouncedSensorSelection(onSensorSelect, 150);
  
  // Reset selection when comparing mode changes
  React.useEffect(() => {
    if (!isComparing) {
      setSelectedIds(new Set());
    }
  }, [isComparing]);
  
  const handleCheckboxChange = (id: string, isChecked: boolean) => {
    const newSelectedIds = new Set(selectedIds);
    
    if (isChecked) {
      newSelectedIds.add(id);
    } else {
      newSelectedIds.delete(id);
    }
    
    setSelectedIds(newSelectedIds);
    onMultiSelect(Array.from(newSelectedIds));
  };
  
  return (
    // <div className="flex flex-col h-full">
    <div className="flex flex-col h-[calc(100%-80px)]">
      <div className="p-4 border-b border-divider">
        <Input
          placeholder="Search by MAC or display name"
          value={searchText}
          onValueChange={onSearch}
          startContent={<Icon icon="lucide:search" className="text-default-400" />}
          isClearable
        />
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {!sensors || sensors.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <Icon icon="lucide:wifi-off" className="text-default-300 mb-2" width={32} height={32} />
            <p className="text-default-500">No sensors match your filters</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {sensors.map((sensor) => (
              <SensorCard
                key={sensor._id}
                sensor={sensor}
                isSelected={currentSelectedSensor === sensor._id} // Use current selected sensor for accurate state
                onSelect={() => debouncedSelect(sensor._id)} // Use debounced selection
                onToggleStar={() => onSensorToggleStar(sensor.mac)}
                isComparing={isComparing}
                isChecked={selectedIds.has(sensor._id)}
                onCheckChange={(checked) => handleCheckboxChange(sensor._id, checked)}
                onSensorUpdated={onSensorUpdated || (() => {})}
                isDataLoading={
                  isComparing 
                    ? isSensorLoading(sensor._id) // Show loading for individual sensors in compare mode
                    : isDataLoading && currentSelectedSensor === sensor._id // Show loading for current sensor only in single mode
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};