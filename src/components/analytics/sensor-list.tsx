import { Input } from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { Sensor } from '../../types/sensor';
import { SensorCard } from './sensor-card';

interface SensorListProps {
  sensors: Sensor[];
  selectedSensorIds: string[];
  onSensorSelect: (id: string) => void;
  onSensorToggleStar: (id: string) => void;
  onSearch: (text: string) => void;
  searchText: string;
  onMultiSelect: (ids: string[]) => void;
  isComparing: boolean;
}

export const SensorList: React.FC<SensorListProps> = ({
  sensors,
  selectedSensorIds,
  onSensorSelect,
  onSensorToggleStar,
  onSearch,
  searchText,
  onMultiSelect,
  isComparing
}) => {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  
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
    <div className="flex flex-col h-full">
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
                isSelected={selectedSensorIds.includes(sensor._id)}
                onSelect={() => onSensorSelect(sensor._id)}
                onToggleStar={() => onSensorToggleStar(sensor._id)}
                isComparing={isComparing}
                isChecked={selectedIds.has(sensor._id)}
                onCheckChange={(checked) => handleCheckboxChange(sensor._id, checked)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};