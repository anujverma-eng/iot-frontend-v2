import React from "react";
import {
  Button,
  Card,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
  Spinner,
  Chip,
  useDisclosure,
  Tooltip,
  Input,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "../store";
import { StatsCard } from "../components/stats-card";
import { debounce } from "../utils/debounce";
import {
  fetchSensors,
  fetchSensorStats,
  selectSensorPagination,
  selectSensors,
  selectSensorStats,
  setClaimModalOpen,
  setPage,
} from "../store/sensorsSlice";
import { ClaimSensorModal } from "../components/sensors/claim-sensor-modal";
import { SensorDetailDrawer } from "../components/sensors/sensor-detail-drawer";
import { fetchGateways, selectGateways } from "../store/gatewaySlice";

export const SensorsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortColumn, setSortColumn] = React.useState<string | null>(null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc");
  const [selectedSensor, setSelectedSensor] = React.useState<string | null>(null);
  const { isOpen: isDrawerOpen, onOpen: onDrawerOpen, onClose: onDrawerClose } = useDisclosure();
  const gateways = useSelector(selectGateways);

  // Selectors
  const sensors = useSelector(selectSensors);
  console.log({ sensors });
  const stats = useSelector(selectSensorStats);
  const pagination = useSelector(selectSensorPagination);
  const isLoading = useSelector((state: RootState) => state.sensors.loading);

  const fetchData = React.useCallback(async () => {
    await Promise.all([
      dispatch(
        fetchSensors({
          page: pagination.page,
          limit: 50,
          claimed: true,
          search: searchQuery,
          sort: sortColumn || undefined,
          dir: sortDirection,
        })
      ),
      dispatch(fetchSensorStats()),
    ]);
  }, [dispatch, pagination.page, searchQuery, sortColumn, sortDirection]);

  React.useEffect(() => {
    fetchData();
    dispatch(fetchGateways({ page: 1, limit: 1000, search: "" }));
  }, [fetchData, dispatch]);

  const debouncedSearch = React.useMemo(
    () =>
      debounce((value: string) => {
        setSearchQuery(value);
        dispatch(setPage(1)); // Reset to first page on new search
      }, 500),
    [dispatch]
  );

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleSensorClick = (mac: string) => {
    setSelectedSensor(mac);
    onDrawerOpen();
  };

  const copyToClipboard = (text: string, event: any) => {
    event.stopPropagation && event.stopPropagation();
    navigator.clipboard.writeText(text);
  };

  const renderCell = React.useCallback((sensor: any, columnKey: string) => {
    switch (columnKey) {
      case "mac":
        return (
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <p className="text-bold text-small capitalize">{sensor.displayName || sensor.mac}</p>
              {sensor.mac && <p className="text-bold text-tiny text-default-400">{sensor.mac}</p>}
            </div>
            <Tooltip content="Copy MAC address">
              <Button isIconOnly size="sm" variant="light" onPress={(e) => copyToClipboard(sensor.mac, e)}>
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
      case "lastValue":
        return `${sensor?.lastValue?.toFixed(1)} ${sensor?.unit?.toLowerCase() || ""}`;
      case "lastSeen":
        return formatDistanceToNow(new Date(sensor.lastSeen), { addSuffix: true });
      case "seenBy":
        if (!sensor.lastSeenBy || sensor.lastSeenBy.length === 0) return "Unknown";

        if (sensor.lastSeenBy.length <= 2) {
          return sensor.lastSeenBy.join(", ");
        }

        return (
          <Tooltip content={sensor.lastSeenBy.join(", ")}>
            <span>
              {sensor.lastSeenBy[0]} +{sensor.lastSeenBy.length - 1}
            </span>
          </Tooltip>
        );
      case "ignored":
        return sensor.ignored ? (
          <Tooltip content="Sensor is ignored">
            <div className="flex justify-center">
              <Icon icon="lucide:eye-off" className="text-default-400" />
            </div>
          </Tooltip>
        ) : null;
      default:
        return sensor[columnKey];
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="container mx-auto max-w-7xl p-4 space-y-6"
    >
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Sensors</h1>
        <Button
          color="primary"
          onPress={() => dispatch(setClaimModalOpen(true))}
          startContent={<Icon icon="lucide:plus" />}
        >
          Add Sensor
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
        <StatsCard
          title="Claimed Sensors"
          value={(stats?.claimed ?? 0).toString()}
          icon="lucide:radio"
          color="primary"
        />
        <StatsCard
          title="Unclaimed Sensors"
          value={(stats?.unclaimed ?? 0).toString()}
          icon="lucide:radio-tower"
          color="warning"
        />
        <StatsCard
          title="Avg. Reading Frequency"
          value={(stats?.avgReadingFrequency ?? 0).toString()}
          icon="lucide:timer"
          color="success"
        />
      </div>

      {/* Search input */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Input
          className="w-full sm:max-w-xs"
          placeholder="Search sensors..."
          startContent={<Icon icon="lucide:search" className="text-default-400" />}
          onChange={(e) => debouncedSearch(e.target.value)}
          size="sm"
        />
      </div>

      <Card>
        <CardBody>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Spinner size="lg" />
            </div>
          ) : sensors.length > 0 ? (
            <div className="space-y-4 overflow-x-auto">
              <Table removeWrapper aria-label="Sensors table" selectionMode="none" isStriped>
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
                  <TableColumn key="lastValue" onClick={() => handleSort("lastValue")} className="cursor-pointer">
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
                  <TableColumn key="seenBy">SEEN BY</TableColumn>
                  <TableColumn key="ignored">{""}</TableColumn>
                </TableHeader>
                <TableBody>
                  {sensors.map((sensor) => (
                    <TableRow
                      key={sensor._id}
                      onClick={() => handleSensorClick(sensor.mac)}
                      className="cursor-pointer transition-all hover:scale-[1.01] hover:bg-default-100"
                    >
                      {(columnKey) => (
                        <TableCell>
                          {columnKey.toString() === "mac" ? (
                            <div className="flex items-center justify-between">
                              {renderCell(sensor, columnKey.toString())}
                              <Icon
                                icon="lucide:chevron-right"
                                className="text-default-400 opacity-0 transition-all group-hover:opacity-100"
                                height={16}
                                width={16}
                              />
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

              <div className="flex justify-center">
                <Pagination
                  total={pagination.totalPages}
                  page={pagination.page}
                  onChange={(page) => dispatch(setPage(page))}
                  showControls
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-6">
              <Icon icon="lucide:radio" className="w-16 h-16 text-default-300" />
              <p className="text-default-500 text-center">No sensors found. Add your first sensor to get started.</p>
              {searchQuery ? (
                <Button
                  variant="light"
                  color="primary"
                  onPress={() => {
                    setSearchQuery("");
                    debouncedSearch("");
                  }}
                  startContent={<Icon icon="lucide:x" />}
                >
                  Clear search
                </Button>
              ) : (
                <Button
                  color="primary"
                  size="lg"
                  onPress={() => dispatch(setClaimModalOpen(true))}
                  startContent={<Icon icon="lucide:plus" />}
                >
                  Add Sensor
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <ClaimSensorModal
        isOpen={useSelector((state: RootState) => state.sensors.claimModal.isOpen)}
        onClose={() => dispatch(setClaimModalOpen(false))}
        onSensorClaimed={fetchData}
        gateways={gateways ?? []}
      />

      {selectedSensor && (
        <SensorDetailDrawer
          isOpen={isDrawerOpen}
          onClose={() => {
            onDrawerClose();
            setSelectedSensor(null);
          }}
          sensorMac={selectedSensor}
          onSensorUpdated={fetchData}
        />
      )}
    </motion.div>
  );
};
