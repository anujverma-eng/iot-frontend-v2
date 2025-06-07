import {
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
import { GatewayDetailModal } from "../components/gateways/GatewayDetailModal";
import { StatsCard } from "../components/stats-card";
import { AppDispatch, RootState } from "../store";
import {
  fetchGateways,
  fetchGatewayStats,
  gatewaysIsBusy,
  selectGatewayPagination,
  selectGateways,
  selectGatewayStats,
  setPage
} from "../store/gatewaySlice";
import type { Gateway } from "../types/gateway";

export const GatewaysPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const gateways = useSelector(selectGateways);
  const stats = useSelector(selectGatewayStats);
  const pagination = useSelector(selectGatewayPagination);
  const isLoading = useSelector(gatewaysIsBusy);
  const [selectedGateway, setSelectedGateway] = React.useState<string | null>(null);
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [filteredGateways, setFilteredGateways] = React.useState<Gateway[]>([]);
  const [lastHeartbeat, setLastHeartbeat] = React.useState<Date | null>(null);
  const [avgSensorsPerGateway, setAvgSensorsPerGateway] = React.useState<number>(0);
  const { isOpen: isDetailOpen, onOpen: onDetailOpen, onClose: onDetailClose } = useDisclosure();
  const lastUpdateRef = React.useRef<number>(Date.now());
  const error = useSelector((state: RootState) => state.gateways.error);

  const fetchData = React.useCallback(async () => {
    try {
      const [gatewaysResult, statsResult] = await Promise.all([
        dispatch(
          fetchGateways({
            page: pagination.page,
            limit: 20,
            search: ""
          })
        ),
        dispatch(fetchGatewayStats())
      ]);
      console.log('Gateway stats result:', statsResult);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }, [dispatch, pagination.page]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
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
    }
  }, [gateways]);

  // Add function to apply filters client-side
  const applyFilters = React.useCallback(
    (gateways: Gateway[]) => {
      let filtered = [...gateways];

      // Apply sorting
      if (sortColumn) {
        filtered.sort((a, b) => {
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

      setFilteredGateways(filtered);
    },
    [sortColumn, sortDirection]
  );

  React.useEffect(() => {
    if (gateways.length > 0) {
      applyFilters(gateways);
    }
  }, [gateways, sortColumn, sortDirection, applyFilters]);


  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleGatewayClick = (gatewayId: string) => {
    setSelectedGateway(gatewayId);
    onDetailOpen();
  };

  const handlePageChange = (page: number) => {
    dispatch(setPage(page));
  };

  const renderCell = React.useCallback((gateway: Gateway, columnKey: string) => {
    switch (columnKey) {
      case "mac":
        return (
          <div className="flex flex-col">
            <p className="text-bold text-small capitalize">{gateway.label || gateway.mac}</p>
            <p className="text-bold text-tiny text-default-400">{gateway.mac}</p>
          </div>
        );
      case "status":
        return (
          <Chip
            className="capitalize"
            color={gateway.status === "active" ? "success" : "warning"}
            size="sm"
            variant="flat"
          >
            {gateway.status}
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
      default:
        return String(gateway[columnKey as keyof Gateway] || "");
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto max-w-7xl p-4 space-y-6"
    >
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Gateways</h1>
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
            <StatsCard title="Total Gateways" value={String(stats?.totalGateways || 0)} icon="lucide:cpu" color="primary" />
            <StatsCard title="Live Gateways" value={String(stats?.liveGateways || 0)} icon="lucide:activity" color="success" />
            <StatsCard
              title="Avg. Sensors per Gateway"
              value={avgSensorsPerGateway.toFixed(1)}
              icon="lucide:radio"
              color="secondary"
            />
            <StatsCard
              title="Last Heartbeat"
              value={lastHeartbeat ? formatDistanceToNow(lastHeartbeat, { addSuffix: true }) : "N/A"}
              icon="lucide:clock"
              color="warning"
            />
          </>
        )}
      </div>

      <Card>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Spinner size="lg" />
            </div>
          ) : filteredGateways.length > 0 ? (
            <div className="space-y-4 overflow-x-auto">
              <Table removeWrapper aria-label="Gateways table" selectionMode="none" isStriped>
                <TableHeader>
                  <TableColumn key="mac" onClick={() => handleSort("mac")} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      GATEWAY
                      {sortColumn === "mac" && (
                        <Icon
                          icon={sortDirection === "asc" ? "lucide:chevron-up" : "lucide:chevron-down"}
                          className="text-default-500"
                          width={16}
                        />
                      )}
                    </div>
                  </TableColumn>
                  <TableColumn key="status" onClick={() => handleSort("status")} className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      STATUS
                      {sortColumn === "status" && (
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
                  <TableColumn key="sensors">SENSORS</TableColumn>
                </TableHeader>
                <TableBody>
                  {filteredGateways.map((gateway) => (
                    <TableRow
                      key={gateway._id}
                      className={gateway.status === "offline" ? "opacity-60" : ""}
                      onClick={() => handleGatewayClick(gateway._id)}
                      style={{ cursor: "pointer" }}
                    >
                      {(columnKey) => <TableCell>{renderCell(gateway, columnKey.toString())}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-center">
                <Pagination 
                  total={pagination.totalPages} 
                  page={pagination.page} 
                  onChange={handlePageChange} 
                  showControls 
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Icon icon="lucide:database" className="w-12 h-12 text-default-400" />
              <p className="text-default-400">No gateways found</p>
            </div>
          )}
        </CardBody>
      </Card>
      {selectedGateway && (
        <GatewayDetailModal isOpen={isDetailOpen} onClose={onDetailClose} gatewayId={selectedGateway} />
      )}
    </motion.div>
  );
};
