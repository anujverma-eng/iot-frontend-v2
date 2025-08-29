// src/pages/DashboardHome.tsx
import React from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { formatNumericValue } from "../utils/numberUtils";
import { AppDispatch } from "../store";
import { useOfflineDetectionIntegration } from "../hooks/useOfflineDetectionIntegration";
import { useLiveDataReadiness } from "../hooks/useLiveDataReadiness";
import { LiveDataLoading } from "../components/visualization/live-data-loading";
import { fetchGateways, fetchGatewayStats, selectGateways, selectGatewayStats } from "../store/gatewaySlice";
import {
  fetchSensors,
  fetchSensorStats,
  selectSensors,
  selectSensorsLoading,
  selectSensorStats,
  selectEnhancedSensorStats,
  toggleSensorStar,
  addSelectedSensorId,
  selectSelectedSensorIds,
} from "../store/sensorsSlice";
import {
  fetchTelemetry,
  selectIsLiveMode,
  selectTelemetryData,
  selectTimeRange,
  setTimeRange,
  toggleLiveMode,
} from "../store/telemetrySlice";
import { selectIsConnecting } from "../store/liveDataSlice";
import { Gateway } from "../types/gateway";
import { Sensor } from "../types/sensor";
import { StatsCard } from "../components/stats-card";
import { TimeRangeSelector } from "../components/analytics/time-range-selector";
import { LineChart } from "../components/visualization/line-chart";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
  Progress,
  Select,
  SelectItem,
  Tabs,
  Tab,
} from "@heroui/react";

interface Alert {
  id: string;
  severity: "high" | "medium" | "low";
  message: string;
  timestamp: string;
}

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

