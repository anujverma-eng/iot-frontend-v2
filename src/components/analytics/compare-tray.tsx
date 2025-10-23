import React from 'react';
import { Card, Button, Badge } from '@heroui/react';
import { Icon } from '@iconify/react';
import { Sensor } from '../../types/sensor';

interface CompareTrayProps {
  selectedSensors: Sensor[];
  onRemoveSensor: (id: string) => void;
  onClearAll: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export const CompareTray: React.FC<CompareTrayProps> = ({
  selectedSensors,
  onRemoveSensor,
  onClearAll,
  isExpanded,
  onToggleExpand
}) => {
  if (selectedSensors.length === 0) return null;
  
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'temperature': return 'danger';
      case 'humidity': return 'primary';
      case 'pressure': return 'secondary';
      case 'battery': return 'warning';
      case 'co2': return 'success';
      default: return 'default';
    }
  };
  
  return (
    <Card className="w-full border-t border-divider z-10">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Compare Sensors</h3>
            <Badge color="primary" variant="flat" size="sm">
              {selectedSensors.length}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="light"
              onPress={() => {
                // Call the onClearAll prop directly
                if (onClearAll) onClearAll();
              }}
              startContent={<Icon icon="lucide:x" width={14} />}
            >
              Clear All
            </Button>
            
            <Button
              size="sm"
              variant="flat"
              onPress={onToggleExpand}
              endContent={
                <Icon 
                  icon={isExpanded ? "lucide:chevron-down" : "lucide:chevron-up"} 
                  width={14} 
                />
              }
            >
              {isExpanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto">
          {selectedSensors.map(sensor => (
            <span key={sensor._id} className="inline-flex items-center">
              <Badge
                color={getTypeColor(sensor.type)}
                variant="flat"
                className="py-1 px-2"
              >
                {sensor.displayName || sensor.mac}
              </Badge>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="ml-1 p-0 min-w-0 w-4 h-4"
                onPress={() => {
                  // Call the onRemoveSensor prop directly with the sensor ID
                  if (onRemoveSensor) onRemoveSensor(sensor._id);
                }}
              >
                <Icon icon="lucide:x" width={12} />
              </Button>
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
};