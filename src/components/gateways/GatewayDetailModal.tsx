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

interface GatewayDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  gatewayId: string;
}

export const GatewayDetailModal: React.FC<GatewayDetailModalProps> = ({ isOpen, onClose, gatewayId }) => {
  const dispatch = useDispatch<AppDispatch>();
  const gateway = useSelector(selectGatewayDetail);
  const sensors = useSelector(selectGatewaySensors);
  const pagination = useSelector(selectGatewayDetailPagination);
  const { showClaimed, searchQuery, sortColumn, sortDirection } = useSelector(selectGatewayDetailFilters);
  const isGatewayLoading = useSelector(gatewayDetailIsBusy);
  const isSensorsLoading = useSelector(gatewaySensorsIsBusy);
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [labelValue, setLabelValue] = React.useState("");
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [isSavingLabel, setIsSavingLabel] = React.useState(false);

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

  console.log({ gateway });

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
      console.error("Failed to update gateway label:", error);
    } finally {
      setIsSavingLabel(false);
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

  // Update label value when gateway changes
  React.useEffect(() => {
    if (gateway) {
      setLabelValue(gateway.label || "");
    }
  }, [gateway?.label]);

  const handleToggleClaimed = (value: boolean) => {
    dispatch(setDetailShowClaimed(value));
  };

  const renderCell = React.useCallback((sensor: any, columnKey: string) => {
    switch (columnKey) {
      case "mac":
        return (
          <div className="flex flex-col">
            <p className="text-bold text-small">{sensor.mac}</p>
            {sensor.displayName && <p className="text-bold text-tiny text-default-400">{sensor.displayName}</p>}
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
      case "lastValue":
        return sensor.lastValue ? `${sensor.lastValue.toFixed(1)} ${sensor.lastUnit}` : "N/A";
      case "lastSeen":
        return sensor.lastSeen ? formatDistanceToNow(new Date(sensor.lastSeen), { addSuffix: true }) : "Never";
      default:
        return sensor[columnKey];
    }
  }, []);

  const renderSkeletonHeader = () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <Skeleton className="h-6 w-6 rounded-lg" />
        <Skeleton className="h-6 w-6 rounded-lg" />
        <Skeleton className="h-6 w-20 rounded-lg" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-32 rounded-lg" />
        <Skeleton className="h-4 w-4 rounded-lg" />
      </div>
    </div>
  );

  const renderSkeletonStats = () => (
    <div className="flex justify-between items-center">
      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-16 rounded-lg" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-20 rounded-lg" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-20 rounded-lg" />
        <Skeleton className="h-6 w-10 rounded-lg" />
        <Skeleton className="h-4 w-16 rounded-lg" />
      </div>
    </div>
  );

  const renderSkeletonTable = () => (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-lg" />
      {[...Array(5)].map((_, index) => (
        <div key={index} className="flex gap-4">
          <Skeleton className="h-12 w-1/4 rounded-lg" />
          <Skeleton className="h-12 w-1/4 rounded-lg" />
          <Skeleton className="h-12 w-1/4 rounded-lg" />
          <Skeleton className="h-12 w-1/4 rounded-lg" />
        </div>
      ))}
    </div>
  );

  const handlePageChange = (page: number) => {
    dispatch(setDetailPage(page));
    // The fetchSensorsData will be triggered by the useEffect
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="3xl" backdrop="blur" scrollBehavior="inside">
      <ModalContent>
        {(onClose) => (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <ModalHeader className="flex flex-col gap-1">
              {isGatewayLoading && !gateway ? (
                renderSkeletonHeader()
              ) : gateway ? (
                <div className="flex flex-col">
                  {!editingLabel ? (
                    <div className="flex items-center gap-2">
                      <span>{gateway.label || gateway.mac}</span>
                      <Button isIconOnly size="sm" variant="light" onPress={() => setEditingLabel(true)}>
                        <Icon icon="lucide:edit-3" width={16} height={16} />
                      </Button>
                      <Tooltip content="Copy MAC address">
                        <Button isIconOnly size="sm" variant="light" onPress={() => copyToClipboard(gateway.mac)}>
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
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        size="sm"
                        placeholder="Enter gateway label"
                        value={labelValue}
                        onChange={(e) => setLabelValue(e.target.value)}
                        className="max-w-xs"
                        autoFocus
                        isDisabled={isSavingLabel}
                      />
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
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-default-500">{gateway.mac}</span>
                    <Tooltip content="Copy gateway ID">
                      <Button isIconOnly size="sm" variant="light" onPress={() => copyToClipboard(gateway._id)}>
                        <Icon icon="lucide:copy" width={14} height={14} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              ) : (
                "Gateway Details"
              )}
            </ModalHeader>
            <ModalBody className="max-h-[60vh] overflow-y-auto">
              {isGatewayLoading && !gateway ? (
                <div className="space-y-4">
                  {renderSkeletonStats()}
                  {renderSkeletonTable()}
                </div>
              ) : (
                <div className="space-y-4">
                  {gateway && (
                    <>
                      <div className="flex justify-between items-center">
                        <div className="flex gap-4">
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
                        <div className="flex items-center gap-2">
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
                    </>
                  )}

                  {isSensorsLoading ? (
                    <div className="flex justify-center items-center h-64">
                      <Spinner size="lg" />
                    </div>
                  ) : sensors.length > 0 ? (
                    <>
                      <Table removeWrapper aria-label="Sensors table" isStriped>
                        <TableHeader>
                          <TableColumn key="mac" onClick={() => handleSort("mac")} className="cursor-pointer">
                            <div className="flex items-center gap-2">
                              MAC ADDRESS
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
                            key="lastValue"
                            onClick={() => handleSort("lastValue")}
                            className="cursor-pointer"
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
                        </TableHeader>
                        <TableBody>
                          {sensors.map((sensor) => (
                            <TableRow key={sensor._id}>
                              {(columnKey) => (
                                <TableCell>
                                  {columnKey === "mac" ? (
                                    <div className="flex items-center gap-2">
                                      {renderCell(sensor, columnKey.toString())}
                                      <Tooltip content="Copy MAC address">
                                        <Button
                                          isIconOnly
                                          size="sm"
                                          variant="light"
                                          onPress={() => copyToClipboard(sensor.mac)}
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
                    </>
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
              )}
            </ModalBody>
            <ModalFooter>
              {pagination.totalPages > 1 && (
                <div className="justify-center flex w-full">
                  <Pagination
                    total={pagination.totalPages}
                    page={pagination.page}
                    onChange={handlePageChange}
                    showControls
                  />
                </div>
              )}
              <Button color="primary" variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </motion.div>
        )}
      </ModalContent>
    </Modal>
  );
};
