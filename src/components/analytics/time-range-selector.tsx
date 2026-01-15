// components/analytics/time-range-selector.tsx
import { Button, DateRangePicker, Popover, PopoverContent, PopoverTrigger, Spinner, TimeInput, Tabs, Tab } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CalendarDate, DateValue, Time } from "@internationalized/date";
import React from "react";
import { timeRangePresets } from "../../data/analytics";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { useBreakpoints } from "../../hooks/use-media-query";
import { 
  selectIsLiveMode, 
  selectIsConnecting,
  toggleLiveMode as toggleLiveModeAction
} from "../../store/liveDataSlice";
import { debugTimeRangeSelector } from "../../utils/debug-time";

type RangeValue<T> = { start: T | null; end: T | null };

const toCal = (d: Date) => new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
const toTime = (d: Date) => new Time(d.getHours(), d.getMinutes(), d.getSeconds());

type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'slow_network';

export const TimeRangeSelector: React.FC<{
  timeRange: { start: Date; end: Date };
  onTimeRangeChange: (range: { start: Date; end: Date }) => void;
  showApplyButtons?: boolean;
  isMobile?: boolean;
  isLiveMode?: boolean;
  onLiveModeChange?: (isLive: boolean) => void;
  liveStatus?: LiveStatus;
  onRetryConnection?: () => void;
  gatewayIds?: string[];
  hideLiveMode?: boolean;
}> = ({ 
  timeRange, 
  onTimeRangeChange, 
  showApplyButtons = false, 
  isMobile = false,
  isLiveMode: externalIsLiveMode,
  onLiveModeChange,
  liveStatus: externalLiveStatus,
  onRetryConnection,
  gatewayIds = [],
  hideLiveMode = false,
}) => {
  const dispatch = useAppDispatch();
  const reduxIsLiveMode = useAppSelector(selectIsLiveMode);
  const reduxIsConnecting = useAppSelector(selectIsConnecting);
  const { isMobile: isBreakpointMobile, isMobileDevice: isEnhancedMobile } = useBreakpoints();
  
  // Use external props if available, otherwise use Redux state
  const isLiveMode = externalIsLiveMode !== undefined ? externalIsLiveMode : reduxIsLiveMode;
  const isMobileDevice = isMobile || isEnhancedMobile || isBreakpointMobile;
  const liveStatus = externalLiveStatus !== undefined ? externalLiveStatus : 
    (reduxIsConnecting ? 'connecting' : (reduxIsLiveMode ? 'connected' : 'disconnected'));
  
  const [open, setOpen] = React.useState(false);
  const [pendingTimeRange, setPendingTimeRange] = React.useState(timeRange);
  const [pendingLiveMode, setPendingLiveMode] = React.useState(isLiveMode);
  const [pendingStartTime, setPendingStartTime] = React.useState(() => toTime(timeRange.start));
  const [pendingEndTime, setPendingEndTime] = React.useState(() => toTime(timeRange.end));
  
  // Helper function to compare time ranges with tolerance
  const isSameTimeRange = (range1: { start: Date; end: Date }, range2: { start: Date; end: Date }) => {
    const tolerance = 60 * 1000;
    const startDiff = Math.abs(range1.start.getTime() - range2.start.getTime());
    const endDiff = Math.abs(range1.end.getTime() - range2.end.getTime());
    
    const range1StartIsStartOfDay = range1.start.getHours() === 0 && range1.start.getMinutes() === 0;
    const range2StartIsStartOfDay = range2.start.getHours() === 0 && range2.start.getMinutes() === 0;
    
    if (range1StartIsStartOfDay && range2StartIsStartOfDay) {
      const sameStartDay = range1.start.toDateString() === range2.start.toDateString();
      const endWithinToday = endDiff < 24 * 60 * 60 * 1000;
      return sameStartDay && endWithinToday;
    }
    
    return startDiff < tolerance && endDiff < tolerance;
  };
  
  const [rangeIdx, setRangeIdx] = React.useState(() => {
    if (isLiveMode) return -1;
    return timeRangePresets.findIndex((p, i) => {
      if (i === timeRangePresets.length - 1) return false;
      const preset = p.getValue();
      return isSameTimeRange(preset, timeRange);
    });
  });

  React.useEffect(() => {
    if (isLiveMode) {
      setRangeIdx(-1);
      setPendingLiveMode(true);
      return;
    }

    const idx = timeRangePresets.findIndex((p, i) => {
      if (i === timeRangePresets.length - 1) return false;
      const r = p.getValue();
      return isSameTimeRange(r, timeRange);
    });
    setRangeIdx(idx === -1 ? timeRangePresets.length - 1 : idx);
    setPendingTimeRange(timeRange);
    setPendingLiveMode(isLiveMode);
    setPendingStartTime(toTime(timeRange.start));
    setPendingEndTime(toTime(timeRange.end));
  }, [timeRange, isLiveMode]);

  const handleTabChange = async (isLive: boolean) => {
    setPendingLiveMode(isLive);
    
    if (isLive) {
      setRangeIdx(-1);
    } else {
      // Default to "Today" when switching to historical
      setRangeIdx(1);
      const defaultRange = timeRangePresets[1].getValue();
      setPendingTimeRange(defaultRange);
      setPendingStartTime(toTime(defaultRange.start));
      setPendingEndTime(toTime(defaultRange.end));
    }
  };

  const choosePreset = (i: number) => {
    setRangeIdx(i);
    setPendingLiveMode(false);
    
    if (i === timeRangePresets.length - 1) {
      // Custom preset - keep existing values or set reasonable default
      if (rangeIdx !== timeRangePresets.length - 1) {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const newRange = { start: oneHourAgo, end: now };
        setPendingTimeRange(newRange);
        setPendingStartTime(toTime(oneHourAgo));
        setPendingEndTime(toTime(now));
      }
      return;
    }
    
    const newRange = timeRangePresets[i].getValue();
    setPendingTimeRange(newRange);
    setPendingStartTime(toTime(newRange.start));
    setPendingEndTime(toTime(newRange.end));
  };

  const combineDateTime = () => {
    const startDate = new Date(pendingTimeRange.start.getFullYear(), pendingTimeRange.start.getMonth(), pendingTimeRange.start.getDate());
    const endDate = new Date(pendingTimeRange.end.getFullYear(), pendingTimeRange.end.getMonth(), pendingTimeRange.end.getDate());
    
    startDate.setHours(pendingStartTime.hour, pendingStartTime.minute, pendingStartTime.second, 0);
    endDate.setHours(pendingEndTime.hour, pendingEndTime.minute, pendingEndTime.second, 0);
    
    return { start: startDate, end: endDate };
  };

  const handleCustomDateChange = (value: RangeValue<DateValue> | null) => {
    if (value?.start && value?.end) {
      const startDate = new Date(value.start.year, value.start.month - 1, value.start.day);
      const endDate = new Date(value.end.year, value.end.month - 1, value.end.day);
      
      startDate.setHours(pendingStartTime.hour, pendingStartTime.minute, pendingStartTime.second, 0);
      endDate.setHours(pendingEndTime.hour, pendingEndTime.minute, pendingEndTime.second, 0);
      
      const newRange = { start: startDate, end: endDate };
      setRangeIdx(timeRangePresets.length - 1);
      setPendingTimeRange(newRange);
      setPendingLiveMode(false);
    }
  };

  const handleStartTimeChange = (time: Time | null) => {
    if (time) {
      setPendingStartTime(time);
      const startDate = new Date(pendingTimeRange.start.getFullYear(), pendingTimeRange.start.getMonth(), pendingTimeRange.start.getDate());
      const endDate = new Date(pendingTimeRange.end.getFullYear(), pendingTimeRange.end.getMonth(), pendingTimeRange.end.getDate());
      
      startDate.setHours(time.hour, time.minute, time.second, 0);
      endDate.setHours(pendingEndTime.hour, pendingEndTime.minute, pendingEndTime.second, 0);
      
      const newRange = { start: startDate, end: endDate };
      debugTimeRangeSelector('Start Time Change', newRange, time, pendingEndTime);
      
      setRangeIdx(timeRangePresets.length - 1);
      setPendingTimeRange(newRange);
      setPendingLiveMode(false);
    }
  };

  const handleEndTimeChange = (time: Time | null) => {
    if (time) {
      setPendingEndTime(time);
      const startDate = new Date(pendingTimeRange.start.getFullYear(), pendingTimeRange.start.getMonth(), pendingTimeRange.start.getDate());
      const endDate = new Date(pendingTimeRange.end.getFullYear(), pendingTimeRange.end.getMonth(), pendingTimeRange.end.getDate());
      
      startDate.setHours(pendingStartTime.hour, pendingStartTime.minute, pendingStartTime.second, 0);
      endDate.setHours(time.hour, time.minute, time.second, 0);
      
      const newRange = { start: startDate, end: endDate };
      debugTimeRangeSelector('End Time Change', newRange, pendingStartTime, time);
      
      setRangeIdx(timeRangePresets.length - 1);
      setPendingTimeRange(newRange);
      setPendingLiveMode(false);
    }
  };

  const handleApply = async () => {
    if (pendingLiveMode) {
      if (onLiveModeChange) {
        onLiveModeChange(true);
      } else {
        try {
          await dispatch(toggleLiveModeAction({ enable: true })).unwrap();
        } catch (error) {
          return;
        }
      }
    } else {
      if (onLiveModeChange) {
        onLiveModeChange(false);
      } else {
        try {
          await dispatch(toggleLiveModeAction({ enable: false })).unwrap();
        } catch (error) {
          // Silent fail
        }
      }
      
      const finalRange = rangeIdx === timeRangePresets.length - 1 
        ? combineDateTime() 
        : pendingTimeRange;
      
      debugTimeRangeSelector('Apply Final Range', finalRange, pendingStartTime, pendingEndTime);
      onTimeRangeChange(finalRange);
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingTimeRange(timeRange);
    setPendingLiveMode(isLiveMode);
    setRangeIdx(() => {
      if (isLiveMode) return -1;
      const idx = timeRangePresets.findIndex((p, i) => {
        if (i === timeRangePresets.length - 1) return false;
        const r = p.getValue();
        return isSameTimeRange(r, timeRange);
      });
      return idx === -1 ? timeRangePresets.length - 1 : idx;
    });
    setOpen(false);
  };

  const hasPendingChanges = showApplyButtons && (
    pendingLiveMode !== isLiveMode ||
    (!pendingLiveMode && (
      pendingTimeRange.start.getTime() !== timeRange.start.getTime() ||
      pendingTimeRange.end.getTime() !== timeRange.end.getTime()
    ))
  );

  const getCurrentLabel = () => {
    if (isLiveMode || pendingLiveMode) return "Live Data";
    if (rangeIdx >= 0 && rangeIdx < timeRangePresets.length - 1) {
      return timeRangePresets[rangeIdx].label;
    }
    return "Custom";
  };

  const getButtonProps = () => {
    if (isLiveMode) {
      switch (liveStatus) {
        case 'connecting':
          return {
            color: 'warning' as const,
            variant: 'solid' as const,
            className: `animate-pulse ${isMobileDevice ? 'px-2' : 'min-w-[140px]'}`,
            startContent: isMobileDevice ? undefined : <Spinner size="sm" color="current" />
          };
        case 'connected':
          return {
            color: 'success' as const,
            variant: 'solid' as const,
            className: `animate-none ${isMobileDevice ? 'px-2' : 'min-w-[140px]'}`,
            startContent: isMobileDevice ? undefined : <Icon icon="lucide:radio" width={16} className="animate-pulse" />
          };
        case 'error':
          return {
            color: 'danger' as const,
            variant: 'solid' as const,
            className: `animate-none ${isMobileDevice ? 'px-2' : 'min-w-[140px]'}`,
            startContent: isMobileDevice ? undefined : <Icon icon="lucide:wifi-off" width={16} />
          };
        default:
          return {
            color: 'default' as const,
            variant: 'flat' as const,
            className: `animate-none ${isMobileDevice ? 'px-2' : 'min-w-[140px]'}`,
            startContent: isMobileDevice ? undefined : <Icon icon="lucide:calendar" width={16} />
          };
      }
    }

    if (hasPendingChanges) {
      return {
        color: 'primary' as const,
        variant: 'solid' as const,
        className: `animate-pulse ${isMobileDevice ? 'px-2' : 'min-w-[140px]'}`,
        startContent: isMobileDevice ? undefined : <Icon icon="lucide:calendar" width={16} />
      };
    }

    return {
      color: 'default' as const,
      variant: 'flat' as const,
      className: `animate-none ${isMobileDevice ? 'px-2' : 'min-w-[140px]'}`,
      startContent: isMobileDevice ? undefined : <Icon icon="lucide:calendar" width={16} />
    };
  };

  const getButtonContent = () => {
    if (isLiveMode) {
      if (isMobileDevice) {
        return (
          <div className="flex items-center gap-1">
            {liveStatus === 'connecting' && <Spinner size="sm" color="current" />}
            {liveStatus === 'connected' && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
            {liveStatus === 'error' && <Icon icon="lucide:wifi-off" width={12} />}
            <span className="text-xs font-medium">LIVE</span>
          </div>
        );
      }
      switch (liveStatus) {
        case 'connecting': return "Connecting...";
        case 'connected': return "Live Data";
        case 'error': return "Connection Failed";
        default: return "Live Data";
      }
    }
    
    if (isMobileDevice) {
      return (
        <div className="flex items-center gap-1">
          <Icon icon="lucide:calendar" width={12} />
          <span className="text-xs">{getCurrentLabel()}</span>
          {hasPendingChanges && showApplyButtons && <span className="text-warning">*</span>}
        </div>
      );
    }
    
    return hasPendingChanges && showApplyButtons ? "Time Range*" : `Time Range: ${getCurrentLabel()}`;
  };

  const buttonProps = getButtonProps();

  return (
    <div className="relative">
      <Popover 
        isOpen={open} 
        onOpenChange={setOpen} 
        placement="bottom-end"
        offset={10}
      >
        <PopoverTrigger>
          <Button
            size="sm"
            {...buttonProps}
            endContent={<Icon icon="lucide:chevron-down" width={isMobileDevice ? 12 : 16} />}
          >
            {getButtonContent()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0 overflow-hidden">
          <div className="p-4 space-y-4">
            {/* Live/Historical Tab Toggle - Using HeroUI Tabs for consistent design */}
            {!hideLiveMode && (
              <Tabs
                selectedKey={pendingLiveMode ? "live" : "historical"}
                onSelectionChange={(key) => handleTabChange(key === "live")}
                variant="solid"
                color="primary"
                fullWidth
                classNames={{
                  tabList: "bg-default-100 p-1",
                  cursor: "bg-white shadow-sm",
                  tab: "px-4 py-2 text-sm font-medium",
                  tabContent: "group-data-[selected=true]:text-default-900"
                }}
              >
                <Tab key="live" title="Live Data" />
                <Tab key="historical" title="Historical Data" />
              </Tabs>
            )}

            {/* Historical Data Options - Time Range presets */}
            {!pendingLiveMode && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-default-700">Time Range:</p>
                
                {/* Preset buttons in 2-column grid - matches the design */}
                <div className="grid grid-cols-2 gap-2">
                  {timeRangePresets.slice(0, -1).map((p, i) => (
                    <Button
                      key={p.label}
                      size="sm"
                      variant={rangeIdx === i ? "solid" : "bordered"}
                      color={rangeIdx === i ? "primary" : "default"}
                      startContent={<Icon icon="lucide:calendar" width={14} />}
                      onPress={() => choosePreset(i)}
                      className="justify-start h-10"
                    >
                      {p.label}
                    </Button>
                  ))}
                  {/* Custom button */}
                  <Button
                    size="sm"
                    variant={rangeIdx === timeRangePresets.length - 1 ? "solid" : "bordered"}
                    color={rangeIdx === timeRangePresets.length - 1 ? "primary" : "default"}
                    startContent={<Icon icon="lucide:calendar" width={14} />}
                    onPress={() => choosePreset(timeRangePresets.length - 1)}
                    className="justify-start h-10"
                  >
                    Custom
                  </Button>
                </div>

                {/* Custom Date/Time Picker - only show for Custom preset */}
                {rangeIdx === timeRangePresets.length - 1 && (
                  <div className="mt-4 space-y-4 pt-3 border-t border-default-200">
                    <div>
                      <label className="text-xs font-medium text-default-600 mb-2 block">
                        Date Range
                      </label>
                      <DateRangePicker
                        aria-label="Custom range"
                        showMonthAndYearPickers
                        value={{
                          start: toCal(pendingTimeRange.start),
                          end: toCal(pendingTimeRange.end),
                        }}
                        onChange={handleCustomDateChange}
                        size="sm"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-default-600 mb-2 block">
                          Start Time
                        </label>
                        <TimeInput
                          aria-label="Start time"
                          value={pendingStartTime}
                          onChange={handleStartTimeChange}
                          size="sm"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs font-medium text-default-600 mb-2 block">
                          End Time
                        </label>
                        <TimeInput
                          aria-label="End time"
                          value={pendingEndTime}
                          onChange={handleEndTimeChange}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Live Mode Status - Clean indicator when in live mode */}
            {pendingLiveMode && (
              <div className="text-center py-2">
                <div className="flex items-center justify-center gap-2 text-success-600 mb-2">
                  {liveStatus === 'connecting' ? (
                    <>
                      <Spinner size="sm" color="current" />
                      <span className="text-sm">Connecting to live feed...</span>
                    </>
                  ) : liveStatus === 'connected' ? (
                    <>
                      <div className="w-2.5 h-2.5 bg-success-500 rounded-full animate-pulse" />
                      <span className="text-sm font-medium">Receiving live updates</span>
                    </>
                  ) : liveStatus === 'error' ? (
                    <>
                      <Icon icon="lucide:wifi-off" width={16} className="text-danger-500" />
                      <span className="text-sm text-danger-600">Connection failed</span>
                    </>
                  ) : (
                    <>
                      <Icon icon="lucide:radio" width={16} />
                      <span className="text-sm">Real-time data streaming</span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Apply/Cancel Buttons - matches the design in images */}
            {showApplyButtons && (
              <div className="flex gap-3 pt-3">
                <Button
                  size="md"
                  variant="flat"
                  onPress={handleCancel}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="md"
                  color="primary"
                  onPress={handleApply}
                  className="flex-1"
                >
                  Apply
                </Button>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
