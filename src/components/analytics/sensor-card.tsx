import React from "react";
import { Card, CardBody, Checkbox, Badge, Tooltip, Spinner, useDisclosure, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDistanceToNow } from "date-fns";
import { useDispatch } from "react-redux";
import { formatNumericValue } from "../../utils/numberUtils";
import { Sensor } from "../../types/sensor";
import { DeleteSensorModal } from "../DeleteSensorModal";
import { AppDispatch } from "../../store";
import { unclaimSensor } from "../../store/sensorsSlice";
import { getBatteryLevel, getBatteryColor, getBatteryIcon, getBatteryIconComponent, isLowBattery, getBatteryCardClass, formatBatteryDisplay } from "../../utils/battery";
import { BatteryIconWithCells } from "./BatteryIconWithCells";

interface SensorCardProps {
  sensor: Sensor;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStar: (mac: string) => Promise<void> | void;
  isComparing: boolean;
  isChecked: boolean;
  onCheckChange: (checked: boolean) => void;
  onSensorUpdated: () => void; // Added prop
  isDataLoading?: boolean; // Add loading state prop
}

export const SensorCard: React.FC<SensorCardProps> = ({
  sensor,
  isSelected,
  onSelect,
  onToggleStar,
  isComparing,
  isChecked,
  onCheckChange,
  onSensorUpdated, // Added prop
  isDataLoading = false, // Add loading state with default
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [starLoading, setStarLoading] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [isLocallyChecked, setIsLocallyChecked] = React.useState(isChecked); // Local state for immediate feedback
  const [showDataLoading, setShowDataLoading] = React.useState(false); // Delayed loading state
  const loadingTimeoutRef = React.useRef<NodeJS.Timeout>();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

  // DEBUG: Log when component renders and sensor status changes
  React.useEffect(() => {
    console.log(`[SensorCard] DEBUG: Rendering card for ${sensor.mac} - status: ${sensor.status}, isOnline: ${sensor.isOnline}`);
  }, [sensor.mac, sensor.status, sensor.isOnline]);

  // Sync local state with prop when it changes
  React.useEffect(() => {
    setIsLocallyChecked(isChecked);
  }, [isChecked]);

  // Handle delayed loading overlay to prevent UI blocking
  React.useEffect(() => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    if (isDataLoading) {
      // Only show loading overlay after a delay to allow UI to render selection feedback first
      loadingTimeoutRef.current = setTimeout(() => {
        setShowDataLoading(true);
      }, 300); // 300ms delay before showing loading overlay
    } else {
      setShowDataLoading(false);
    }

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [isDataLoading]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Memoize type icon to prevent recalculation
  const typeIcon = React.useMemo(() => {
    switch (sensor.type) {
      case "temperature":
        return "lucide:thermometer";
      case "humidity":
        return "lucide:droplets";
      case "pressure":
        return "lucide:gauge";
      case "co2":
        return "lucide:wind";
      default:
        return "lucide:sensor";
    }
  }, [sensor.type]);

  // Memoize formatted dates to prevent recalculation
  const formattedDates = React.useMemo(() => ({
    lastSeen: new Date(sensor.lastSeen).toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }),
    firstSeenTooltip: new Date(sensor.firstSeen).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    firstSeenDistance: formatDistanceToNow(new Date(sensor.firstSeen), { addSuffix: false })
  }), [sensor.lastSeen, sensor.firstSeen]);

  // Optimize card styling with memoization
  const cardClassName = React.useMemo(() => {
    const baseClasses = "w-full relative";
    const borderClasses = isSelected || (isComparing && isLocallyChecked) ? "border-primary border-2" : "";
    const loadingClasses = showDataLoading ? "opacity-70" : "";
    const batteryClasses = getBatteryCardClass(sensor.battery);
    return `${baseClasses} ${borderClasses} ${loadingClasses} ${batteryClasses}`.trim();
  }, [isSelected, isComparing, isLocallyChecked, showDataLoading, sensor.battery]);

  // Use useCallback for event handlers to prevent unnecessary re-renders
  const handleStarClick = React.useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStarLoading(true);
    try {
      await onToggleStar(sensor.mac);
    } finally {
      setStarLoading(false);
    }
  }, [onToggleStar, sensor.mac]);

  const handleDeleteClick = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteOpen();
  }, [onDeleteOpen]);

  const handleDeleteConfirm = React.useCallback(async () => {
    setDeleteLoading(true);
    try {
      await dispatch(unclaimSensor(sensor.mac)).unwrap();
      addToast({
        title: "Sensor unclaimed",
        description: `Sensor ${sensor.displayName || sensor.mac} has been successfully unclaimed.`,
        color: "success",
      });
      onDeleteClose();
      onSensorUpdated();
    } catch (error: any) {
      addToast({
        title: "Unclaim failed",
        description: error.message || "Failed to unclaim sensor. Please try again.",
        color: "danger",
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [dispatch, sensor.mac, sensor.displayName, onDeleteClose, onSensorUpdated]);

  // Optimize checkbox change handler with immediate local feedback
  const handleCheckboxChange = React.useCallback((checked: boolean) => {
    // Update local state immediately for instant visual feedback
    setIsLocallyChecked(checked);
    
    // Use setTimeout to ensure UI updates before any heavy operations
    setTimeout(() => onCheckChange(checked), 0);
  }, [onCheckChange]);

  return (
    <>
      {/* Online/Offline Status Badge - Outside card, top-left corner */}
      <div className="relative">
        <div className="absolute -top-1 -left-1 z-50">
          <Tooltip content={sensor.isOnline ? "Sensor is online" : "Sensor is offline"}>
            <div className="flex items-center bg-background rounded-full px-1 py-1 border-2 border-primary-100">
              <div className={`w-2 h-2 rounded-full ${
                sensor.isOnline === false ? 'bg-danger animate-pulse' : 
                sensor.isOnline === true ? 'bg-success animate-pulse' : 
                'bg-warning'
              }`} />
              <span className={`text-xs font-medium ${
                sensor.isOnline === false ? 'text-danger' : 
                sensor.isOnline === true ? 'text-success' : 
                'text-warning'
              }`}>
                {/* {sensor.isOnline === false ? 'OFFLINE' : "LIVE"} */}
              </span>
            </div>
          </Tooltip>
        </div>
        
        <Card
          isPressable={!isComparing}
          onPress={isComparing ? undefined : onSelect}
          className={cardClassName}
        >
          <CardBody className="p-3 relative">
            {/* Only show loading overlay after delay and when data is actually loading */}
            {showDataLoading && (
              <div className="absolute inset-0 bg-background/30 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-lg">
                <Spinner size="sm" color="primary" />
              </div>
            )}

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Icon icon={typeIcon} className="text-primary-500" width={24} />
                <div>
                  <h3 className="text-sm font-semibold">{sensor.displayName || sensor.name}</h3>
                  <p className="text-xs text-default-500">{sensor.mac}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">{isComparing ? (
                  <Checkbox 
                    isSelected={isLocallyChecked} // Use local state for immediate feedback
                    onValueChange={handleCheckboxChange} 
                    size="sm"
                    className="z-20" // Ensure checkbox is above loading overlay
                  />
                ) : starLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <>
                    <Icon
                      icon={sensor.favorite ? "mdi:star" : "mdi:star-outline"}
                      className={`cursor-pointer ${sensor.favorite ? "text-warning" : "text-default-400"}`}
                      style={sensor.favorite ? { color: "#fbbf24" } : {}}
                      onClick={handleStarClick}
                    />
                    <Icon
                      icon="lucide:trash"
                      className="cursor-pointer text-danger"
                      onClick={handleDeleteClick}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <Badge color="primary" variant="flat">
                {formatNumericValue(sensor.lastValue, 4)} {sensor.unit}
              </Badge>
              <span className="text-xs text-default-500">
                {new Date(sensor.lastSeen).toLocaleString("en-US", {
                  month: "numeric",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                })}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-default-500">
              <Tooltip content={`First seen: ${formattedDates.firstSeenTooltip}`}>
                <span>{formattedDates.firstSeenDistance}</span>
              </Tooltip>
              {/* Battery indicator with visual cells */}
              <Tooltip content={sensor.battery !== undefined ? `Battery: ${sensor.battery}%` : "Battery: Status unknown"}>
                <div className="flex items-center gap-1">
                  <BatteryIconWithCells 
                    battery={sensor.battery}
                    size={16}
                  />
                  {sensor.battery !== undefined && (
                    <span className={`text-xs ${getBatteryColor(sensor.battery)}`}>
                      {formatBatteryDisplay(sensor.battery)}
                    </span>
                  )}
                </div>
              </Tooltip>
            </div>

            {sensor.ignored && (
              <Badge color="danger" variant="flat" className="mt-2">
                Ignored
              </Badge>
            )}
          </CardBody>
        </Card>
      </div>
      
      <DeleteSensorModal
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onConfirm={handleDeleteConfirm}
        sensorName={sensor.displayName || sensor.mac}
        sensorMac={sensor.mac}
        isLoading={deleteLoading}
      />
    </>
  );
};

// Add display name for debugging
SensorCard.displayName = 'SensorCard';
