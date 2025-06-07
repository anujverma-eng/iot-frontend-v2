import {
  Badge,
  Button,
  Divider,
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
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  compact = false
}) => {
  const [selectedTimeRangeIndex, setSelectedTimeRangeIndex] = React.useState(1); // default Today
  const [isCustomDateOpen, setIsCustomDateOpen] = React.useState(false);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);

  const handleTypeChange = (types: SensorType[]) => {
    onFiltersChange({ ...filters, types });
  };

  const handleStatusChange = (status: SensorStatus | 'all') => {
    onFiltersChange({ ...filters, status });
  };

  const handleTimeRangeChange = (index: number) => {
    setSelectedTimeRangeIndex(index);
    const newTimeRange = timeRangePresets[index].getValue();
    setTimeout(() => {
      onFiltersChange({ ...filters, timeRange: newTimeRange });
    }, 0);
    if (index === timeRangePresets.length - 1) {
      setIsCustomDateOpen(true);
    }
  };

  const handleCustomDateChange = (start: Date, end: Date) => {
    onFiltersChange({ ...filters, timeRange: { start, end } });
  };

  const formatTimeRange = () => {
    const { start, end } = filters.timeRange;
    const startStr = start.toLocaleDateString();
    const endStr = end.toLocaleDateString();
    return startStr === endStr ? startStr : `${startStr} - ${endStr}`;
  };

  return (
    <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
      <Dropdown isOpen={isFilterOpen} onOpenChange={setIsFilterOpen} placement="bottom-end">
        <DropdownTrigger>
          <Button
            variant="flat"
            size={compact ? 'sm' : 'md'}
            startContent={<Icon icon="lucide:filter" width={16} />}
          >
            Filter
            {(filters.types.length > 0 || filters.status !== 'all') && (
              <Badge color="primary" size="sm" className="ml-2">
                {(filters.types.length > 0 ? 1 : 0) + (filters.status !== 'all' ? 1 : 0)}
              </Badge>
            )}
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Filter Options" className="w-[280px] p-3" onClose={() => setIsFilterOpen(false)}>
          <DropdownItem className="p-0">
            <div>
              <p className="text-sm font-medium mb-2">Sensor Type</p>
              <div className="flex flex-wrap gap-2">
                {sensorTypes.map((type) => (
                  <Button
                    key={type.value}
                    size="sm"
                    variant={filters.types.includes(type.value) ? 'solid' : 'bordered'}
                    color={filters.types.includes(type.value) ? 'primary' : 'default'}
                    onPress={() => {
                      const newTypes = filters.types.includes(type.value)
                        ? filters.types.filter((t) => t !== type.value)
                        : [...filters.types, type.value];
                      handleTypeChange(newTypes);
                    }}
                  >
                    {type.label}
                  </Button>
                ))}
              </div>
            </div>
          </DropdownItem>
          <DropdownItem className="p-0">
            <Divider className="my-3" />
          </DropdownItem>
          <DropdownItem className="p-0">
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Status</p>
              <div className="flex gap-2">
                {statusOptions.map((status) => (
                  <Button
                    key={status.value}
                    size="sm"
                    variant={filters.status === status.value ? 'solid' : 'bordered'}
                    color={filters.status === status.value ? 'primary' : 'default'}
                    onPress={() => handleStatusChange(status.value as SensorStatus | 'all')}
                  >
                    {status.label}
                  </Button>
                ))}
              </div>
            </div>
          </DropdownItem>
          <DropdownItem className="p-0">
            <Divider className="my-3" />
          </DropdownItem>
          <DropdownItem className="p-0">
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Time Range</p>
              <div className="flex flex-col gap-2">
                {timeRangePresets.map((preset, index) => (
                  <Button
                    key={index}
                    size="sm"
                    variant={selectedTimeRangeIndex === index ? 'solid' : 'bordered'}
                    color={selectedTimeRangeIndex === index ? 'primary' : 'default'}
                    onPress={() => handleTimeRangeChange(index)}
                    className="justify-start"
                    startContent={<Icon icon="lucide:calendar" width={16} />}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>

      <Popover isOpen={isCustomDateOpen} onOpenChange={setIsCustomDateOpen} placement="bottom-end">
        <PopoverTrigger>
          <Button className="hidden">Hidden Trigger</Button>
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
  );
};
