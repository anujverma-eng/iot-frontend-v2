// components/analytics/FilterBar.tsx
import { Button, Divider, Popover, PopoverContent, PopoverTrigger } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { sensorTypes, statusOptions } from "../../data/analytics";
import type { FilterState, SensorStatus, SensorType } from "../../types/sensor";

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  isMobile?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, onFiltersChange, isMobile = false }) => {
  const [open, setOpen] = React.useState(false);
  const [pendingFilters, setPendingFilters] = React.useState<FilterState>(filters);

  // Update pending filters when props change
  React.useEffect(() => {
    setPendingFilters(filters);
  }, [filters]);

  const setTypes = (next: SensorType[]) => {
    const updated = { ...pendingFilters, types: next };
    setPendingFilters(updated);
    // On mobile, apply immediately
    if (isMobile) {
      onFiltersChange(updated);
    }
  };

  const setStatus = (next: SensorStatus | "all") => {
    const updated = { ...pendingFilters, status: next };
    setPendingFilters(updated);
    // On mobile, apply immediately
    if (isMobile) {
      onFiltersChange(updated);
    }
  };

  const setSort = (field: string, direction: "asc" | "desc") => {
    const updated = { ...pendingFilters, sort: { field, direction } };
    setPendingFilters(updated);
    // On mobile, apply immediately
    if (isMobile) {
      onFiltersChange(updated);
    }
  };

  const handleApply = () => {
    onFiltersChange(pendingFilters);
    setOpen(false);
  };

  const handleCancel = () => {
    setPendingFilters(filters);
    setOpen(false);
  };

  const handleReset = () => {
    const resetFilters: FilterState = {
      ...pendingFilters,
      types: [],
      status: "all",
      sort: undefined,
    };
    setPendingFilters(resetFilters);
    // On mobile, apply immediately
    if (isMobile) {
      onFiltersChange(resetFilters);
    }
  };

  const activeFiltersCount = 
    pendingFilters.types.length + 
    (pendingFilters.status !== "all" ? 1 : 0) + 
    (pendingFilters.sort ? 1 : 0);

  return (
    <Popover 
      isOpen={open} 
      onOpenChange={setOpen} 
      placement="bottom-start"
      offset={10}
    >
      <PopoverTrigger>
        <Button
          size="sm"
          variant="flat"
          startContent={<Icon icon="lucide:filter" width={16} />}
          endContent={activeFiltersCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {activeFiltersCount}
            </span>
          )}
        >
          Filter
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        {/* SENSOR TYPE SECTION */}
        <section>
          <h4 className="text-xs font-semibold text-default-600 mb-2 tracking-wide">Sensor Type</h4>
          <div className="flex flex-wrap gap-2">
            {sensorTypes.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={pendingFilters.types.includes(t.value as SensorType) ? "solid" : "bordered"}
                color={pendingFilters.types.includes(t.value as SensorType) ? "primary" : "default"}
                onPress={() =>
                  setTypes(
                    pendingFilters.types.includes(t.value as SensorType)
                      ? pendingFilters.types.filter((v) => v !== (t.value as SensorType))
                      : [...pendingFilters.types, t.value as SensorType]
                  )
                }
              >
                {t.label}
              </Button>
            ))}
          </div>
        </section>

        <Divider className="my-4" />

        {/* STATUS SECTION */}
        <section>
          <h4 className="text-xs font-semibold text-default-600 mb-2 tracking-wide">Status</h4>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((s) => (
              <Button
                key={s.value}
                size="sm"
                variant={pendingFilters.status === s.value ? "solid" : "bordered"}
                color={pendingFilters.status === s.value ? "primary" : "default"}
                onPress={() => setStatus(s.value as SensorStatus | "all")}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </section>

        <Divider className="my-4" />

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
              variant={pendingFilters.sort?.field === o.fld && pendingFilters.sort?.direction === o.dir ? "solid" : "bordered"}
              color={pendingFilters.sort?.field === o.fld && pendingFilters.sort?.direction === o.dir ? "primary" : "default"}
              startContent={<Icon icon={o.ic} width={16} />}
              onPress={() => setSort(o.fld, o.dir)}
            >
              {o.lbl}
            </Button>
          ))}
        </section>

        {/* ACTION BUTTONS - only show on desktop */}
        {!isMobile && (
          <>
            <Divider className="my-4" />
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
              >
                Apply
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
