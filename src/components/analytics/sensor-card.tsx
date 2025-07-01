import React from "react";
import { Card, CardBody, Checkbox, Badge, Tooltip, Spinner, useDisclosure, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDistanceToNow } from "date-fns";
import { useDispatch } from "react-redux";
import { Sensor } from "../../types/sensor";
import { DeleteSensorModal } from "../DeleteSensorModal";
import { AppDispatch } from "../../store";
import { unclaimSensor } from "../../store/sensorsSlice";

interface SensorCardProps {
  sensor: Sensor;
  isSelected: boolean;
  onSelect: () => void;
  onToggleStar: (mac: string) => Promise<void> | void;
  isComparing: boolean;
  isChecked: boolean;
  onCheckChange: (checked: boolean) => void;
  onSensorUpdated: () => void; // Added prop
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
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [starLoading, setStarLoading] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

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

  const handleStarClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStarLoading(true);
    try {
      await onToggleStar(sensor.mac);
    } finally {
      setStarLoading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteOpen();
  };

  const handleDeleteConfirm = async () => {
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
  };

  return (
    <>
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
              {sensor.lastValue.toFixed(4)} {sensor.unit}
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
            <Tooltip content={`First seen: ${formatDate(sensor.firstSeen)}`}>
              <span>{formatDistanceToNow(new Date(sensor.firstSeen), { addSuffix: false })}</span>
            </Tooltip>
          </div>

          {sensor.ignored && (
            <Badge color="danger" variant="flat" className="mt-2">
              Ignored
            </Badge>
          )}
        </CardBody>
      </Card>
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
