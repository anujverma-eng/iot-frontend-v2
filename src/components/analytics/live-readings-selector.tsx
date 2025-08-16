import React from 'react';
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { updateMaxLiveReadings, selectMaxLiveReadings } from '../../store/telemetrySlice';
import { useBreakpoints } from '../../hooks/use-media-query';

// Predefined options for live readings
const LIVE_READINGS_OPTIONS = [
  { value: 50, label: '50 readings (~1 min)', description: 'Last 50 data points (~1 minute of data)' },
  { value: 100, label: '100 readings (~2 min)', description: 'Last 100 data points (~2 minutes of data)' },
  { value: 300, label: '300 readings (~5 min)', description: 'Last 300 data points (~5 minutes of data)' },
  { value: 600, label: '600 readings (~10 min)', description: 'Last 600 data points (~10 minutes of data)' },
  { value: 1200, label: '1200 readings (~20 min)', description: 'Last 1200 data points (~20 minutes of data)' },
  { value: 1800, label: '1800 readings (~30 min)', description: 'Last 1800 data points (~30 minutes of data)' },
  { value: 3600, label: '3600 readings (~1 hour)', description: 'Last 3600 data points (~1 hour of data)' },
];

interface LiveReadingsSelectorProps {
  isLiveMode: boolean;
  className?: string;
}

export const LiveReadingsSelector: React.FC<LiveReadingsSelectorProps> = ({ 
  isLiveMode, 
  className = '' 
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const currentMaxReadings = useSelector(selectMaxLiveReadings);
  const { isMobile, isSmallScreen } = useBreakpoints();
  
  // Force re-render when maxLiveReadings changes
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  
  React.useEffect(() => {
    console.log('🔄 LiveReadingsSelector - maxLiveReadings updated to:', currentMaxReadings);
    forceUpdate();
  }, [currentMaxReadings]);

  console.log('🎨 LiveReadingsSelector render - currentMaxReadings:', currentMaxReadings, 'isLiveMode:', isLiveMode);

  const handleMaxReadingsChange = (key: string | number) => {
    const newValue = typeof key === 'string' ? parseInt(key, 10) : key;
    console.log('🔄 Dropdown change - Current:', currentMaxReadings, '→ New:', newValue);
    
    if (isNaN(newValue) || newValue <= 0) {
      console.error('❌ Invalid value:', newValue);
      return;
    }
    
    if (newValue === currentMaxReadings) {
      console.log('⏭️ Value unchanged, skipping');
      return;
    }
    
    console.log('📤 Dispatching updateMaxLiveReadings:', newValue);
    dispatch(updateMaxLiveReadings(newValue));
  };

  const getCurrentOption = () => {
    return LIVE_READINGS_OPTIONS.find(option => option.value === currentMaxReadings) || 
           LIVE_READINGS_OPTIONS.find(option => option.value === 100) ||
           LIVE_READINGS_OPTIONS[1]; // Fallback to second option
  };

  // Only show when live mode is enabled
  if (!isLiveMode) {
    return null;
  }

  const currentOption = getCurrentOption();
  
  console.log('🎯 Current option calculated:', currentOption);
  console.log('🔑 Selected keys for dropdown:', new Set([String(currentMaxReadings)]));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-sm text-default-600 flex-shrink-0 hidden sm:inline">
        Live window:
      </span>
      <Dropdown key={`live-readings-${currentMaxReadings}`}>
        <DropdownTrigger>
          <Button 
            variant="bordered" 
            size="sm"
            className={`justify-between border-green-200 bg-green-50 hover:bg-green-100 ${
              isMobile ? 'min-w-[100px] px-2' : 'min-w-[140px] sm:min-w-[180px]'
            }`}
            endContent={<Icon icon="lucide:chevron-down" width={14} />}
            startContent={<Icon icon="lucide:activity" width={14} className="text-green-600" />}
          >
            <div className="flex flex-col items-start">
              <span className="text-xs text-default-500">
                {isMobile ? `${currentOption.value}` : currentOption.label}
              </span>
            </div>
          </Button>
        </DropdownTrigger>
        <DropdownMenu 
          aria-label="Live readings window size"
          onAction={(key) => {
            console.log('🎯 DropdownMenu onAction triggered with key:', key);
            handleMaxReadingsChange(key);
          }}
          selectedKeys={new Set([String(currentMaxReadings)])}
          selectionMode="single"
        >
          {LIVE_READINGS_OPTIONS.map((option) => (
            <DropdownItem 
              key={String(option.value)}
              description={option.description}
              startContent={
                <Icon 
                  icon="lucide:clock" 
                  width={16} 
                  className="text-default-400" 
                />
              }
            >
              {option.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
};
