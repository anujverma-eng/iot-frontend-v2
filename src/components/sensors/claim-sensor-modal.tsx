import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Input,
  Pagination,
  Spinner,
  Tooltip,
  Card,
  CardBody,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { addToast } from "@heroui/react";
import { Gateway } from "../../types/gateway";
import { Sensor } from "../../types/sensor";
import SensorService from "../../api/sensor.service";
import { debounce } from "../../utils/debounce";
import { GatewayService } from "../../api/gateway.service";

interface ClaimSensorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSensorClaimed: () => void;
  gateways: Gateway[];
}

export const ClaimSensorModal: React.FC<ClaimSensorModalProps> = ({ isOpen, onClose, onSensorClaimed, gateways }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [claimingMac, setClaimingMac] = React.useState<string | null>(null);
  const [displayName, setDisplayName] = React.useState<string>("");
  const [showUpgradePrompt, setShowUpgradePrompt] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [selectedGateway, setSelectedGateway] = React.useState<string | null>(null);
  const [gatewaySearchQuery, setGatewaySearchQuery] = React.useState("");
  const [allSensors, setAllSensors] = React.useState<Sensor[]>([]);
  const [filteredSensors, setFilteredSensors] = React.useState<Sensor[]>([]);
  const [cachedGateways, setCachedGateways] = React.useState<Gateway[]>([]);
  const [claimedSensorId, setClaimedSensorId] = React.useState<string | null>(null);
  const [showDisplayNameInput, setShowDisplayNameInput] = React.useState<string | null>(null);

  const fetchUnclaimedSensors = React.useCallback(async () => {
    setIsLoading(true);
    try {
      let response;
      if (selectedGateway) {
        console.log({ selectedGateway });
        response = (await GatewayService.getSensorsByGateway(selectedGateway, false, page, 10, searchQuery))?.data;
      } else {
        response = await SensorService.getSensors({ page, limit: 10, claimed: false, search: searchQuery });
      }

      // Store all sensors for client-side filtering
      setAllSensors(response.data);

      // Apply initial filtering
      applyFilters(response.data);

      // Set pagination info
      setTotalPages(response.pagination.totalPages);

      // Cache gateways after first load
      if (gateways.length > 0 && cachedGateways.length === 0) {
        setCachedGateways(gateways);
      }
    } catch (error) {
      console.error("Failed to fetch unclaimed sensors:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, selectedGateway]); // Only depend on page, searchQuery, and selectedGateway for API calls

  const applyFilters = React.useCallback(
    (sensors: Sensor[]) => {
      let filtered = [...sensors];

      // Apply sorting
      if (sortColumn) {
        filtered.sort((a, b) => {
          let valueA = a[sortColumn as keyof Sensor];
          let valueB = b[sortColumn as keyof Sensor];

          // Handle special cases
          if (sortColumn === "lastSeen") {
            valueA = new Date(valueA as string).getTime();
            valueB = new Date(valueB as string).getTime();
          } else if (sortColumn === "lastSeenBy") {
            valueA = (valueA as string[])?.length || 0;
            valueB = (valueB as string[])?.length || 0;
          }

          // Handle undefined values
          if (valueA === undefined && valueB === undefined) return 0;
          if (valueA === undefined) return sortDirection === "asc" ? 1 : -1;
          if (valueB === undefined) return sortDirection === "asc" ? -1 : 1;
          if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
          if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
          return 0;
        });
      }

      setFilteredSensors(filtered);
    },
    [sortColumn, sortDirection]
  );

  React.useEffect(() => {
    if (isOpen) {
      fetchUnclaimedSensors();
    }
  }, [isOpen, fetchUnclaimedSensors]);

  const debouncedSearch = React.useMemo(
    () =>
      debounce((value: string) => {
        setSearchQuery(value);
        setPage(1); // Reset to first page on new search
      }, 500),
    []
  );

  const debouncedGatewaySearch = React.useMemo(
    () =>
      debounce((value: string) => {
        setGatewaySearchQuery(value);
      }, 500),
    []
  );

  React.useEffect(() => {
    if (allSensors.length > 0) {
      applyFilters(allSensors);
    }
  }, [allSensors, sortColumn, sortDirection, applyFilters]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
    // No need to reset page or call API
  };

  const filteredGateways = React.useMemo(() => {
    const gatewaysToFilter = cachedGateways.length > 0 ? cachedGateways : gateways;
    if (!gatewaySearchQuery) return gatewaysToFilter;
    return gatewaysToFilter.filter(
      (gateway) =>
        gateway.mac.toLowerCase().includes(gatewaySearchQuery.toLowerCase()) ||
        (gateway.label && gateway.label.toLowerCase().includes(gatewaySearchQuery.toLowerCase()))
    );
  }, [cachedGateways, gateways, gatewaySearchQuery]);

  const copyToClipboard = (text: string, event: any) => {
    if (event?.stopPropagation) event.stopPropagation();
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const handleClaimSensor = async (mac: string) => {
    if (showDisplayNameInput === mac) {
      // If displayName input is already shown, proceed with claiming
      setClaimingMac(mac);
      try {
        const result = await SensorService.claimSensor(mac, displayName || undefined);
        console.log("Claim result:", result, result.error);
        if (result.success) {
          // Show success toast
          addToast({
            title: "Sensor claimed",
            description: displayName ? `Sensor ${displayName} added successfully` : "Sensor added successfully",
            color: "success",
          });

          // Highlight the claimed sensor briefly
          setClaimedSensorId(mac);
          setTimeout(() => {
            // Remove the sensor from the list
            setAllSensors((prev) => prev.filter((s) => s.mac !== mac));
            setClaimedSensorId(null);
            setShowDisplayNameInput(null);
            setDisplayName("");
          }, 1500);

          onSensorClaimed();
        }
      } catch (error: any) {
        const rawMsg = error.response?.data?.message ?? error.message ?? error;
        const errMsg = typeof rawMsg === "string" ? rawMsg : JSON.stringify(rawMsg?.message || rawMsg);

        if (errMsg === `"Sensor limit exceeded – upgrade plan."`) {
          setShowUpgradePrompt(true);
        } else if (errMsg) {
          setErrorMessage(errMsg);
          if (errMsg === "Sensor already claimed by another org") {
            setAllSensors((prev) => prev.filter((s) => s.mac !== mac));
          }
        }
      } finally {
        setClaimingMac(null);
      }
    } else {
      setShowDisplayNameInput(mac);
    }
  };

  const handleCancelDiplayName = () => {
    setShowDisplayNameInput(null);
    setDisplayName("");
  };

  const getGatewayLabels = (gatewayIds: string[]) => {
    const labels = gatewayIds.map((id) => {
      const gateway = gateways.find((g) => g._id === id);
      return gateway?.label || id.slice(-6);
    });

    if (labels.length <= 2) {
      return labels.join(", ");
    }

    return `${labels[0]} +${labels.length - 1}`;
  };

  const renderCell = React.useCallback(
    (sensor: Sensor, columnKey: string) => {
      switch (columnKey) {
        case "mac":
          return (
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <p className="text-bold text-small">{sensor.mac}</p>
              </div>
              <Tooltip content="Copy MAC address">
                <Button isIconOnly size="sm" variant="light" onPress={(e: any) => copyToClipboard(sensor.mac, e)}>
                  <Icon icon="lucide:copy" width={14} height={14} />
                </Button>
              </Tooltip>
            </div>
          );
        case "type":
          return (
            <Chip
              className="capitalize"
              color={sensor.type === "temperature" ? "primary" : "secondary"}
              size="sm"
              variant="flat"
            >
              {sensor.type}
            </Chip>
          );
        case "lastSeenBy":
          return sensor.lastSeenBy && sensor.lastSeenBy.length > 0 ? (
            <Tooltip content={sensor.lastSeenBy.join(", ")}>
              <span>{getGatewayLabels(sensor.lastSeenBy)}</span>
            </Tooltip>
          ) : (
            "Unknown"
          );
        case "lastSeen":
          return sensor.lastSeen ? formatDistanceToNow(new Date(sensor.lastSeen), { addSuffix: true }) : "Never";
        case "actions":
          return (
            <Button
              size="sm"
              color="primary"
              onPress={() => handleClaimSensor(sensor.mac)}
              isLoading={claimingMac === sensor.mac}
              isDisabled={showUpgradePrompt || claimingMac !== null}
            >
              Claim
            </Button>
          );
        default:
          return sensor[columnKey as keyof Sensor];
      }
    },
    [claimingMac, showUpgradePrompt, gateways]
  );

  return (
    <>
      <UpgradePlanModal open={showUpgradePrompt} onClose={() => setShowUpgradePrompt(false)} />
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="lg"
        backdrop="blur"
        scrollBehavior="inside"
        motionProps={{
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: 20 },
          transition: { duration: 0.3 },
        }}
      >
        <ModalContent className="max-w-full sm:max-w-3xl mx-auto sm:px-2">
          {(onClose) => (
            <div className="p-0 sm:p-2">
              <ModalHeader className="flex flex-col gap-1">Add Sensor</ModalHeader>
              <ModalBody className="max-h-[60vh] overflow-y-auto">
                {errorMessage && (
                  <div className="bg-danger-50 text-danger-500 p-3 rounded-md mb-4 flex items-center gap-2">
                    <Icon icon="lucide:alert-circle" />
                    <span>{errorMessage}</span>
                    <Button
                      size="sm"
                      isIconOnly
                      variant="light"
                      color="danger"
                      className="ml-auto"
                      onPress={() => setErrorMessage(null)}
                    >
                      <Icon icon="lucide:x" />
                    </Button>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Gateway selector */}
                  <Select
                    label="Filter by Gateway (Optional)"
                    placeholder="Choose a gateway to filter sensors"
                    selectedKeys={selectedGateway ? [selectedGateway] : []}
                    onSelectionChange={(keys) => {
                      const key = Array.from(keys)[0] as string;
                      setSelectedGateway(key || null);
                      setPage(1); // Reset to first page when gateway changes
                    }}
                    className="mb-4"
                    startContent={<Icon icon="lucide:cpu" className="text-default-400" />}
                    isLoading={isLoading}
                  >
                    {filteredGateways.map((gateway) => (
                      <SelectItem key={gateway._id}>{gateway.label || gateway.mac}</SelectItem>
                    ))}
                  </Select>

                  {/* Search input */}
                  <Input
                    placeholder="Search unclaimed sensors..."
                    startContent={<Icon icon="lucide:search" className="text-default-400" />}
                    onChange={(e) => debouncedSearch(e.target.value)}
                    size="sm"
                    className="mb-2"
                  />
                </div>

                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <Spinner size="lg" />
                  </div>
                ) : filteredSensors.length > 0 ? (
                  <div className="space-y-4 overflow-x-auto">
                    <Table removeWrapper aria-label="Unclaimed sensors table" isStriped>
                      <TableHeader>
                        <TableColumn key="mac" onClick={() => handleSort("mac")} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            SENSOR
                            {sortColumn === "mac" && (
                              <Icon
                                icon={sortDirection === "asc" ? "lucide:chevron-up" : "lucide:chevron-down"}
                                className="text-default-500"
                                width={16}
                              />
                            )}
                          </div>
                        </TableColumn>
                        <TableColumn key="type" onClick={() => handleSort("type")} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            TYPE
                            {sortColumn === "type" && (
                              <Icon
                                icon={sortDirection === "asc" ? "lucide:chevron-up" : "lucide:chevron-down"}
                                className="text-default-500"
                                width={16}
                              />
                            )}
                          </div>
                        </TableColumn>
                        <TableColumn
                          key="lastSeenBy"
                          onClick={() => handleSort("lastSeenBy")}
                          className="cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            SEEN BY
                            {sortColumn === "lastSeenBy" && (
                              <Icon
                                icon={sortDirection === "asc" ? "lucide:chevron-up" : "lucide:chevron-down"}
                                className="text-default-500"
                                width={16}
                              />
                            )}
                          </div>
                        </TableColumn>
                        <TableColumn key="lastSeen" onClick={() => handleSort("lastSeen")} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            LAST SEEN
                            {sortColumn === "lastSeen" && (
                              <Icon
                                icon={sortDirection === "asc" ? "lucide:chevron-up" : "lucide:chevron-down"}
                                className="text-default-500"
                                width={16}
                              />
                            )}
                          </div>
                        </TableColumn>
                        <TableColumn key="actions">ACTIONS</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {filteredSensors.map((sensor) => (
                          <TableRow
                            key={sensor._id}
                            className={claimedSensorId === sensor.mac ? "bg-success-100 dark:bg-success-900/20" : ""}
                          >
                            {(columnKey) => (
                              <TableCell>
                                {columnKey === "actions" ? (
                                  showDisplayNameInput === sensor.mac ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        size="sm"
                                        placeholder="Display Name (optional)"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-36 max-w-[150px]"
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        color="primary"
                                        onPress={() => handleClaimSensor(sensor.mac)}
                                        isLoading={claimingMac === sensor.mac}
                                        isDisabled={showUpgradePrompt}
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="light"
                                        onPress={handleCancelDiplayName}
                                        isDisabled={claimingMac === sensor.mac}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      color="primary"
                                      onPress={() => handleClaimSensor(sensor.mac)}
                                      isDisabled={showUpgradePrompt || claimingMac !== null}
                                      className="transition-transform hover:scale-105"
                                    >
                                      Claim
                                    </Button>
                                  )
                                ) : (
                                  renderCell(sensor, columnKey.toString())
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Icon icon="lucide:radio" className="w-16 h-16 text-default-300" />
                    <p className="text-default-500 text-center max-w-md">
                      No new probes found – walk the gateway near your sensors and check again.
                    </p>
                    {(searchQuery || selectedGateway) && (
                      <Button
                        variant="light"
                        color="primary"
                        onPress={() => {
                          setSearchQuery("");
                          debouncedSearch("");
                          setSelectedGateway(null);
                        }}
                        startContent={<Icon icon="lucide:x" />}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                {totalPages > 1 && (
                  <div className="justify-between flex items-center w-full">
                    <Pagination total={totalPages} page={page} onChange={setPage} showControls />
                  </div>
                )}
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={onClose}>
                  Done
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

/* ────────────────── 1.  tiny modal component ────────────────── */
const UpgradePlanModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Modal isOpen={open} onClose={onClose} size="md" backdrop="blur">
    <ModalContent>
      {() => (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
        >
          <ModalHeader>Upgrade your plan</ModalHeader>
          <ModalBody className="space-y-6">
            <Card className="bg-gradient-to-r from-primary-100 to-primary-50">
              <CardBody className="flex flex-col items-center gap-4 py-8">
                <Icon icon="lucide:zap" className="h-16 w-16 text-primary-500" />
                <h3 className="text-xl font-semibold">Sensor limit reached</h3>
                <p className="text-center text-default-700">
                  You’ve reached the maximum number of sensors on your current plan. Upgrade to add more and unlock
                  extra features.
                </p>
                <Button color="primary" size="lg" className="mt-2">
                  Upgrade now
                </Button>
              </CardBody>
            </Card>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Close
            </Button>
          </ModalFooter>
        </motion.div>
      )}
    </ModalContent>
  </Modal>
);