export const DashboardHome: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();

  // Get state from Redux
  const gateways = useSelector(selectGateways);
  const sensors = useSelector(selectSensors);
  const sensorsLoading = useSelector(selectSensorsLoading);
  const gatewayStats = useSelector(selectGatewayStats);
  const sensorStats = useSelector(selectEnhancedSensorStats); // Use enhanced stats for real-time calculations
  const starredSensorIds = useSelector(selectSelectedSensorIds);
  const isLiveMode = useSelector(selectIsLiveMode);
  const isConnecting = useSelector(selectIsConnecting);
  const telemetryData = useSelector(selectTelemetryData);
  const timeRange = useSelector(selectTimeRange);

  // Initialize offline detection service
  useOfflineDetectionIntegration();

  // Local state
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedFavoriteSensor, setSelectedFavoriteSensor] = React.useState<string | null>(null);
  const [favoriteViewMode, setFavoriteViewMode] = React.useState<"chart" | "table">("chart");
  const [isLoadingTelemetry, setIsLoadingTelemetry] = React.useState(false);
  const [alerts, setAlerts] = React.useState<Alert[]>([]); // We'll need to implement an alerts API/redux slice later
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = React.useState(false);

  // Live data readiness hook for charts
  const liveDataReadiness = useLiveDataReadiness(selectedFavoriteSensor, isLiveMode);

  // Add a ref to track the most recent time range request
  const lastTimeRangeRequestRef = React.useRef<string>("");

  // Mark initial load as completed immediately - we'll fetch limited data for first load
  React.useEffect(() => {
    if (!hasInitialLoadCompleted) {
      setHasInitialLoadCompleted(true);
    }
  }, [hasInitialLoadCompleted]);

  // Get favorite sensors
  const favoriteSensors = React.useMemo(() => {
    const favorites = sensors.filter((sensor) => sensor.favorite || sensor.isStarred);
    return favorites;
  }, [sensors]);

  // Set default selected favorite sensor when favorites change
  React.useEffect(() => {
    if (favoriteSensors.length > 0 && !selectedFavoriteSensor) {
      setSelectedFavoriteSensor(favoriteSensors[0]._id);
    }
  }, [favoriteSensors, selectedFavoriteSensor]);

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          dispatch(fetchGateways({ page: 1, limit: 5, search: "" }) as any),
          dispatch(
            fetchSensors({
              page: 1,
              limit: 5,
              claimed: true,
              search: "",
            }) as any
          ),
          dispatch(fetchGatewayStats() as any),
          dispatch(fetchSensorStats() as any),
        ]);
      } catch (error) {

      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dispatch]);

  // Get sorted sensors by battery level (lowest first) for recent sensors
  // Show up to 5 sensors sorted by lowest battery level first
  const recentSensors = React.useMemo(() => {
    return [...sensors]
      .sort((a, b) => (a.battery || 0) - (b.battery || 0)) // Sort by lowest battery first
      .slice(0, 5);
  }, [sensors]);

  // Optimized telemetry fetching with live data readiness
  React.useEffect(() => {
    if (!selectedFavoriteSensor) {
      setIsLoadingTelemetry(false);
      return;
    }
    
    // Create a request ID based on current parameters
    const currentRequest = `${selectedFavoriteSensor}-${timeRange?.start}-${timeRange?.end}`;

    // Don't make duplicate requests
    if (lastTimeRangeRequestRef.current === currentRequest) {
      return;
    }

    // Always update the request ref to prevent duplicate attempts
    lastTimeRangeRequestRef.current = currentRequest;

    // Check if we should show loading instead of fetching API data
    if (liveDataReadiness.shouldShowLoading) {
      setIsLoadingTelemetry(true);
      return;
    }

    // Check if we should fetch API data based on live data readiness
    if (!liveDataReadiness.shouldFetchApiData) {
      return;
    }

    setIsLoadingTelemetry(true);

    // Determine time range to use based on initial load vs normal operation
    const isInitialLoad = lastTimeRangeRequestRef.current === currentRequest; // First time for this sensor
    let timeRangeToUse;

    if (isInitialLoad) {
      // For initial load, fetch last ~3 minutes (approximately 90 readings at 2-second intervals)
      const now = new Date();
      const threeMinutesAgo = new Date(now.getTime() - (3 * 60 * 1000)); // 3 minutes ago
      
      timeRangeToUse = {
        start: threeMinutesAgo,
        end: now
      };
    } else if (isLiveMode) {
      // For live mode, fetch last ~4 minutes to match live data view
      const now = new Date();
      const fourMinutesAgo = new Date(now.getTime() - (4 * 60 * 1000));
      
      timeRangeToUse = {
        start: fourMinutesAgo,
        end: now
      };
    } else {
      // For historical mode, use selected time range or default to last 24 hours
      const currentTimeRange = timeRange || {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };
      
      timeRangeToUse = currentTimeRange;
    }

    dispatch(
      fetchTelemetry({
        sensorIds: [selectedFavoriteSensor],
        timeRange: {
          start: timeRangeToUse.start.toISOString(),
          end: timeRangeToUse.end.toISOString(),
        },
      }) as any
    )
      .then(() => {
        // Telemetry data fetched successfully
      })
      .finally(() => {
        setIsLoadingTelemetry(false);
      });
  }, [dispatch, selectedFavoriteSensor, timeRange, hasInitialLoadCompleted, liveDataReadiness.shouldFetchApiData, liveDataReadiness.shouldShowLoading, isLiveMode]);

  // Handle time range change for favorite sensor view
  const handleTimeRangeChange = (newTimeRange: any) => {
    dispatch(setTimeRange(newTimeRange));
  };

  // Get chart data for selected favorite sensor
  const selectedFavoriteSensorData = React.useMemo(() => {
    if (!selectedFavoriteSensor) {
      return null;
    }

    const data = telemetryData[selectedFavoriteSensor];
    if (!data || !data.series || data.series.length === 0) {
      return null;
    }

    return {
      type: data.type,
      unit: data.unit,
      series: data.series || [],
      color: "#006FEE", // Primary color
    };
  }, [selectedFavoriteSensor, telemetryData, isLiveMode]);

  const stats = React.useMemo(
    () => ({
      totalGateways: gatewayStats?.totalGateways || 0,
      activeGateways: gateways.filter((gateway) => getGatewayOnlineStatus(gateway)).length,
      totalSensors: sensorStats?.claimed || 0,
      activeSensors: sensorStats?.liveSensors || 0, // Now uses real-time calculated count
      favoriteSensors: favoriteSensors.length,
      lowBatterySensors: sensorStats?.lowBatterySensors || 0, // Now uses real-time calculated count
    }),
    [gatewayStats, sensorStats, gateways, favoriteSensors.length]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Progress size="sm" isIndeterminate aria-label="Loading..." className="max-w-md" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 px-2 sm:px-0"
      >
        Dashboard Overview
      </motion.h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-2 sm:px-0">
        <StatsCard title="Total Gateways" value={stats.totalGateways.toString()} icon="lucide:cpu" color="primary" />
        <StatsCard
          title="Active Gateways"
          value={stats.activeGateways.toString()}
          icon="lucide:activity"
          color="success"
        />
        <StatsCard title="Total Sensors" value={stats.totalSensors.toString()} icon="lucide:radio" color="secondary" />
        <StatsCard title="Active Sensors" value={stats.activeSensors.toString()} icon="lucide:signal" color="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 px-2 sm:px-0">
        {/* Sensors Card */}
        <Card>
          <CardHeader className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Recent Sensors</h2>
            <Button
              as={Link}
              to="/dashboard/sensors"
              color="primary"
              variant="light"
              endContent={<Icon icon="lucide:chevron-right" />}
            >
              View All
            </Button>
          </CardHeader>
          <CardBody>
            <Table removeWrapper aria-label="Recent Sensors">
              <TableHeader>
                <TableColumn>SENSOR</TableColumn>
                <TableColumn>TYPE</TableColumn>
                <TableColumn>BATTERY</TableColumn>
                <TableColumn>LAST VALUE</TableColumn>
                <TableColumn>LAST READING</TableColumn>
              </TableHeader>
              <TableBody>
                {recentSensors.length > 0 ? (
                  recentSensors.map((sensor) => {
                    const telemetryDataForSensor = telemetryData[sensor._id];
                    // Show live value if in live mode, else show last value
                    const lastValue =
                      isLiveMode && telemetryDataForSensor?.current !== undefined
                        ? telemetryDataForSensor.current
                        : sensor.lastValue;
                    // Show live timestamp if in live mode, else lastSeen
                    const lastReading =
                      isLiveMode && telemetryDataForSensor?.lastUpdated
                        ? new Date(telemetryDataForSensor.lastUpdated)
                        : new Date(sensor.lastSeen);

                    return (
                      <TableRow key={sensor._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-bold text-small">{sensor.displayName || sensor.mac}</span>
                              {(sensor.favorite || sensor.isStarred) && (
                                <Icon icon="lucide:star" className="w-3 h-3 text-warning" />
                              )}
                            </div>
                            <span className="text-tiny text-default-400">{sensor.mac}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip
                            className="capitalize"
                            color={
                              sensor.type === "temperature"
                                ? "primary"
                                : sensor.type === "pressure"
                                  ? "secondary"
                                  : sensor.type === "humidity"
                                    ? "success"
                                    : "default"
                            }
                            size="sm"
                            variant="flat"
                          >
                            {sensor.type}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={sensor.battery || 0}
                              className="w-12 hidden sm:block"
                              color={
                                (sensor.battery || 0) > 50
                                  ? "success"
                                  : (sensor.battery || 0) > 20
                                    ? "warning"
                                    : "danger"
                              }
                              size="sm"
                            />
                            <span
                              className={`text-sm font-medium ${
                                (sensor.battery || 0) > 50
                                  ? "text-success"
                                  : (sensor.battery || 0) > 20
                                    ? "text-warning"
                                    : "text-danger"
                              }`}
                            >
                              {sensor.battery || 0}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-bold text-small">
                              {lastValue} {sensor?.unit}
                            </span>
                            {/* {isLiveMode && (
                              <span className="text-tiny text-success">● Live</span>
                            )} */}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-small">{lastReading.toLocaleString()}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="text-center py-4">
                        <p className="text-default-500">No sensors found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      </div>

      {/* Enhanced Favorite Sensors Section */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold">Favorite Sensor</h2>
            <p className="text-sm text-default-500">
              Monitor your selected favorite sensor with live data and analytics
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-default-600">Live Mode:</span>
              <Button
                size="sm"
                variant={isLiveMode ? "solid" : "bordered"}
                color={isLiveMode ? "success" : "default"}
                startContent={<Icon icon={isLiveMode ? "lucide:radio" : "lucide:database"} className="w-3 h-3" />}
                onPress={() => {

                  dispatch(
                    toggleLiveMode({
                      enable: !isLiveMode,
                      gatewayIds: gateways.map((g) => g._id),
                    }) as any
                  );
                }}
              >
                {isLiveMode ? "Live" : "Historical"}
              </Button>
            </div>
            {!isLiveMode && (
              <div className="w-full sm:w-auto">
                <TimeRangeSelector timeRange={timeRange} onTimeRangeChange={handleTimeRangeChange} isMobile={true} />
              </div>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {favoriteSensors.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 sm:space-y-6">
              {/* Sensor Selection and View Mode - Mobile Optimized */}
              <div className="space-y-4">
                {/* Mobile: Stack vertically, Desktop: Side by side */}
                <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:gap-4 lg:items-end lg:justify-between">
                  <div className="flex-1 lg:max-w-sm">
                    <Select
                      label="Select Favorite Sensor"
                      placeholder="Choose a sensor to view"
                      selectedKeys={selectedFavoriteSensor ? [selectedFavoriteSensor] : []}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;

                        setSelectedFavoriteSensor(selectedKey);
                      }}
                      className="w-full"
                      size="sm"
                      renderValue={() => {
                        if (selectedFavoriteSensor) {
                          const sensor = favoriteSensors.find((s) => s._id === selectedFavoriteSensor);
                          return sensor ? `${sensor.displayName || sensor.mac} (${sensor.type})` : "Select sensor";
                        }
                        return "Choose a sensor to view";
                      }}
                    >
                      {favoriteSensors.map((sensor) => (
                        <SelectItem key={sensor._id}>
                          {sensor.displayName || sensor.mac} ({sensor.type})
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-3">
                    <span className="text-sm text-default-600 hidden lg:block">View Mode:</span>
                    <Tabs
                      selectedKey={favoriteViewMode}
                      onSelectionChange={(key) => setFavoriteViewMode(key as "chart" | "table")}
                      size="sm"
                      variant="bordered"
                      className="lg:ml-2"
                    >
                      <Tab key="chart" title="Chart" />
                      <Tab key="table" title="Table" />
                    </Tabs>
                  </div>
                </div>
              </div>

              {/* Sensor Info Panel */}
              {(() => {
                const sensor = favoriteSensors.find((s) => s._id === selectedFavoriteSensor);
                if (!sensor) return null;
                const telemetryDataForSensor = telemetryData[sensor._id] || {};
                const currentValue =
                  isLiveMode && telemetryDataForSensor.current !== undefined
                    ? telemetryDataForSensor.current
                    : sensor.lastValue;
                return (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-4"
                  >
                    {/* Mobile-first responsive sensor info */}
                    <div className="bg-default-50 rounded-lg p-4">
                      {/* Mobile Layout - Stacked Cards */}
                      <div className="block lg:hidden space-y-3">
                        {/* Primary Info Row */}
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <p className="text-xs text-default-500 uppercase tracking-wide">Current Reading</p>
                            <p className="text-xl font-bold text-primary">
                              {currentValue} <span className="text-sm text-default-600">{sensor?.unit}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-default-500 uppercase tracking-wide">Battery</p>
                            <p
                              className={`text-lg font-bold ${
                                (sensor.battery || 0) > 50
                                  ? "text-success"
                                  : (sensor.battery || 0) > 20
                                    ? "text-warning"
                                    : "text-danger"
                              }`}
                            >
                              {sensor.battery || 0}%
                            </p>
                          </div>
                        </div>

                        {/* Status Row */}
                        <div className="flex justify-between items-center pt-2 border-t border-default-200">
                          <div>
                            <p className="text-xs text-default-500 uppercase tracking-wide mb-1">Status</p>
                            <Chip color={sensor.isOnline ? "success" : "danger"} size="sm" variant="flat">
                              {sensor.isOnline ? "Online" : "Offline"}
                            </Chip>
                          </div>
                          <div>
                            <p className="text-xs text-default-500 uppercase tracking-wide mb-1">Data Source</p>
                            <Chip
                              color={isLiveMode ? "success" : "primary"}
                              size="sm"
                              variant="flat"
                              startContent={
                                <Icon icon={isLiveMode ? "lucide:radio" : "lucide:database"} className="w-3 h-3" />
                              }
                            >
                              {isLiveMode ? "Live" : "Historical"}
                            </Chip>
                          </div>
                        </div>

                        {/* Last Seen Row */}
                        <div className="pt-2 border-t border-default-200">
                          <p className="text-xs text-default-500 uppercase tracking-wide">Last Update</p>
                          <p className="text-sm font-medium text-default-700">
                            {sensor.lastSeen
                              ? new Date(sensor.lastSeen).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Never"}
                          </p>
                        </div>
                      </div>

                      {/* Desktop Layout - Grid */}
                      <div className="hidden lg:grid lg:grid-cols-5 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-default-600 mb-1">Current Value</p>
                          <p className="text-lg font-bold text-primary">
                            {currentValue} {sensor?.unit}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-default-600 mb-1">Battery</p>
                          <p
                            className={`text-lg font-bold ${
                              (sensor.battery || 0) > 50
                                ? "text-success"
                                : (sensor.battery || 0) > 20
                                  ? "text-warning"
                                  : "text-danger"
                            }`}
                          >
                            {sensor.battery || 0}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-default-600 mb-1">Status</p>
                          <Chip color={sensor.isOnline ? "success" : "danger"} size="sm" variant="flat">
                            {sensor.isOnline ? "Online" : "Offline"}
                          </Chip>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-default-600 mb-1">Data Source</p>
                          <Chip
                            color={isLiveMode ? "success" : "primary"}
                            size="sm"
                            variant="flat"
                            startContent={
                              <Icon icon={isLiveMode ? "lucide:radio" : "lucide:database"} className="w-3 h-3" />
                            }
                          >
                            {isLiveMode ? "Live" : "Historical"}
                          </Chip>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-default-600 mb-1">Last Seen</p>
                          <p className="text-lg font-bold text-default-700">
                            {sensor.lastSeen ? new Date(sensor.lastSeen).toLocaleString() : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Chart/Table View */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {favoriteViewMode === "chart" ? (
                  <div className="w-full">
                    {/* Chart Container - Mobile optimized heights */}
                    <div className="bg-default-50 rounded-lg border border-default-200 h-[300px] sm:h-[350px] lg:h-[400px] min-h-[300px]">
                      {(isLoadingTelemetry && !liveDataReadiness.shouldShowLoading) || isLoading || sensorsLoading || (!selectedFavoriteSensor && sensors.length > 0) ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center">
                            <Progress
                              size="sm"
                              isIndeterminate
                              aria-label="Loading chart data..."
                              className="max-w-md mb-3"
                            />
                            <p className="text-default-600 text-sm">Loading chart data...</p>
                          </div>
                        </div>
                      ) : (isLiveMode && liveDataReadiness.shouldShowLoading) ? (
                        <div className="flex items-center justify-center h-full">
                          <LiveDataLoading 
                            sensorName={selectedFavoriteSensor ? (favoriteSensors.find(s => s._id === selectedFavoriteSensor)?.displayName || selectedFavoriteSensor) : undefined}
                          />
                        </div>
                      ) : (
                        (() => {
                          // Check if sensor is offline and we're in live mode
                          const sensor = favoriteSensors.find((s) => s._id === selectedFavoriteSensor);
                          const isSensorOffline = sensor?.isOnline === false;
                          const shouldShowOfflineFallback = isLiveMode && isSensorOffline;

                          if (shouldShowOfflineFallback) {
                            return (
                              <div className="flex items-center justify-center h-full">
                                <div className="text-center max-w-md px-6">
                                  {/* Animated loading icon */}
                                  <div className="flex flex-col items-center gap-4 max-w-md">
                                    <div className="relative">
                                      <Icon
                                        icon="lucide:wifi-off"
                                        className="text-danger-400 animate-pulse"
                                        width={64}
                                        height={64}
                                      />
                                      <div className="absolute -bottom-2 -right-2 bg-danger-500 rounded-full p-1">
                                        <Icon
                                          icon="lucide:loader-2"
                                          className="text-white animate-spin"
                                          width={16}
                                          height={16}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-danger-600">Sensor Offline</h3>
                                    <p className="text-default-600 text-sm leading-relaxed">
                                      <span className="font-medium text-primary-600">
                                        {sensor?.displayName || sensor?.mac}
                                      </span>{" "}
                                      is currently offline
                                    </p>
                                    <p className="text-default-500 text-xs">
                                      Live data will resume automatically when sensor comes back online
                                    </p>
                                  </div>

                                  <div className="mt-6">
                                    <Button
                                      color="primary"
                                      variant="flat"
                                      size="sm"
                                      startContent={<Icon icon="lucide:history" className="w-4 h-4" />}
                                      onPress={() => {
                                        dispatch(
                                          toggleLiveMode({
                                            enable: false,
                                            gatewayIds: gateways.map((g) => g._id),
                                          }) as any
                                        );
                                      }}
                                    >
                                      View Historical Data
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          // Normal chart rendering
                          return selectedFavoriteSensor &&
                            telemetryData[selectedFavoriteSensor] &&
                            telemetryData[selectedFavoriteSensor].series?.length > 0 ? (
                            <div className="h-full w-full p-2">
                              <LineChart
                                config={{
                                  type: telemetryData[selectedFavoriteSensor].type || "temperature",
                                  unit: telemetryData[selectedFavoriteSensor].unit || "°C",
                                  series: telemetryData[selectedFavoriteSensor].series || [],
                                  color: "#006FEE",
                                }}
                                isLiveMode={isLiveMode}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center">
                                <Icon
                                  icon="lucide:bar-chart-3"
                                  className="w-8 h-8 sm:w-12 sm:h-12 text-default-300 mb-3 mx-auto"
                                />
                                <p className="text-default-600 text-sm sm:text-base">
                                  {selectedFavoriteSensor ? "No chart data available" : "Select a sensor to view chart"}
                                </p>
                                <p className="text-xs sm:text-sm text-default-500 mt-1">
                                  {isLiveMode
                                    ? "Live data will appear here once sensor starts transmitting"
                                    : "Historical data will load for the selected time range"}
                                </p>
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    <div className="overflow-x-auto rounded-lg border border-default-200">
                      <Table removeWrapper aria-label="Sensor Data Table" className="min-w-full">
                        <TableHeader>
                          <TableColumn className="text-xs sm:text-sm font-medium px-2 sm:px-4 py-2">
                            TIMESTAMP
                          </TableColumn>
                          <TableColumn className="text-xs sm:text-sm font-medium px-2 sm:px-4 py-2 text-right">
                            VALUE
                          </TableColumn>
                        </TableHeader>
                        <TableBody>
                          {isLoadingTelemetry || isLoading || sensorsLoading || (!selectedFavoriteSensor && sensors.length > 0) ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center py-8">
                                <Progress
                                  size="sm"
                                  isIndeterminate
                                  aria-label="Loading table data..."
                                  className="max-w-md mb-3 mx-auto"
                                />
                                <p className="text-default-600 text-sm">Loading table data...</p>
                              </TableCell>
                            </TableRow>
                          ) : selectedFavoriteSensor && telemetryData[selectedFavoriteSensor]?.series?.length > 0 ? (
                            telemetryData[selectedFavoriteSensor].series
                              .slice(-10)
                              .reverse()
                              .map((point, idx) => (
                                <TableRow key={idx} className="hover:bg-default-50">
                                  <TableCell className="text-xs sm:text-sm font-mono px-2 sm:px-4 py-2">
                                    <div className="max-w-[140px] sm:max-w-none">
                                      <div className="hidden sm:block">
                                        {new Date(point.timestamp).toLocaleString()}
                                      </div>
                                      <div className="sm:hidden">
                                        <div className="text-xs">{new Date(point.timestamp).toLocaleDateString()}</div>
                                        <div className="text-xs text-default-500">
                                          {new Date(point.timestamp).toLocaleTimeString()}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm font-bold px-2 sm:px-4 py-2 text-right">
                                    <span className="text-primary">{point.value}</span>
                                    <span className="text-default-500 ml-1">
                                      {telemetryData[selectedFavoriteSensor].unit}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))
                          ) : (
                            (() => {
                              // Check if sensor is offline and we're in live mode for table view
                              const sensor = favoriteSensors.find((s) => s._id === selectedFavoriteSensor);
                              const isSensorOffline = sensor?.isOnline === false;
                              const shouldShowOfflineFallback = isLiveMode && isSensorOffline;

                              if (shouldShowOfflineFallback) {
                                return (
                                  <TableRow>
                                    <TableCell colSpan={2} className="text-center py-12">
                                      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                                        <div className="relative">
                                          <Icon
                                            icon="lucide:wifi-off"
                                            className="text-danger-400"
                                            width={32}
                                            height={32}
                                          />
                                          <div className="absolute inset-0 rounded-full bg-danger-200 animate-ping opacity-20"></div>
                                        </div>
                                        <div className="space-y-2 text-center">
                                          <h4 className="font-semibold text-danger-600">Sensor Offline</h4>
                                          <p className="text-default-600 text-sm">
                                            <span className="font-medium text-primary-600">
                                              {sensor?.displayName || sensor?.mac}
                                            </span>{" "}
                                            is currently offline
                                          </p>
                                          <Button
                                            color="primary"
                                            variant="flat"
                                            size="sm"
                                            startContent={<Icon icon="lucide:history" className="w-4 h-4" />}
                                            onPress={() => {
                                              dispatch(
                                                toggleLiveMode({
                                                  enable: false,
                                                  gatewayIds: gateways.map((g) => g._id),
                                                }) as any
                                              );
                                            }}
                                          >
                                            View Historical Data
                                          </Button>
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              }

                              // Normal no data state
                              return (
                                <TableRow>
                                  <TableCell colSpan={2} className="text-center py-8">
                                    <Icon icon="lucide:database" className="w-8 h-8 text-default-300 mb-2 mx-auto" />
                                    <p className="text-default-600 text-sm sm:text-base">
                                      {selectedFavoriteSensor
                                        ? "No table data available"
                                        : "Select a sensor to view data"}
                                    </p>
                                    <p className="text-xs sm:text-sm text-default-500 mt-1">
                                      {isLiveMode
                                        ? "Live data will appear here once sensor starts transmitting"
                                        : "Historical data will load for the selected time range"}
                                    </p>
                                  </TableCell>
                                </TableRow>
                              );
                            })()
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <Icon icon="lucide:star-off" className="w-16 h-16 text-default-300 mb-4" />
              <p className="text-default-600 mb-4">No favorite sensors added yet</p>
              <p className="text-sm text-default-500 mb-6">Star your sensors from the Sensors page to see them here</p>
              <Button as={Link} to="/dashboard/sensors" color="primary" startContent={<Icon icon="lucide:star" />}>
                Browse Sensors
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Favorite Dashboard Section */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Favorite Dashboard</h2>
        </CardHeader>
        <CardBody>
          <div className="flex flex-col items-center justify-center py-12">
            <Icon icon="lucide:layout-dashboard" className="w-16 h-16 text-default-300 mb-4" />
            <p className="text-default-600 mb-4">No favorite dashboard available</p>
            <Button color="primary" startContent={<Icon icon="lucide:plus" />}>
              Add Favorite Dashboard
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
