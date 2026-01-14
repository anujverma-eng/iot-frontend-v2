import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Spinner,
  Switch,
  Badge,
  Input,
  Tooltip,
  Skeleton,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch } from "../../store";
import {
  fetchGatewayDetails,
  fetchGatewaySensors,
  updateGatewayLabel,
  selectGatewayDetail,
  selectGatewaySensors,
  selectGatewayDetailPagination,
  selectGatewayDetailFilters,
  gatewayDetailIsBusy,
  gatewaySensorsIsBusy,
  setDetailShowClaimed,
  setDetailPage,
  setDetailSearchQuery,
  setDetailSort,
  clearDetail,
  fetchGateways,
} from "../../store/gatewaySlice";
import { debounce } from "../../utils/debounce";
import { PermissionWrapper } from "../PermissionWrapper";
import { usePermissions } from "../../hooks/usePermissions";

interface GatewayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  gatewayId: string;
}

export const GatewayDetailModal: React.FC<GatewayDetailModalProps> = ({ isOpen, onClose, gatewayId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission } = usePermissions();
  const gateway = useSelector(selectGatewayDetail);
  const sensors = useSelector(selectGatewaySensors);
  const pagination = useSelector(selectGatewayDetailPagination);
  const { showClaimed, searchQuery, sortColumn, sortDirection } = useSelector(selectGatewayDetailFilters);
  const isGatewayLoading = useSelector(gatewayDetailIsBusy);
  const isSensorsLoading = useSelector(gatewaySensorsIsBusy);
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [labelValue, setLabelValue] = React.useState("");
  const [editingLocation, setEditingLocation] = React.useState(false);
  const [locationValue, setLocationValue] = React.useState("");
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [isSavingLabel, setIsSavingLabel] = React.useState(false);
  const [isSavingLocation, setIsSavingLocation] = React.useState(false);

  // Check permission first
  if (!hasPermission("gateways.details")) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="md">
        <ModalContent>
          <ModalHeader>Access Denied</ModalHeader>
          <ModalBody>
            <div className="flex flex-col items-center py-8 space-y-4">
              <Icon icon="lucide:shield-x" className="w-16 h-16 text-danger" />
              <div className="text-center">
                <h3 className="text-lg font-semibold">Permission Required</h3>
                <p className="text-default-500 mt-2">You don't have permission to view gateway details.</p>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onPress={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  const displaySensors = sensors;

  const fetchGatewayData = React.useCallback(() => {
    return dispatch(fetchGatewayDetails(gatewayId)).unwrap();
  }, [dispatch, gatewayId]);

  const fetchSensorsData = React.useCallback(() => {
    return dispatch(
      fetchGatewaySensors({
        id: gatewayId,
        claimed: showClaimed,
        page: pagination.page,
        limit: 10,
        search: searchQuery,
        sort: sortColumn || undefined,
        dir: sortDirection,
      })
    ).unwrap();
  }, [dispatch, gatewayId, showClaimed, pagination.page, searchQuery, sortColumn, sortDirection]);

  const debouncedSearch = React.useMemo(
    () =>
      debounce((value: string) => {
        dispatch(setDetailSearchQuery(value));
      }, 500),
    [dispatch]
  );

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      dispatch(setDetailSort({ column, direction: sortDirection === "asc" ? "desc" : "asc" }));
    } else {
      dispatch(setDetailSort({ column, direction: "asc" }));
    }
  };

  const handleSaveLabel = async () => {
    if (!gateway) return;

    setIsSavingLabel(true);
    try {
      // Update the label
      await dispatch(updateGatewayLabel({ id: gatewayId, label: labelValue })).unwrap();

      // Wait for both operations to complete
      await Promise.all([
        fetchGatewayData(),
        dispatch(
          fetchGateways({
            page: 1,
            limit: 20,
            search: "",
          })
        ).unwrap(),
      ]);

      setEditingLabel(false);
    } catch (error) {

    } finally {
      setIsSavingLabel(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!gateway) return;

    setIsSavingLocation(true);
    try {
      // Update the location
      await dispatch(updateGatewayLabel({ id: gatewayId, location: locationValue })).unwrap();

      // Wait for both operations to complete
      await Promise.all([
        fetchGatewayData(),
        dispatch(
          fetchGateways({
            page: 1,
            limit: 20,
            search: "",
          })
        ).unwrap(),
      ]);

      setEditingLocation(false);
    } catch (error) {

    } finally {
      setIsSavingLocation(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  // Initial data fetch
  React.useEffect(() => {
    if (isOpen && gatewayId) {
      setIsInitialLoad(true);
      Promise.all([fetchGatewayData(), fetchSensorsData()]).finally(() => {
        setIsInitialLoad(false);
      });
    }
    return () => {
      dispatch(clearDetail());
    };
  }, [isOpen, gatewayId]);

  // Handle filter changes
  React.useEffect(() => {
    if (isOpen && gatewayId && !isInitialLoad) {
      fetchSensorsData();
    }
  }, [showClaimed, pagination.page, searchQuery, sortColumn, sortDirection, isInitialLoad]);

  // Update label and location values when gateway changes
  React.useEffect(() => {
    if (gateway) {
      setLabelValue(gateway.label || "");
      setLocationValue(gateway.location || "");
    }
  }, [gateway?.label, gateway?.location]);

  const handleToggleClaimed = (value: boolean) => {
    dispatch(setDetailShowClaimed(value));
  };

  const renderCell = React.useCallback((sensor: any, columnKey: string) => {
    switch (columnKey) {
      case "mac":
        return (
          <div className="flex flex-col min-w-0">
            <p className="text-bold text-small truncate">{sensor.displayName || sensor.mac}</p>
            {sensor.mac && sensor.displayName ? (
              <p className="text-bold text-tiny text-default-400 truncate">{sensor.mac}</p>
            ) : (
              <p className="text-bold text-tiny text-default-400 truncate">{sensor.displayName}</p>
            )}
          </div>
        );
      case "type":
        const getTypeColor = (type: string) => {
          switch (type) {
            case "temperature": return "primary";
            case "humidity": return "secondary";
            case "pressure": return "success";
            case "light": return "warning";
            case "motion": return "danger";
            case "air_quality": return "primary";
            case "vibration": return "secondary";
            case "sound": return "success";
            case "co2": return "warning";
            default: return "default";
          }
        };
        
        return (
          <Chip
            className="capitalize"
            color={getTypeColor(sensor.type) as any}
            size="sm"
            variant="flat"
          >
            {sensor.type.replace(/_/g, ' ')}
          </Chip>
        );
      case "lastValue":
        return (
          <div className="text-sm">
            {sensor?.lastValue ? (
              <span className="block truncate">
                {sensor?.lastValue?.toFixed(2) || "N/A"} <span className="text-xs text-default-400">{sensor?.unit}</span>
              </span>
            ) : (
              "N/A"
            )}
          </div>
        );
      case "lastSeen":
        return (
          <div className="text-sm truncate">
            {sensor.lastSeen ? formatDistanceToNow(new Date(sensor.lastSeen), { addSuffix: true }) : "Never"}
          </div>
        );
      default:
        return sensor[columnKey];
    }
  }, []);

  const renderSkeletonHeader = () => (
    <div className="flex flex-col gap-3">
      {/* Top row skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-6 w-6 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-lg" />
          <Skeleton className="h-6 w-20 rounded-lg" />
        </div>
      </div>
      {/* Bottom row skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-40 rounded-lg" /> {/* Location highlight box */}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Skeleton className="h-4 w-32 rounded-lg" />
          <Skeleton className="h-6 w-6 rounded-lg" />
        </div>
      </div>
    </div>
  );

  const renderSkeletonStats = () => (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-lg" />
        </div>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        <Skeleton className="h-4 w-20 rounded-lg" />
        <Skeleton className="h-6 w-10 rounded-lg" />
        <Skeleton className="h-4 w-16 rounded-lg" />
      </div>
    </div>
  );

  const renderSkeletonTable = () => (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-lg" />
      <div className="overflow-x-auto">
        <div className="min-w-[600px] space-y-2">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="flex gap-4">
              <Skeleton className="h-12 w-1/4 rounded-lg" />
              <Skeleton className="h-12 w-1/4 rounded-lg" />
              <Skeleton className="h-12 w-1/4 rounded-lg" />
              <Skeleton className="h-12 w-1/4 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const handlePageChange = (page: number) => {
    dispatch(setDetailPage(page));
    // The fetchSensorsData will be triggered by the useEffect
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="3xl" 
      scrollBehavior="inside"
      classNames={{
        base: "h-[95vh] max-h-[95vh] sm:h-auto sm:max-h-[90vh]",
        wrapper: "p-2 sm:p-4",
        body: "p-0",
        footer: "flex-shrink-0"
      }}
    >
      <ModalContent className="flex flex-col max-h-full">
        {(onClose) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }}
            className="flex flex-col h-full max-h-full"
          >
            <ModalHeader className="flex-shrink-0 px-4 sm:px-6">
              <div className="flex flex-col gap-1 w-full">
                {isGatewayLoading && !gateway ? (
                  renderSkeletonHeader()
                ) : gateway ? (
                  <div className="flex flex-col gap-3">
                    {/* Top row - Gateway title and actions */}
                    {!editingLabel ? (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-lg font-semibold truncate">{gateway.label || gateway.mac}</span>
                          <PermissionWrapper permissions={["gateways.update"]}>
                            <Button isIconOnly size="sm" variant="light" onPress={() => setEditingLabel(true)}>
                              <Icon icon="lucide:edit-3" width={16} height={16} />
                            </Button>
                          </PermissionWrapper>
                        </div>
                        <div className="flex items-center gap-2 mr-5">
                          <Tooltip content="Copy Gateway Id">
                            <Button isIconOnly size="sm" variant="light" onPress={() => copyToClipboard(gateway?._id)}>
                              <Icon icon="lucide:copy" width={16} height={16} />
                            </Button>
                          </Tooltip>
                          <Chip
                            className="capitalize"
                            color={gateway.status === "active" ? "success" : "warning"}
                            size="sm"
                            variant="flat"
                          >
                            {gateway.status}
                          </Chip>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Input
                          size="sm"
                          placeholder="Enter gateway label"
                          value={labelValue}
                          onChange={(e) => setLabelValue(e.target.value)}
                          className="flex-1"
                          autoFocus
                          isDisabled={isSavingLabel}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" color="primary" onPress={handleSaveLabel} isLoading={isSavingLabel}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            onPress={() => {
                              setEditingLabel(false);
                              setLabelValue(gateway.label || "");
                            }}
                            isDisabled={isSavingLabel}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Bottom row - Location and MAC/ID */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* Left side - Location with highlight */}
                      <div className="flex items-center gap-2 order-1 sm:order-none">
                        {!editingLocation ? (
                          <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 rounded-lg border border-primary-100 flex-1 sm:flex-none">
                            <Icon icon="lucide:map-pin" className="w-4 h-4 text-primary-500 flex-shrink-0" />
                            <span className="text-sm font-medium text-primary-700 truncate">
                              {gateway.location || "No location"}
                            </span>
                            <PermissionWrapper permissions={["gateways.update"]}>
                              <Button 
                                isIconOnly 
                                size="sm" 
                                variant="light" 
                                onPress={() => setEditingLocation(true)}
                                isDisabled={editingLabel || isSavingLabel}
                                className="ml-1 h-6 w-6 min-w-unit-6 flex-shrink-0"
                              >
                                <Icon icon="lucide:edit-3" width={12} height={12} className="text-primary-500" />
                              </Button>
                            </PermissionWrapper>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 bg-warning-50 rounded-lg border border-warning-200 w-full sm:w-auto">
                            <div className="flex items-center gap-2">
                              <Icon icon="lucide:map-pin" className="w-4 h-4 text-warning-600 flex-shrink-0" />
                              <Input
                                size="sm"
                                placeholder="Enter location"
                                value={locationValue}
                                onChange={(e) => setLocationValue(e.target.value)}
                                className="flex-1 sm:max-w-xs"
                                classNames={{
                                  inputWrapper: "h-8 min-h-unit-8",
                                  input: "text-sm"
                                }}
                                autoFocus
                                isDisabled={isSavingLocation}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                color="primary" 
                                onPress={handleSaveLocation} 
                                isLoading={isSavingLocation}
                                className="h-8 min-h-unit-8 px-3"
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="light"
                                onPress={() => {
                                  setEditingLocation(false);
                                  setLocationValue(gateway.location || "");
                                }}
                                isDisabled={isSavingLocation}
                                className="h-8 min-h-unit-8 px-3"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Right side - MAC and Gateway ID */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm text-default-500 order-2 sm:order-none">
                        <div className="flex items-center gap-1">
                          <span className="flex-shrink-0">MAC:</span>
                          <code className="text-xs bg-default-100 px-2 py-1 rounded truncate max-w-[200px] sm:max-w-none">{gateway.mac}</code>
                          <Tooltip content="Copy MAC Address">
                            <Button isIconOnly size="sm" variant="light" onPress={() => copyToClipboard(gateway?.mac)} className="flex-shrink-0">
                              <Icon icon="lucide:copy" width={14} height={14} />
                            </Button>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  "Gateway Details"
                )}
              </div>
            </ModalHeader>
            
            <ModalBody className="flex-1 min-h-0 px-4 sm:px-6 pb-0">
              <div className="flex flex-col h-full">
                {isGatewayLoading && !gateway ? (
                  <div className="space-y-4">
                    {renderSkeletonStats()}
                    {renderSkeletonTable()}
                  </div>
                ) : (
                  <>
                    {gateway && (
                      <div className="space-y-4 flex-shrink-0 pt-2 pb-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex items-center gap-2">
                              <Badge content={gateway.sensors?.claimed || 0} color="success">
                                <div className="h-8 w-8 rounded-full bg-success-100 flex items-center justify-center">
                                  <Icon icon="lucide:check" className="text-success-500" />
                                </div>
                              </Badge>
                              <span className="text-sm">Claimed</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge content={gateway.sensors?.unclaimed || 0} color="warning">
                                <div className="h-8 w-8 rounded-full bg-warning-100 flex items-center justify-center">
                                  <Icon icon="lucide:alert-circle" className="text-warning-500" />
                                </div>
                              </Badge>
                              <span className="text-sm">Unclaimed</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="text-sm">Unclaimed</span>
                            <Switch
                              isSelected={showClaimed}
                              onValueChange={handleToggleClaimed}
                              size="sm"
                              isDisabled={isSensorsLoading || isInitialLoad}
                            />
                            <span className="text-sm">Claimed</span>
                          </div>
                        </div>

                        <Input
                          className="w-full"
                          placeholder="Search sensors..."
                          startContent={<Icon icon="lucide:search" className="text-default-400" />}
                          onChange={(e) => debouncedSearch(e.target.value)}
                          size="sm"
                          isDisabled={isSensorsLoading || isInitialLoad}
                        />
                      </div>
                    )}

                    <div className="flex-1 min-h-0">
                      {isSensorsLoading ? (
                        <div className="flex justify-center items-center h-64">
                          <Spinner size="lg" />
                        </div>
                      ) : displaySensors.length > 0 ? (
                        <div className="w-full h-full overflow-hidden rounded-lg border border-divider">
                          <div className="w-full h-full max-h-[300px] sm:max-h-[450px] overflow-auto">
                            <Table 
                              removeWrapper 
                              aria-label="Sensors table" 
                              isStriped
                              classNames={{
                                base: "h-full",
                                table: "h-full min-w-[600px]",
                                thead: "sticky top-0 z-10",
                                tbody: "relative",
                                th: [
                                  "bg-background/70",
                                  "text-foreground/80", 
                                  "backdrop-blur-md",
                                  "backdrop-saturate-150",
                                  "border-b",
                                  "border-divider",
                                  "first:rounded-none",
                                  "last:rounded-none",
                                ].join(" "),
                                td: [
                                  "group-data-[first=true]:first:before:rounded-none",
                                  "group-data-[first=true]:last:before:rounded-none",
                                  "group-data-[middle=true]:before:rounded-none",
                                  "group-data-[last=true]:first:before:rounded-none",
                                  "group-data-[last=true]:last:before:rounded-none",
                                  "py-2 sm:py-3",
                                  "px-2 sm:px-3",
                                ].join(" "),
                                tr: "border-b border-divider last:border-b-0",
                              }}
                            >
                              <TableHeader>
                                <TableColumn key="mac" onClick={() => handleSort("mac")} className="cursor-pointer min-w-[180px]">
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
                                <TableColumn key="type" onClick={() => handleSort("type")} className="cursor-pointer min-w-[100px]">
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
                                  key="lastValue"
                                  onClick={() => handleSort("lastValue")}
                                  className="cursor-pointer min-w-[120px]"
                                >
                                  <div className="flex items-center gap-2">
                                    LAST VALUE
                                    {sortColumn === "lastValue" && (
                                      <Icon
                                        icon={sortDirection === "asc" ? "lucide:chevron-up" : "lucide:chevron-down"}
                                        className="text-default-500"
                                        width={16}
                                      />
                                    )}
                                  </div>
                                </TableColumn>
                                <TableColumn key="lastSeen" onClick={() => handleSort("lastSeen")} className="cursor-pointer min-w-[120px]">
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
                              </TableHeader>
                              <TableBody>
                                {displaySensors.map((sensor) => (
                                  <TableRow key={sensor._id}>
                                    {(columnKey) => (
                                      <TableCell>
                                        {columnKey === "mac" ? (
                                          <div className="flex items-center gap-2">
                                            {renderCell(sensor, columnKey.toString())}
                                            <Tooltip content="copy gateway-id">
                                              <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                onPress={() => copyToClipboard(sensor?._id)}
                                              >
                                                <Icon icon="lucide:copy" width={14} height={14} />
                                              </Button>
                                            </Tooltip>
                                          </div>
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
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                          <Icon icon="lucide:radio" className="w-16 h-16 text-default-300" />
                          <p className="text-default-500 text-center max-w-md">
                            {showClaimed
                              ? "No claimed sensors found for this gateway."
                              : "Nothing yet, keep the probe powered and within range."}
                          </p>
                          {searchQuery && (
                            <Button
                              variant="light"
                              color="primary"
                              onPress={() => {
                                dispatch(setDetailSearchQuery(""));
                                debouncedSearch("");
                              }}
                              startContent={<Icon icon="lucide:x" />}
                            >
                              Clear search
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </ModalBody>
            
            <ModalFooter className="flex flex-col sm:flex-row gap-3 px-4 sm:px-6 flex-shrink-0">
              {pagination.totalPages > 1 && (
                <div className="flex justify-center w-full sm:w-auto order-2 sm:order-1">
                  <Pagination
                    total={pagination.totalPages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    showControls
                    size="sm"
                    className="sm:flex-1"
                  />
                </div>
              )}
              <div className="hidden sm:flex justify-end order-1 sm:order-2">
                <Button color="primary" variant="light" onPress={onClose}>
                  Close
                </Button>
              </div>
            </ModalFooter>
          </motion.div>
        )}
      </ModalContent>
    </Modal>
  );
};
