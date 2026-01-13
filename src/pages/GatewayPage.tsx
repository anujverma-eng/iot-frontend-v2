import {
  addToast,
  Button,
  Card,
  CardBody,
  Chip,
  Pagination,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { DeleteGatewayConfirmationModal } from "../components/DeleteGatewayConfirmationModal";
import { GatewayDetailModal } from "../components/gateways/GatewayDetailModal";
import { StatsCard } from "../components/stats-card";
import { AppDispatch, RootState } from "../store";
import {
  deleteGateway,
  gatewaysIsBusy,
  refreshGatewayData,
  selectDeleteLoadingIds,
  selectGatewayPagination,
  selectGateways,
  selectGatewayStats,
  setPage,
} from "../store/gatewaySlice";
import { selectActiveOrgReady } from "../store/activeOrgSlice";
import type { Gateway } from "../types/gateway";
import { PermissionWrapper } from "../components/PermissionWrapper";
import { PermissionButton } from "../components/PermissionButton";
import { usePermissions } from "../hooks/usePermissions";
import { useBreakpoints } from "../hooks/use-media-query";

// Helper function to determine gateway online status
const getGatewayOnlineStatus = (gateway: Gateway) => {
  // Priority: WebSocket presence data > API isConnected field > fallback to offline
  if (gateway.isConnected !== undefined) {
    return gateway.isConnected;
  }
  // Fallback to offline if no presence data
  return false;
};

// Helper function to get status color
const getStatusColor = (isOnline: boolean) => {
  return isOnline ? "success" : "danger";
};

// Helper function to get status text
const getStatusText = (isOnline: boolean) => {
  return isOnline ? "online" : "offline";
};

export const GatewaysPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { hasPermission } = usePermissions();
  const gateways = useSelector(selectGateways);
  const stats = useSelector(selectGatewayStats);
  const pagination = useSelector(selectGatewayPagination);
  const isLoading = useSelector(gatewaysIsBusy);
  const deleteLoadingIds = useSelector(selectDeleteLoadingIds);
  const orgReady = useSelector(selectActiveOrgReady);
  const [selectedGateway, setSelectedGateway] = React.useState<string | null>(null);
  const [gatewayToDelete, setGatewayToDelete] = React.useState<Gateway | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = React.useState<Date | null>(null);
  const [avgSensorsPerGateway, setAvgSensorsPerGateway] = React.useState(0);
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");

  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

  const error = useSelector((state: RootState) => state.gateways.error);

  const fetchData = React.useCallback(async () => {
    if (!orgReady) {
      return;
    }

    try {
      await dispatch(
        refreshGatewayData({
          page: pagination.page,
          limit: 20,
          search: "",
        })
      ).unwrap();
    } catch (error) {}
  }, [dispatch, pagination.page, orgReady]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    // Calculate local stats when gateways array changes
    if (gateways.length > 0) {
      // Calculate average sensors per gateway
      const totalSensors = gateways.reduce((sum: number, gateway: any) => {
        const claimed = gateway.sensorCounts?.find((c: any) => c._id === true)?.c || 0;
        const unclaimed = gateway.sensorCounts?.find((c: any) => c._id === false)?.c || 0;
        return sum + claimed + unclaimed;
      }, 0);

      setAvgSensorsPerGateway(gateways.length > 0 ? totalSensors / gateways.length : 0);

      // Find last heartbeat
      const latestHeartbeat = gateways.reduce(
        (latest: any, gateway: any) => {
          if (!gateway.lastSeen) return latest;
          const gatewayDate = new Date(gateway.lastSeen);
          return !latest || gatewayDate > latest ? gatewayDate : latest;
        },
        null as Date | null
      );

      setLastHeartbeat(latestHeartbeat);
    } else {
      // Reset stats when no gateways
      setAvgSensorsPerGateway(0);
      setLastHeartbeat(null);
    }
  }, [gateways]);

  // Add function to apply sorting client-side
  const sortedGateways = React.useMemo(() => {
    if (!gateways) return [];

    let sorted = [...gateways];

    // Apply sorting
    if (sortColumn) {
      sorted.sort((a, b) => {
        let valueA: any = a[sortColumn as keyof Gateway];
        let valueB: any = b[sortColumn as keyof Gateway];

        // Handle special cases
        if (sortColumn === "lastSeen") {
          valueA = valueA ? new Date(valueA as string).getTime() : 0;
          valueB = valueB ? new Date(valueB as string).getTime() : 0;
        }

        if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
        if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return sorted;
  }, [gateways, sortColumn, sortDirection]);

  const {
    isMobile,
    isSmallScreen,
    isLandscape,
    isShortHeight,
    isVeryShortHeight,
    isIPhone14Pro,
    isIPhoneLandscape,
    isPixelLandscape,
  } = useBreakpoints();

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleGatewayClick = (gatewayId: string) => {
    // Check permission before opening modal
    if (hasPermission("gateways.details")) {
      setSelectedGateway(gatewayId);
      onDetailOpen();
    }
  };

  const handlePageChange = (page: number) => {
    dispatch(setPage(page));
  };

  const handleDeleteClick = (gateway: Gateway) => {
    setGatewayToDelete(gateway);
    onDeleteOpen();
  };

  const handleDeleteConfirm = async () => {
    if (!gatewayToDelete) return;

    try {
      await dispatch(deleteGateway(gatewayToDelete._id)).unwrap();
      addToast({
        title: "Gateway deleted",
        description: `Gateway ${gatewayToDelete.label || gatewayToDelete.mac} has been successfully deleted.`,
        color: "success",
      });
      onDeleteClose();
      setGatewayToDelete(null);

      // Refresh data to ensure UI is in sync with backend
      setTimeout(() => {
        fetchData();
      }, 200);
    } catch (error: any) {
      addToast({
        title: "Delete failed",
        description: error.message || "Failed to delete gateway. Please try again.",
        color: "danger",
      });
    }
  };

  const handleDeleteCancel = () => {
    onDeleteClose();
    setGatewayToDelete(null);
  };

  const renderCell = React.useCallback(
    (gateway: Gateway, columnKey: string) => {
      switch (columnKey) {
        case "mac":
          return (
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">{gateway.label || gateway.mac}</p>
              <p className="text-bold text-tiny text-default-400">{gateway.mac}</p>
            </div>
          );
        case "location":
          return (
            <div className="flex items-center gap-2">
              <Icon icon="lucide:map-pin" className="w-4 h-4 text-default-400" />
              <span className="text-small">{gateway.location || "-"}</span>
            </div>
          );
        case "status":
          const isOnline = getGatewayOnlineStatus(gateway);
          return (
            <Chip
              className="capitalize"
              color={getStatusColor(isOnline)}
              size="sm"
              variant="flat"
              startContent={<Icon icon={isOnline ? "lucide:wifi" : "lucide:wifi-off"} className="w-3 h-3" />}
            >
              {getStatusText(isOnline)}
            </Chip>
          );
        case "lastSeen":
          return gateway.lastSeen ? formatDistanceToNow(new Date(gateway.lastSeen), { addSuffix: true }) : "Never";
        case "sensors":
          const claimed = gateway.sensorCounts?.find((c) => c._id === true)?.c || 0;
          const unclaimed = gateway.sensorCounts?.find((c) => c._id === false)?.c || 0;
          const total = claimed + unclaimed;

          return (
            <Chip size="sm" variant="flat" color="primary">
              {claimed} / {total}
            </Chip>
          );
        case "actions":
          const isDeleting = deleteLoadingIds.includes(gateway._id);
          return (
            <div className="flex items-center justify-center gap-2">
              <PermissionButton
                permissions={["gateways.details"]}
                isIconOnly
                size="sm"
                variant="light"
                color="primary"
                onPress={() => handleGatewayClick(gateway._id)}
                className="min-w-unit-8 w-unit-8 h-unit-8"
                lockedTooltip="You don't have permission to view gateway details"
              >
                <Icon icon="lucide:edit" className="w-4 h-4" />
              </PermissionButton>
              <PermissionButton
                permissions={["gateways.delete"]}
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                onPress={() => handleDeleteClick(gateway)}
                isLoading={isDeleting}
                isDisabled={isDeleting}
                className="min-w-unit-8 w-unit-8 h-unit-8"
                lockedTooltip="You don't have permission to delete gateways"
              >
                {!isDeleting && <Icon icon="lucide:trash-2" className="w-4 h-4" />}
              </PermissionButton>
            </div>
          );
        default:
          return String(gateway[columnKey as keyof Gateway] || "");
      }
    },
    [deleteLoadingIds, handleDeleteClick]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto max-w-7xl p-4 space-y-6"
    >
      <div className="flex justify-between items-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-2xl sm:text-3xl font-bold ${
            isMobile
              ? "mb-3 px-1" // Mobile: reduced margin and padding
              : "mb-4 sm:mb-6 px-2 sm:px-0" // Desktop: normal spacing
          }`}
        >
          Gateways
        </motion.h1>
      </div>

      {/* Enhanced stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {error ? (
          <div className="col-span-4 text-center text-danger">
            <Icon icon="lucide:alert-circle" className="w-6 h-6 mx-auto mb-2" />
            <p>Failed to load gateway stats: {error}</p>
          </div>
        ) : (
          <>
            <StatsCard
              title="Total Gateways"
              value={String(stats?.totalGateways ?? 0)}
              icon="lucide:cpu"
              color="primary"
            />
            <StatsCard
              title="Live Gateways"
              value={String(stats?.liveGateways ?? 0)}
              icon="lucide:activity"
              color="success"
            />
            <StatsCard
              title="Avg. Sensors per Gateway"
              value={gateways.length > 0 ? Math.ceil(avgSensorsPerGateway).toString() : "0"}
              icon="lucide:radio"
              color="secondary"
            />
            <StatsCard
              title="Last Heartbeat"
              value={
                lastHeartbeat
                  ? (() => {
                      const text = formatDistanceToNow(lastHeartbeat, { addSuffix: true })?.toString();
                      return text.charAt(0).toUpperCase() + text.slice(1);
                    })()
                  : "N/A"
              }
              icon="lucide:clock"
              color="warning"
            />
          </>
        )}
      </div>

      <div>
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Spinner size="lg" />
          </div>
        ) : sortedGateways.length > 0 ? (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
            <table className="w-full min-w-full table-auto border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-100/20">
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-dark cursor-pointer"
                    onClick={() => handleSort("mac")}
                  >
                    <div className="flex items-center gap-1">
                      GATEWAY
                      {sortColumn === "mac" && (
                        <Icon
                          icon={sortDirection === "asc" ? "lucide:arrow-up" : "lucide:arrow-down"}
                          width={14}
                          className="text-primary-500"
                        />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-dark cursor-pointer"
                    onClick={() => handleSort("location")}
                  >
                    <div className="flex items-center gap-1">
                      LOCATION
                      {sortColumn === "location" && (
                        <Icon
                          icon={sortDirection === "asc" ? "lucide:arrow-up" : "lucide:arrow-down"}
                          width={14}
                          className="text-primary-500"
                        />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-dark cursor-pointer"
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center gap-1">
                      STATUS
                      {sortColumn === "status" && (
                        <Icon
                          icon={sortDirection === "asc" ? "lucide:arrow-up" : "lucide:arrow-down"}
                          width={14}
                          className="text-primary-500"
                        />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-3 text-left text-sm font-medium text-dark cursor-pointer"
                    onClick={() => handleSort("lastSeen")}
                  >
                    <div className="flex items-center gap-1">
                      LAST SEEN
                      {sortColumn === "lastSeen" && (
                        <Icon
                          icon={sortDirection === "asc" ? "lucide:arrow-up" : "lucide:arrow-down"}
                          width={14}
                          className="text-primary-500"
                        />
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-dark">SENSORS</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-dark">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sortedGateways.map((gateway: Gateway) => (
                  <tr
                    key={gateway._id}
                    className={`border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      gateway.status === "offline" ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => handleGatewayClick(gateway._id)}>
                      {renderCell(gateway, "mac")}
                    </td>
                    <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => handleGatewayClick(gateway._id)}>
                      {renderCell(gateway, "location")}
                    </td>
                    <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => handleGatewayClick(gateway._id)}>
                      {renderCell(gateway, "status")}
                    </td>
                    <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => handleGatewayClick(gateway._id)}>
                      {renderCell(gateway, "lastSeen")}
                    </td>
                    <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => handleGatewayClick(gateway._id)}>
                      {renderCell(gateway, "sensors")}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">{renderCell(gateway, "actions")}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Only show pagination if there's more than one page */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center mt-4">
                <Pagination
                  isCompact
                  showControls
                  showShadow
                  color="primary"
                  total={pagination.totalPages}
                  page={pagination.page}
                  onChange={handlePageChange}
                />
              </div>
            )}
          </div>
        ) : gateways.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Icon icon="lucide:database" className="w-12 h-12 text-default-400" />
            <p className="text-default-400">No gateways found</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Icon icon="lucide:search" className="w-12 h-12 text-default-400" />
            <p className="text-default-400">No gateways match your filters</p>
          </div>
        )}
      </div>
      {selectedGateway && (
        <GatewayDetailModal isOpen={isDetailOpen} onClose={onDetailClose} gatewayId={selectedGateway} />
      )}
      {gatewayToDelete && (
        <DeleteGatewayConfirmationModal
          isOpen={isDeleteOpen}
          onClose={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
          title="Delete Gateway"
          message={`Are you sure you want to delete the gateway "${gatewayToDelete.label || gatewayToDelete.mac}"?`}
          confirmText="Delete"
          cancelText="Cancel"
          confirmColor="danger"
          isLoading={deleteLoadingIds.includes(gatewayToDelete._id)}
        />
      )}
    </motion.div>
  );
};
