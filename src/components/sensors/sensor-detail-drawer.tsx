import React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Button,
  Input,
  Spinner,
  Card,
  CardBody,
  Divider,
  Tooltip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../../store";
import { fetchSensorDetails, selectSensorDetail, selectSensorDetailError, selectSensorDetailLoading, unclaimSensor, updateSensorLabel } from "../../store/sensorsSlice";
import { PermissionWrapper } from "../PermissionWrapper";
import { PermissionButton } from "../PermissionButton";

interface SensorDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sensorMac: string;
  onSensorUpdated: () => void;
}

export const SensorDetailDrawer: React.FC<SensorDetailDrawerProps> = ({
  isOpen,
  onClose,
  sensorMac,
  onSensorUpdated,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const [editingName, setEditingName] = React.useState(false);
  const [displayName, setDisplayName] = React.useState("");
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);

  const sensor = useSelector(selectSensorDetail);
  const isLoading = useSelector(selectSensorDetailLoading);
  const error = useSelector(selectSensorDetailError);

  const getSensorDetails = React.useCallback(async () => {
    if (!sensorMac) return;
    await dispatch(fetchSensorDetails(sensorMac));
  }, [dispatch, sensorMac]);

  React.useEffect(() => {
    if (isOpen && sensorMac) {
      getSensorDetails();
    }
  }, [isOpen, sensorMac, getSensorDetails]);

  React.useEffect(() => {
    if (sensor) {
      setDisplayName(sensor.displayName || "");
    }
  }, [sensor]);

  const handleSaveName = async () => {
    if (!sensor) return;
    try {
      await dispatch(updateSensorLabel({ mac: sensorMac, displayName })).unwrap();
      setEditingName(false);
      onSensorUpdated();
    } catch (error) {

    }
  };

  const handleUnclaimSensor = async () => {
    if (!sensor) return;
    try {
      await dispatch(unclaimSensor(sensorMac)).unwrap();
      setShowDeleteModal(false);
      onClose();
      onSensorUpdated();
    } catch (error) {

    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <Drawer 
        isOpen={isOpen} 
        onClose={onClose}
        placement="right"
        size="lg"
      >
        <DrawerContent>
          {(onClose) => (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <DrawerHeader className="flex flex-col gap-1">
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span>Loading sensor details...</span>
                  </div>
                ) : sensor ? (
                  <div className="flex flex-col">
                    {!editingName ? (
                      <div className="flex items-center gap-2">
                        <span>{sensor.displayName || sensor.mac}</span>
                        <PermissionButton
                          permissions={["sensors.update"]}
                          isIconOnly 
                          size="sm" 
                          variant="light" 
                          onPress={() => setEditingName(true)}
                          lockedTooltip="You don't have permission to edit sensor name"
                        >
                          <Icon icon="lucide:edit-3" height={16} width={16} />
                        </PermissionButton>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          size="sm"
                          placeholder="Enter sensor name"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="max-w-xs"
                          autoFocus
                        />
                        <Button 
                          size="sm" 
                          color="primary"
                          onPress={handleSaveName}
                        >
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="light"
                          onPress={() => {
                            setEditingName(false);
                            setDisplayName(sensor.displayName || "");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-default-500">
                        {sensor.mac}
                      </span>
                      <Tooltip content="Copy MAC address">
                        <Button 
                          isIconOnly 
                          size="sm" 
                          variant="light" 
                          onPress={() => copyToClipboard(sensor.mac)}
                        >
                          <Icon icon="lucide:copy" height={14} width={14} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                ) : (
                  "Sensor Details"
                )}
              </DrawerHeader>
              <DrawerBody>
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Spinner size="lg" />
                  </div>
                ) : sensor ? (
                  <div className="space-y-6">
                    <Card>
                      <CardBody className="flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-default-500">Type</span>
                          <span className="font-medium">{sensor.type}</span>
                        </div>
                        <Divider />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-default-500">Last Value</span>
                          <span className="font-medium">{sensor?.lastValue?.toFixed(4)} {sensor?.unit}</span>
                        </div>
                        <Divider />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-default-500">Last Seen</span>
                          <span className="font-medium">
                            {formatDistanceToNow(new Date(sensor.lastSeen), { addSuffix: true })}
                          </span>
                        </div>
                        <Divider />
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-default-500">Ignored</span>
                          <span className="font-medium">{sensor.ignored ? "Yes" : "No"}</span>
                        </div>
                        {sensor.lastSeenBy && sensor.lastSeenBy.length > 0 && (
                          <>
                            <Divider />
                            <div className="flex flex-col gap-2">
                              <span className="text-sm text-default-500">Seen By Gateways</span>
                              <div className="flex flex-col gap-1">
                                {sensor.lastSeenBy.map((gatewayId) => (
                                  <div key={gatewayId} className="flex items-center gap-2">
                                    <Icon icon="lucide:cpu" className="text-default-400" height={14} width={14} />
                                    <span className="text-sm">{gatewayId}</span>
                                    <Tooltip content="Copy Gateway ID">
                                      <Button 
                                        isIconOnly 
                                        size="sm" 
                                        variant="light" 
                                        onPress={() => copyToClipboard(gatewayId)}
                                      >
                                        <Icon icon="lucide:copy" height={14} width={14} />
                                      </Button>
                                    </Tooltip>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </CardBody>
                    </Card>
                    
                    <Card className="bg-danger-50 dark:bg-danger-900/20">
                      <CardBody>
                        <div className="flex flex-col gap-4">
                          <div className="flex items-start gap-3">
                            <div className="rounded-full bg-danger-100 p-2 dark:bg-danger-500/20">
                              <Icon icon="lucide:trash-2" className="text-danger-500" height={20} width={20} />
                            </div>
                            <div className="flex flex-col gap-1">
                              <h3 className="text-lg font-medium text-danger-600 dark:text-danger-400">
                                Danger Zone
                              </h3>
                              <p className="text-sm text-danger-600/80 dark:text-danger-400/80">
                                Unclaiming this sensor will remove all its data and make it available for others to claim.
                              </p>
                            </div>
                          </div>
                          <PermissionButton
                            permissions={["sensors.delete"]}
                            color="danger" 
                            variant="flat"
                            onPress={() => setShowDeleteModal(true)}
                            className="self-end"
                            lockedTooltip="You don't have permission to unclaim sensors"
                          >
                            Un-claim and Delete Data
                          </PermissionButton>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Icon icon="lucide:alert-circle" className="w-16 h-16 text-default-300" />
                    <p className="text-default-500 text-center">Sensor not found</p>
                  </div>
                )}
              </DrawerBody>
              <DrawerFooter>
                <Button 
                  color="primary" 
                  variant="light"
                  onPress={onClose}
                >
                  Close
                </Button>
              </DrawerFooter>
            </motion.div>
          )}
        </DrawerContent>
      </Drawer>
      
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <ModalContent>
          {(onClose) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <ModalHeader className="flex flex-col gap-1 text-danger-600">
                Confirm Un-claim
              </ModalHeader>
              <ModalBody>
                <p>
                  Are you sure you want to un-claim this sensor? This action will:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-sm">
                  <li>Remove all historical data for this sensor</li>
                  <li>Mark the sensor as ignored</li>
                  <li>Make it available for others to claim</li>
                </ul>
                <p className="mt-2 font-medium">This action cannot be undone.</p>
              </ModalBody>
              <ModalFooter>
                <Button 
                  variant="light" 
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button 
                  color="danger" 
                  onPress={handleUnclaimSensor}
                >
                  Un-claim Sensor
                </Button>
              </ModalFooter>
            </motion.div>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};
