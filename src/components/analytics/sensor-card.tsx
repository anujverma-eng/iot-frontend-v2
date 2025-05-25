import React from 'react';
import { Card, Badge, Button, Checkbox } from '@heroui/react';
import { Icon } from '@iconify/react';
import { Sensor } from '../../types/sensor';

interface SensorCardProps {
  sensor: Sensor;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStar: () => void;
  isComparing: boolean;
  isChecked: boolean;
  onCheckChange: (checked: boolean) => void;
}

export const SensorCard: React.FC<SensorCardProps> = ({
  sensor,
  isSelected,
  onSelect,
  onToggleStar,
  isComparing,
  isChecked,
  onCheckChange
}) => {
  // Map sensor properties to component props
  const sensorId = sensor._id || '';
  const sensorMac = sensor.mac;
  const sensorNickname = sensor.displayName || '';
  const sensorType = sensor.type;
  const sensorStatus = sensor.status;
  const sensorStarred = sensor.isStarred || false;
  const sensorLastValue = sensor.lastValue;
  const sensorUnit = sensor.unit || sensor.lastUnit || '';
  
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
  
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'temperature': return 'lucide:thermometer';
      case 'humidity': return 'lucide:droplets';
      case 'pressure': return 'lucide:gauge';
      case 'battery': return 'lucide:battery';
      case 'co2': return 'lucide:wind';
      case 'light': return 'lucide:sun';
      case 'motion': return 'lucide:activity';
      default: return 'lucide:cpu';
    }
  };
  
  // Check if we're on mobile
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return (
    <Card 
      isPressable={!isComparing}
      onPress={isComparing ? undefined : onSelect}
      className={`w-full ${isSelected ? 'border-primary border-2' : ''}`}
    >
      <div className="p-3 flex items-center gap-3">
        {isComparing && (
          <Checkbox
            isSelected={isChecked}
            onValueChange={onCheckChange}
            size="sm"
          />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${sensorStatus === 'live' ? 'bg-success' : 'bg-danger'}`} />
            <span className="text-sm font-medium truncate">
              {sensorNickname || sensorMac}
            </span>
            <div className="ml-auto">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => {
                  // Remove the e.stopPropagation() call since it's not supported
                  onToggleStar();
                }}
              >
                <Icon 
                  icon={sensorStarred ? "lucide:star" : "lucide:star"} 
                  className={sensorStarred ? "text-warning fill-warning" : "text-default-400"} 
                />
              </Button>
            </div>
          </div>
          
          {(!isMobile || sensorNickname) && (
            <div className="text-xs text-default-500 truncate">
              {sensorNickname ? sensorMac : ''}
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-1">
            <Badge 
              color={getTypeColor(sensorType)} 
              variant="flat"
              size="sm"
            >
              <div className="flex items-center gap-1">
                <Icon icon={getTypeIcon(sensorType)} width={12} />
                {sensorType.charAt(0).toUpperCase() + sensorType.slice(1)}
              </div>
            </Badge>
            
            {sensorLastValue !== undefined && (
              <span className="text-xs font-medium">
                {sensorLastValue} {sensorUnit}
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};