// components/analytics/FilterBar.tsx
import { Badge, Button, DateRangePicker, Divider, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CalendarDate, DateValue, getLocalTimeZone } from "@internationalized/date";
import React from "react";
import { sensorTypes, statusOptions, timeRangePresets } from "../../data/analytics";
import type { FilterState, SensorStatus, SensorType } from "../../types/sensor";

type RangeValue<T> = { start: T | null; end: T | null };

const toCal = (d: Date) => new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());

export const FilterBar: React.FC<{
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
}> = ({ filters, onFiltersChange }) => {
  const [open, setOpen] = React.useState(false);
  const [rangeIdx, setRangeIdx] = React.useState(() => {
    const currentStart = filters.timeRange.start;
    const currentEnd = filters.timeRange.end;
    
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
      isSameDay(r.start, filters.timeRange.start) &&
      isSameDay(r.end, filters.timeRange.end)
    );
  });
  setRangeIdx(idx === -1 ? timeRangePresets.length - 1 : idx);
}, [filters.timeRange]);

  const setTypes = (next: SensorType[]) => onFiltersChange({ ...filters, types: next });

  const setStatus = (next: SensorStatus | "all") => onFiltersChange({ ...filters, status: next });

  const choosePreset = (i: number) => {
    setRangeIdx(i);
    console.log({
      label: timeRangePresets[i].label,
      idx: i,
      value: timeRangePresets[i].getValue(),
    });
    onFiltersChange({ ...filters, timeRange: timeRangePresets[i].getValue() });
    if (i !== timeRangePresets.length - 1) {
      // setOpen(false); // slam the popover shut for non‑custom presets
    }
  };

  /* ─ UI -------------------------------------------------------------- */

  return (
    <Popover
      isOpen={open}
      onOpenChange={setOpen}
      placement="bottom-start" // opens towards the list of sensors
    >
      {/* TRIGGER ‑ the small "Filters" pill */}
      <PopoverTrigger>
        <Button variant="flat" startContent={<Icon icon="lucide:filter" width={16} />}>
          Filters
          {(filters.types.length || filters.status !== "all") && (
            <Badge size="sm" color="primary" className="ml-2">
              {/*  a neat trick to coerce booleans → 0/1 */}
              {+!!filters.types.length + +(filters.status !== "all")}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      {/* CONTENT ------------------------------------------------------ */}
      {/* Max‑height + overflow gives a scroll bar on tiny viewports   */}
      <PopoverContent className="p-4 w-[300px] max-h-[70vh] overflow-y-auto space-y-4">
        {/* SENSOR TYPE SECTION */}
        <section>
          <h4 className="text-xs font-semibold text-default-600 mb-2 tracking-wide">Sensor type</h4>
          <div className="flex flex-wrap gap-2">
            {sensorTypes.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={filters.types.includes(t.value as SensorType) ? "solid" : "bordered"}
                color={filters.types.includes(t.value as SensorType) ? "primary" : "default"}
                onPress={() =>
                  setTypes(
                    filters.types.includes(t.value as SensorType)
                      ? filters.types.filter((v) => v !== (t.value as SensorType))
                      : [...filters.types, t.value as SensorType]
                  )
                }
              >
                {t.label}
              </Button>
            ))}
          </div>
        </section>

        <Divider />

        {/* STATUS SECTION */}
        <section>
          <h4 className="text-xs font-semibold text-default-600 mb-2 tracking-wide">Status</h4>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((s) => (
              <Button
                key={s.value}
                size="sm"
                variant={filters.status === s.value ? "solid" : "bordered"}
                color={filters.status === s.value ? "primary" : "default"}
                onPress={() => setStatus(s.value as SensorStatus | "all")}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </section>

        <Divider />

        {/* TIME RANGE SECTION */}
        <section>
          <h4 className="text-xs font-semibold text-default-600 mb-2 tracking-wide">Time range</h4>
          <div className="grid grid-cols-2 gap-2">
            {timeRangePresets.map((p, i) => (
              <Button
                key={p.label}
                size="sm"
                variant={rangeIdx === i ? "solid" : "bordered"}
                color={rangeIdx === i ? "primary" : "default"}
                startContent={<Icon icon="lucide:calendar" width={16} />}
                onPress={() => choosePreset(i)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Inline picker becomes visible only for the “Custom” preset */}
          {rangeIdx === timeRangePresets.length - 1 && (
            <div className="mt-3">
              <DateRangePicker
                aria-label="Custom range"
                showMonthAndYearPickers
                value={{
                  start: toCal(filters.timeRange.start),
                  end: toCal(filters.timeRange.end),
                }}
                onChange={(range: RangeValue<DateValue> | null) => {
                  if (!range?.start || !range.end) return;

                  const startJs = range.start.toDate(getLocalTimeZone());
                  const endJs = range.end.toDate(getLocalTimeZone());
                  
                  // ADDED: Set end time to end of day for consistent range
                  endJs.setHours(23, 59, 59, 999);

                  console.log("Date range selected:", {
                    start: startJs,
                    end: endJs,
                    startISO: startJs.toISOString(),
                    endISO: endJs.toISOString()
                  });

                  onFiltersChange({
                    ...filters,
                    timeRange: { start: startJs, end: endJs },
                  });
                }}
              />
            </div>
          )}
        </section>

        <Divider />

        {/* SORT SECTION */}
        <section>
          <h4 className="text-xs font-semibold text-default-600 mb-2 tracking-wide">Sort by</h4>
          {(
            [
              { lbl: "Name (A‑Z)", fld: "name", dir: "asc", ic: "lucide:arrow-up" },
              { lbl: "Name (Z‑A)", fld: "name", dir: "desc", ic: "lucide:arrow-down" },
              { lbl: "Starred first", fld: "starred", dir: "desc", ic: "lucide:star" },
            ] as { lbl: string; fld: string; dir: "asc" | "desc"; ic: string }[]
          ).map((o) => (
            <Button
              key={o.lbl}
              size="sm"
              className="mb-1 w-full justify-start"
              variant={filters.sort?.field === o.fld && filters.sort?.direction === o.dir ? "solid" : "bordered"}
              color={filters.sort?.field === o.fld && filters.sort?.direction === o.dir ? "primary" : "default"}
              startContent={<Icon icon={o.ic} width={16} />}
              onPress={() =>
                onFiltersChange({
                  ...filters,
                  sort: { field: o.fld, direction: o.dir },
                })
              }
            >
              {o.lbl}
            </Button>
          ))}
        </section>
      </PopoverContent>
    </Popover>
  );
};
