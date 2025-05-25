import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { sensorTypes, statusOptions, timeRangePresets } from '../../data/analytics';
import { FilterState, SensorStatus, SensorType } from '../../types/sensor';
import { Calendar } from './calendar';

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  compact?: boolean;
  selectedIndex?: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({ 
  filters, 
  onFiltersChange,
  compact = false,
  selectedIndex,
}) => {
  const [selectedTimeRangeIndex, setSelectedTimeRangeIndex] = React.useState(selectedIndex ?? 1);
  const [isCustomDateOpen, setIsCustomDateOpen] = React.useState(false);
  
  const handleTypeChange = (types: SensorType[]) => {
    onFiltersChange({ ...filters, types });
  };
  
  const handleStatusChange = (status: SensorStatus | 'all') => {
    onFiltersChange({ ...filters, status });
  };
  
  const handleTimeRangeChange = (index: number) => {
    setSelectedTimeRangeIndex(index);
    const newTimeRange = timeRangePresets[index].getValue();
    
    // Use setTimeout to ensure state updates before callback
    setTimeout(() => {
      onFiltersChange({ ...filters, timeRange: newTimeRange });
    }, 0);
    
    if (index === timeRangePresets.length - 1) {
      setIsCustomDateOpen(true);
    }
  };
  
  const handleCustomDateChange = (start: Date, end: Date) => {
    // Ensure we're using a fresh copy of filters
    setTimeout(() => {
      onFiltersChange({ 
        ...filters, 
        timeRange: { start, end } 
      });
    }, 0);
  };
  
  const formatTimeRange = () => {
    const { start, end } = filters.timeRange;
    const startStr = start.toLocaleDateString();
    const endStr = end.toLocaleDateString();
    
    if (startStr === endStr) {
      return startStr;
    }
    
    return `${startStr} - ${endStr}`;
  };

  return (
    <div className={`w-full bg-content1 border-b border-divider ${compact ? 'px-4 py-2' : 'px-6 py-3'}`}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Sensor Type Filter */}
        <Dropdown>
          <DropdownTrigger>
            <Button 
              variant="flat" 
              size={compact ? "sm" : "md"}
              endContent={<Icon icon="lucide:chevron-down" width={16} />}
            >
              {filters.types.length === 0 
                ? "All Types" 
                : filters.types.length === 1 
                  ? sensorTypes.find(t => t.value === filters.types[0])?.label 
                  : `${filters.types.length} Types`}
            </Button>
          </DropdownTrigger>
          <DropdownMenu 
            aria-label="Sensor Types"
            closeOnSelect={false}
            selectionMode="multiple"
            selectedKeys={new Set(filters.types)}
            onSelectionChange={(keys) => {
              const selectedTypes = Array.from(keys) as SensorType[];
              handleTypeChange(selectedTypes);
            }}
          >
            {sensorTypes.map((type) => (
              <DropdownItem key={type.value}>
                {type.label}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        
        {/* Status Filter */}
        <Dropdown>
          <DropdownTrigger>
            <Button 
              variant="flat" 
              size={compact ? "sm" : "md"}
              endContent={<Icon icon="lucide:chevron-down" width={16} />}
            >
              {statusOptions.find(s => s.value === filters.status)?.label || 'Status'}
            </Button>
          </DropdownTrigger>
          <DropdownMenu 
            aria-label="Status Filter"
            onAction={(key) => handleStatusChange(key as SensorStatus | 'all')}
          >
            {statusOptions.map((status) => (
              <DropdownItem 
                key={status.value}
                startContent={
                  status.value === filters.status ? 
                  <Icon icon="lucide:check" className="text-primary" /> : 
                  <div className="w-4" />
                }
              >
                {status.label}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        
        {/* Time Range Filter */}
        <Dropdown>
          <DropdownTrigger>
            <Button 
              variant="flat" 
              size={compact ? "sm" : "md"}
              endContent={<Icon icon="lucide:chevron-down" width={16} />}
              startContent={<Icon icon="lucide:calendar" width={16} />}
            >
              {selectedTimeRangeIndex === timeRangePresets.length - 1 
                ? formatTimeRange() 
                : timeRangePresets[selectedTimeRangeIndex].label}
            </Button>
          </DropdownTrigger>
          <DropdownMenu 
            aria-label="Time Range"
            onAction={(key) => handleTimeRangeChange(Number(key))}
          >
            {timeRangePresets.map((preset, index) => (
              <DropdownItem 
                key={index}
                startContent={
                  index === selectedTimeRangeIndex ? 
                  <Icon icon="lucide:check" className="text-primary" /> : 
                  <div className="w-4" />
                }
              >
                {preset.label}
              </DropdownItem>
            ))}
          </DropdownMenu>
        </Dropdown>
        
        {/* Custom Date Picker */}
        <Popover 
          isOpen={isCustomDateOpen} 
          onOpenChange={setIsCustomDateOpen}
          placement="bottom"
        >
          <PopoverTrigger>
            <div className="hidden">Hidden Trigger</div>
          </PopoverTrigger>
          <PopoverContent className="p-4 z-50">
            <Calendar 
              startDate={filters.timeRange.start}
              endDate={filters.timeRange.end}
              onChange={handleCustomDateChange}
              onClose={() => setIsCustomDateOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};