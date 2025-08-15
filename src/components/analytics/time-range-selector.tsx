// components/analytics/time-range-selector.tsx
import { Button, DateRangePicker, Divider, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CalendarDate, DateValue, getLocalTimeZone } from "@internationalized/date";
import React from "react";
import { timeRangePresets } from "../../data/analytics";

type RangeValue<T> = { start: T | null; end: T | null };

const toCal = (d: Date) => new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());

export const TimeRangeSelector: React.FC<{
  timeRange: { start: Date; end: Date };
  onTimeRangeChange: (range: { start: Date; end: Date }) => void;
  showApplyButtons?: boolean;
  isMobile?: boolean;
}> = ({ timeRange, onTimeRangeChange, showApplyButtons = false, isMobile = false }) => {
  const [open, setOpen] = React.useState(false);
  const [pendingTimeRange, setPendingTimeRange] = React.useState(timeRange);
  const [rangeIdx, setRangeIdx] = React.useState(() => {
    const currentStart = timeRange.start;
    const currentEnd = timeRange.end;
    
    return timeRangePresets.findIndex((p, i) => {
      if (i === timeRangePresets.length - 1) return false; // Skip custom
      
      const preset = p.getValue();
      return (
        preset.start.toDateString() === currentStart.toDateString() &&
        preset.end.toDateString() === currentEnd.toDateString()
      );
    });
  });

  React.useEffect(() => {
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const idx = timeRangePresets.findIndex((p, i) => {
      if (i === timeRangePresets.length - 1) return false; // skip custom
      const r = p.getValue();
      return (
        isSameDay(r.start, timeRange.start) &&
        isSameDay(r.end, timeRange.end)
      );
    });
    setRangeIdx(idx === -1 ? timeRangePresets.length - 1 : idx);
    setPendingTimeRange(timeRange);
  }, [timeRange]);

  const choosePreset = (i: number) => {
    setRangeIdx(i);
    const newRange = timeRangePresets[i].getValue();
    setPendingTimeRange(newRange);
    
    // Apply immediately if not using apply buttons or on mobile
    if (!showApplyButtons || isMobile) {
      onTimeRangeChange(newRange);
      setOpen(false);
    }
  };

  const handleCustomDateChange = (value: RangeValue<DateValue> | null) => {
    if (value?.start && value?.end) {
      const startDate = new Date(value.start.year, value.start.month - 1, value.start.day);
      const endDate = new Date(value.end.year, value.end.month - 1, value.end.day, 23, 59, 59);
      
      const newRange = { start: startDate, end: endDate };
      setRangeIdx(timeRangePresets.length - 1); // Set to custom
      setPendingTimeRange(newRange);
      
      // Apply immediately if not using apply buttons or on mobile
      if (!showApplyButtons || isMobile) {
        onTimeRangeChange(newRange);
        setOpen(false);
      }
    }
  };

  const handleApply = () => {
    onTimeRangeChange(pendingTimeRange);
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingTimeRange(timeRange);
    setRangeIdx(() => {
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

  const handleReset = () => {
    const defaultRange = timeRangePresets[1].getValue(); // Last 24 Hours
    setRangeIdx(1);
    setPendingTimeRange(defaultRange);
    
    if (!showApplyButtons || isMobile) {
      onTimeRangeChange(defaultRange);
      setOpen(false);
    }
  };

  // Check if pending changes differ from current
  const hasPendingChanges = showApplyButtons && (
    pendingTimeRange.start.getTime() !== timeRange.start.getTime() ||
    pendingTimeRange.end.getTime() !== timeRange.end.getTime()
  );

  const getCurrentLabel = () => {
    if (rangeIdx >= 0 && rangeIdx < timeRangePresets.length - 1) {
      return timeRangePresets[rangeIdx].label;
    }
    return "Custom";
  };

  return (
    <Popover 
      isOpen={open} 
      onOpenChange={setOpen} 
      placement="bottom-end"
      offset={10}
    >
      <PopoverTrigger>
        <Button
          size="sm"
          variant={hasPendingChanges ? "solid" : "flat"}
          color={hasPendingChanges ? "warning" : "default"}
          startContent={<Icon icon="lucide:calendar" width={16} />}
          className={hasPendingChanges ? "animate-pulse" : ""}
        >
          {hasPendingChanges && showApplyButtons ? "Time Range*" : `Time Range: ${getCurrentLabel()}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-default-700">Select Time Range</h4>
            {hasPendingChanges && (
              <span className="text-xs text-warning-600 font-medium">Changes pending</span>
            )}
          </div>
          
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

          {/* APPLY BUTTONS for desktop mode */}
          {showApplyButtons && !isMobile && (
            <>
              <Divider />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="flat"
                  onPress={handleCancel}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="flat"
                  color="warning"
                  onPress={handleReset}
                  className="flex-1"
                >
                  Reset
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  onPress={handleApply}
                  className="flex-1"
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
  );
};
