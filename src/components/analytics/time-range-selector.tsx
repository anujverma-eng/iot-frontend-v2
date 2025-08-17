// components/analytics/time-range-selector.tsx
import { Button, DateRangePicker, Divider, Popover, PopoverContent, PopoverTrigger, Spinner, Alert } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CalendarDate, DateValue, getLocalTimeZone } from "@internationalized/date";
import React from "react";
import { timeRangePresets } from "../../data/analytics";
import { useAppDispatch, useAppSelector } from "../../hooks/useAppDispatch";
import { useBreakpoints } from "../../hooks/use-media-query";
import { 
  selectIsLiveMode, 
  selectIsConnecting,
  toggleLiveMode as toggleLiveModeAction
} from "../../store/liveDataSlice"; // Use centralized live data slice

type RangeValue<T> = { start: T | null; end: T | null };

const toCal = (d: Date) => new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());

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
  gatewayIds?: string[]; // Add gateway IDs for live mode
}> = ({ 
  timeRange, 
  onTimeRangeChange, 
  showApplyButtons = false, 
  isMobile = false,
  isLiveMode: externalIsLiveMode,
  onLiveModeChange,
  liveStatus: externalLiveStatus,
  onRetryConnection,
  gatewayIds = []
}) => {
  const dispatch = useAppDispatch();
  const reduxIsLiveMode = useAppSelector(selectIsLiveMode);
  const reduxIsConnecting = useAppSelector(selectIsConnecting);
  const { isMobile: isBreakpointMobile, isMobileDevice: isEnhancedMobile, isSmallScreen } = useBreakpoints();
  
  // Use external props if available, otherwise use Redux state
  const isLiveMode = externalIsLiveMode !== undefined ? externalIsLiveMode : reduxIsLiveMode;
  // Use prop, enhanced mobile detection, or breakpoint detection for mobile
  const isMobileDevice = isMobile || isEnhancedMobile || isBreakpointMobile;
  // Derive live status from connection state
  const liveStatus = externalLiveStatus !== undefined ? externalLiveStatus : 
    (reduxIsConnecting ? 'connecting' : (reduxIsLiveMode ? 'connected' : 'disconnected'));
  
  const [open, setOpen] = React.useState(false);
  const [pendingTimeRange, setPendingTimeRange] = React.useState(timeRange);
  const [pendingLiveMode, setPendingLiveMode] = React.useState(isLiveMode);
  
  // Helper function to compare time ranges with tolerance
  const isSameTimeRange = (range1: { start: Date; end: Date }, range2: { start: Date; end: Date }) => {
    const tolerance = 60 * 1000; // 1 minute tolerance for small differences
    
    const startDiff = Math.abs(range1.start.getTime() - range2.start.getTime());
    const endDiff = Math.abs(range1.end.getTime() - range2.end.getTime());
    
    // For "Today" preset, we need special handling since end time changes constantly
    const range1StartIsStartOfDay = range1.start.getHours() === 0 && range1.start.getMinutes() === 0 && range1.start.getSeconds() === 0;
    const range2StartIsStartOfDay = range2.start.getHours() === 0 && range2.start.getMinutes() === 0 && range2.start.getSeconds() === 0;
    
    // If both start at start of day, it's likely "Today" preset
    if (range1StartIsStartOfDay && range2StartIsStartOfDay) {
      const sameStartDay = range1.start.toDateString() === range2.start.toDateString();
      const endWithinToday = endDiff < 24 * 60 * 60 * 1000; // End times within a day
      return sameStartDay && endWithinToday;
    }
    
    return startDiff < tolerance && endDiff < tolerance;
  };
  
  const [rangeIdx, setRangeIdx] = React.useState(() => {
    if (isLiveMode) return -1; // Special index for live mode
    
    return timeRangePresets.findIndex((p, i) => {
      if (i === timeRangePresets.length - 1) return false; // Skip custom
      
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
      if (i === timeRangePresets.length - 1) return false; // skip custom
      const r = p.getValue();
      return isSameTimeRange(r, timeRange);
    });
    setRangeIdx(idx === -1 ? timeRangePresets.length - 1 : idx);
    setPendingTimeRange(timeRange);
    setPendingLiveMode(isLiveMode);
  }, [timeRange, isLiveMode]);

  const toggleLiveMode = async () => {
    const newLiveMode = !pendingLiveMode;
    console.log('[TimeRangeSelector] Live mode toggled:', {
      from: pendingLiveMode,
      to: newLiveMode,
      showApplyButtons,
      isMobileDevice,
      willAutoApply: !showApplyButtons
    });
    
    setPendingLiveMode(newLiveMode);
    
    if (newLiveMode) {
      setRangeIdx(-1);
    } else {
      setRangeIdx(1); // Default to "Last 24 Hours"
    }
    
    // Apply immediately only if NOT using apply buttons
    if (!showApplyButtons) {
      console.log('[TimeRangeSelector] Auto-applying live mode toggle (no apply buttons)');
      if (onLiveModeChange) {
        onLiveModeChange(newLiveMode);
      } else {
        // Use centralized Redux action (no gatewayIds needed, it fetches them automatically)
        try {
          await dispatch(toggleLiveModeAction({ enable: newLiveMode })).unwrap();
        } catch (error) {
          console.error('Failed to toggle live mode:', error);
          // Revert the pending state on error
          setPendingLiveMode(!newLiveMode);
          return;
        }
      }
      
      if (!newLiveMode) {
        const defaultRange = timeRangePresets[1].getValue();
        onTimeRangeChange(defaultRange);
      }
      setOpen(false);
    } else {
      console.log('[TimeRangeSelector] Live mode toggled, waiting for Apply button');
    }
  };

  const choosePreset = (i: number) => {
    console.log('[TimeRangeSelector] Preset selected:', {
      presetIndex: i,
      presetLabel: timeRangePresets[i]?.label,
      showApplyButtons,
      isMobileDevice,
      willAutoApply: !showApplyButtons
    });
    
    setRangeIdx(i);
    setPendingLiveMode(false);
    const newRange = timeRangePresets[i].getValue();
    setPendingTimeRange(newRange);
    
    // Apply immediately only if NOT using apply buttons
    if (!showApplyButtons) {
      console.log('[TimeRangeSelector] Auto-applying preset (no apply buttons)');
      onLiveModeChange?.(false);
      onTimeRangeChange(newRange);
      setOpen(false);
    } else {
      console.log('[TimeRangeSelector] Preset selected, waiting for Apply button');
    }
  };

  const handleCustomDateChange = (value: RangeValue<DateValue> | null) => {
    if (value?.start && value?.end) {
      const startDate = new Date(value.start.year, value.start.month - 1, value.start.day);
      const endDate = new Date(value.end.year, value.end.month - 1, value.end.day, 23, 59, 59);
      
      const newRange = { start: startDate, end: endDate };
      setRangeIdx(timeRangePresets.length - 1); // Set to custom
      setPendingTimeRange(newRange);
      setPendingLiveMode(false);
      
      // Apply immediately only if NOT using apply buttons
      if (!showApplyButtons) {
        onLiveModeChange?.(false);
        onTimeRangeChange(newRange);
        setOpen(false);
      }
    }
  };

  const handleApply = async () => {
    console.log('[TimeRangeSelector] Apply clicked:', {
      pendingLiveMode,
      pendingTimeRange,
      showApplyButtons,
      isMobileDevice,
      hasPendingChanges
    });
    
    if (pendingLiveMode) {
      if (onLiveModeChange) {
        onLiveModeChange(true);
      } else {
        try {
          await dispatch(toggleLiveModeAction({ enable: true })).unwrap();
        } catch (error) {
          console.error('Failed to enable live mode:', error);
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
          console.error('Failed to disable live mode:', error);
        }
      }
      onTimeRangeChange(pendingTimeRange);
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
        return (
          r.start.toDateString() === timeRange.start.toDateString() &&
          r.end.toDateString() === timeRange.end.toDateString()
        );
      });
      return idx === -1 ? timeRangePresets.length - 1 : idx;
    });
    setOpen(false);
  };

  const handleReset = async () => {
    const defaultRange = timeRangePresets[1].getValue(); // Last 24 Hours
    setRangeIdx(1);
    setPendingTimeRange(defaultRange);
    setPendingLiveMode(false);
    
    // Apply immediately only if NOT using apply buttons
    if (!showApplyButtons) {
      if (onLiveModeChange) {
        onLiveModeChange(false);
      } else {
        try {
          await dispatch(toggleLiveModeAction({ enable: false })).unwrap();
        } catch (error) {
          console.error('Failed to disable live mode:', error);
        }
      }
      onTimeRangeChange(defaultRange);
      setOpen(false);
    }
  };

  // Check if pending changes differ from current
  const hasPendingChanges = showApplyButtons && (
    pendingLiveMode !== isLiveMode ||
    (!pendingLiveMode && (
      pendingTimeRange.start.getTime() !== timeRange.start.getTime() ||
      pendingTimeRange.end.getTime() !== timeRange.end.getTime()
    ))
  );

  // Debug logging for pending changes
  React.useEffect(() => {
    if (showApplyButtons) {
      console.log('[TimeRangeSelector] Pending changes check:', {
        hasPendingChanges,
        showApplyButtons,
        isMobileDevice,
        currentLiveMode: isLiveMode,
        pendingLiveMode,
        liveModeChanged: pendingLiveMode !== isLiveMode,
        currentTimeRange: { start: timeRange.start.toISOString(), end: timeRange.end.toISOString() },
        pendingTimeRange: { start: pendingTimeRange.start.toISOString(), end: pendingTimeRange.end.toISOString() },
        timeRangeChanged: !pendingLiveMode && (
          pendingTimeRange.start.getTime() !== timeRange.start.getTime() ||
          pendingTimeRange.end.getTime() !== timeRange.end.getTime()
        )
      });
    }
  }, [hasPendingChanges, showApplyButtons, isMobileDevice, isLiveMode, pendingLiveMode, timeRange, pendingTimeRange]);

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
            className: `animate-pulse ${isMobileDevice ? 'min-w-[60px] px-2' : 'min-w-[140px]'}`,
            startContent: isMobileDevice ? undefined : <Spinner size="sm" color="current" />
          };
        case 'connected':
          return {
            color: 'success' as const,
            variant: 'solid' as const,
            className: `animate-none ${isMobileDevice ? 'min-w-[60px] px-2' : 'min-w-[140px]'}`,
            startContent: isMobileDevice ? undefined : <Icon icon="lucide:radio" width={16} className="animate-pulse" />
          };
        case 'error':
          return {
            color: 'danger' as const,
            variant: 'solid' as const,
            className: `animate-none ${isMobileDevice ? 'min-w-[60px] px-2' : 'min-w-[140px]'}`,
            startContent: isMobileDevice ? undefined : <Icon icon="lucide:wifi-off" width={16} />
          };
        case 'slow_network':
          return {
            color: 'warning' as const,
            variant: 'solid' as const,
            className: `animate-none ${isMobileDevice ? 'min-w-[60px] px-2' : 'min-w-[140px]'}`,
            startContent: isMobileDevice ? undefined : <Icon icon="lucide:signal-low" width={16} />
          };
        default:
          return {
            color: 'default' as const,
            variant: 'flat' as const,
            className: `animate-none ${isMobileDevice ? 'min-w-[60px] px-2' : 'min-w-[140px]'}`,
            startContent: isMobileDevice ? undefined : <Icon icon="lucide:calendar" width={16} />
          };
      }
    }

    if (hasPendingChanges) {
      return {
        color: 'primary' as const,
        variant: 'solid' as const,
        className: `animate-pulse ${isMobileDevice ? 'min-w-[60px] px-2' : 'min-w-[140px]'}`,
        startContent: isMobileDevice ? undefined : <Icon icon="lucide:calendar" width={16} />
      };
    }

    return {
      color: 'default' as const,
      variant: 'flat' as const,
      className: `animate-none ${isMobileDevice ? 'min-w-[60px] px-2' : 'min-w-[140px]'}`,
      startContent: isMobileDevice ? undefined : <Icon icon="lucide:calendar" width={16} />
    };
  };

  const getButtonContent = () => {
    if (isLiveMode) {
      if (isMobileDevice) {
        // Compact mobile version with status indicators
        return (
          <div className="flex items-center gap-1">
            {liveStatus === 'connecting' && <Spinner size="sm" color="current" />}
            {liveStatus === 'connected' && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
            {liveStatus === 'error' && <Icon icon="lucide:wifi-off" width={12} />}
            {liveStatus === 'slow_network' && <Icon icon="lucide:signal-low" width={12} />}
            <span className="text-xs font-medium">LIVE</span>
          </div>
        );
      }
      // Desktop version
      switch (liveStatus) {
        case 'connecting': return "Connecting...";
        case 'connected': return "Live Data";
        case 'error': return "Connection Failed";
        case 'slow_network': return "Slow Network";
        default: return "Live Data";
      }
    }
    
    // Non-live mode
    if (isMobileDevice) {
      return (
        <div className="flex items-center gap-1">
          <Icon icon="lucide:calendar" width={12} />
          <span className="text-xs">{getCurrentLabel().replace('Time Range: ', '').split(' ')[0]}</span>
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
        <PopoverContent className={`${isMobileDevice ? 'w-80' : 'w-96'} p-4`}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-default-700">Data Source</h4>
              {hasPendingChanges && (
                <span className="text-xs text-warning-600 font-medium">Changes pending</span>
              )}
            </div>

            {/* Live Mode Toggle */}
            <div className="space-y-3">
              <Button
                size="md"
                variant={pendingLiveMode ? "solid" : "bordered"}
                color={pendingLiveMode ? "success" : "default"}
                startContent={
                  pendingLiveMode ? (
                    liveStatus === 'connecting' ? (
                      <Spinner size="sm" color="current" />
                    ) : liveStatus === 'connected' ? (
                      <Icon icon="lucide:radio" width={16} className="animate-pulse" />
                    ) : liveStatus === 'error' ? (
                      <Icon icon="lucide:wifi-off" width={16} />
                    ) : (
                      <Icon icon="lucide:signal" width={16} />
                    )
                  ) : (
                    <Icon icon="lucide:radio" width={16} />
                  )
                }
                onPress={toggleLiveMode}
                className="w-full justify-start"
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">Live Real-time Data</span>
                  <span className="text-xs opacity-70">
                    {pendingLiveMode ? (
                      liveStatus === 'connecting' ? "Connecting to live feed..." :
                      liveStatus === 'connected' ? "Receiving live updates" :
                      liveStatus === 'error' ? "Failed to connect" :
                      liveStatus === 'slow_network' ? "Poor connection quality" :
                      "Live mode active"
                    ) : "Enable real-time updates"}
                  </span>
                </div>
              </Button>

              {/* Network Status Alert */}
              {isLiveMode && (liveStatus === 'error' || liveStatus === 'slow_network') && (
                <Alert
                  color={liveStatus === 'error' ? "danger" : "warning"}
                  variant="flat"
                  startContent={
                    <Icon 
                      icon={liveStatus === 'error' ? "lucide:wifi-off" : "lucide:signal-low"} 
                      width={16} 
                    />
                  }
                  endContent={
                    <Button
                      size="sm"
                      variant="flat"
                      color={liveStatus === 'error' ? "danger" : "warning"}
                      onPress={onRetryConnection}
                    >
                      {liveStatus === 'error' ? 'Retry' : 'Switch to Normal'}
                    </Button>
                  }
                >
                  <div className="text-sm">
                    <div className="font-medium">
                      {liveStatus === 'error' ? 'Connection Failed' : 'Slow Network'}
                    </div>
                    <div className="text-xs opacity-80">
                      {liveStatus === 'error' 
                        ? 'Unable to establish real-time connection'
                        : 'Poor network may affect live updates'
                      }
                    </div>
                  </div>
                </Alert>
              )}
            </div>

            {/* Historical Data Options - only show when not in live mode */}
            {!pendingLiveMode && (
              <>
                <Divider />
                <div className="space-y-3">
                  <h5 className="text-sm font-medium text-default-600">Historical Time Range</h5>
                  
                  {/* PRESET BUTTONS */}
                  <div className="grid grid-cols-2 gap-2">
                    {timeRangePresets.map((p, i) => (
                      <Button
                        key={p.label}
                        size="sm"
                        variant={rangeIdx === i ? "solid" : "bordered"}
                        color={rangeIdx === i ? "primary" : "default"}
                        startContent={<Icon icon="lucide:calendar" width={14} />}
                        onPress={() => choosePreset(i)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>

                  {/* CUSTOM DATE PICKER - only show for Custom preset */}
                  {rangeIdx === timeRangePresets.length - 1 && (
                    <div className="mt-4">
                      <DateRangePicker
                        aria-label="Custom range"
                        showMonthAndYearPickers
                        value={{
                          start: toCal(pendingTimeRange.start),
                          end: toCal(pendingTimeRange.end),
                        }}
                        onChange={handleCustomDateChange}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {/* APPLY BUTTONS for both desktop and mobile */}
            {showApplyButtons && (
              <>
                <Divider />
                <div className={`flex gap-2 ${isMobileDevice ? 'flex-col' : ''}`}>
                  <Button
                    size={isMobileDevice ? "md" : "sm"}
                    variant="flat"
                    onPress={handleCancel}
                    className={isMobileDevice ? "w-full" : "flex-1"}
                  >
                    Cancel
                  </Button>
                  <Button
                    size={isMobileDevice ? "md" : "sm"}
                    variant="flat"
                    color="warning"
                    onPress={handleReset}
                    className={isMobileDevice ? "w-full" : "flex-1"}
                  >
                    Reset
                  </Button>
                  <Button
                    size={isMobileDevice ? "md" : "sm"}
                    color="primary"
                    onPress={handleApply}
                    className={isMobileDevice ? "w-full" : "flex-1"}
                    isDisabled={!hasPendingChanges}
                  >
                    Apply
                  </Button>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
