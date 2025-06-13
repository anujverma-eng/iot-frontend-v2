import React from "react";
import { Card, CardBody, Checkbox, Badge, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDistanceToNow } from "date-fns";
import { Sensor } from "../../types/sensor";

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
  onCheckChange,
}) => {
  const getTypeIcon = (type: string) => {
    switch (type) {
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
  };
  const isLive = () => {
    const lastSeen = new Date(sensor.lastSeen);
    const today = new Date();
    return lastSeen.toDateString() === today.toDateString();
  };


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Card
      isPressable={!isComparing}
      onPress={isComparing ? undefined : onSelect}
      className={`w-full ${isSelected ? "border-primary border-2" : ""}`}
    >
      <CardBody className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon icon={getTypeIcon(sensor.type)} className="text-primary-500" width={24} />
            <div>
              <h3 className="text-sm font-semibold">{sensor.displayName || sensor.name}</h3>
              <p className="text-xs text-default-500">{sensor.mac}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isComparing ? (
              <Checkbox isSelected={isChecked} onValueChange={onCheckChange} size="sm" />
            ) : (
              <Icon
                icon="lucide:star"
                className={`cursor-pointer ${sensor.claimed ? "text-warning fill-warning" : "text-default-400"}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleStar();
                }}
              />
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <Badge color="primary" variant="flat">
            {sensor.lastValue.toFixed(1)} {sensor.unit}
          </Badge>
          <span className="text-xs text-default-500">
            {formatDistanceToNow(new Date(sensor.lastSeen), { addSuffix: true })}
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-default-500">
          <Tooltip content={`First seen: ${formatDate(sensor.firstSeen)}`}>
            <span>{formatDistanceToNow(new Date(sensor.firstSeen), { addSuffix: false })}</span>
          </Tooltip>
          {sensor.lastSeenBy && sensor.lastSeenBy.length > 0 ? (
            <Tooltip content={`Last seen by: ${sensor.lastSeenBy.join(", ")}`}>
              <Badge variant="flat" color="secondary" size="sm">
                {sensor.lastSeenBy.length} GW
              </Badge>
            </Tooltip>
          ) : (
            <Badge variant="flat" color="secondary" size="sm">
              No GW
            </Badge>
          )}
        </div>

        {sensor.ignored && (
          <Badge color="danger" variant="flat" className="mt-2">
            Ignored
          </Badge>
        )}
      </CardBody>
    </Card>
  );
};
