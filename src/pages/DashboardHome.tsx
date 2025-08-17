// src/pages/DashboardHome.tsx
import React from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { formatNumericValue } from "../utils/numberUtils";
import { AppDispatch } from "../store";
import {
  fetchGateways,
  fetchGatewayStats,
  selectGateways,
  selectGatewayStats,
} from "../store/gatewaySlice";
import {
  fetchSensors,
  fetchSensorStats,
  selectSensors,
  selectSensorStats,
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
  const gatewayStats = useSelector(selectGatewayStats);
  const sensorStats = useSelector(selectSensorStats);
  const starredSensorIds = useSelector(selectSelectedSensorIds);
  const isLiveMode = useSelector(selectIsLiveMode);
  const telemetryData = useSelector(selectTelemetryData);
  const timeRange = useSelector(selectTimeRange);

  // Local state
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedFavoriteSensor, setSelectedFavoriteSensor] = React.useState<string | null>(null);
  const [favoriteViewMode, setFavoriteViewMode] = React.useState<'chart' | 'table'>('chart');
  const [alerts, setAlerts] = React.useState<Alert[]>([]); // We'll need to implement an alerts API/redux slice later

  // Get favorite sensors
  const favoriteSensors = React.useMemo(
    () => {
      const favorites = sensors.filter((sensor) => sensor.favorite || sensor.isStarred);
      console.log('[Dashboard] Favorite sensors:', favorites.length, favorites.map(s => s.displayName || s.mac));
      return favorites;
    },
    [sensors]
  );

  // Set default selected favorite sensor when favorites change
  React.useEffect(() => {
    if (favoriteSensors.length > 0 && !selectedFavoriteSensor) {
      console.log('[Dashboard] Setting default favorite sensor:', favoriteSensors[0]._id);
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
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dispatch]);

  // Get sorted sensors by battery level (lowest first) for recent sensors
  // Show up to 5 most recent sensors (by lastSeen), regardless of battery
  const recentSensors = React.useMemo(() => {
    console.log('[Dashboard] All sensors count:', sensors.length);
    console.log('[Dashboard] Sensors details:', sensors.map(s => ({
      id: s._id,
      name: s.displayName || s.mac,
      type: s.type,
      favorite: s.favorite || s.isStarred,
      lastSeen: s.lastSeen
    })));
    return [...sensors]
      .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
      .slice(0, 5);
  }, [sensors]);

  // Fetch telemetry data for favorite sensors when they change or time range changes
  React.useEffect(() => {
    if (selectedFavoriteSensor) {
      console.log('[Dashboard] Telemetry fetch triggered - sensor:', selectedFavoriteSensor, 'isLiveMode:', isLiveMode);
      
      // Always fetch some historical data to ensure we have data to display
      // In live mode, this serves as initial/baseline data that gets updated with live readings
      const currentTimeRange = timeRange || {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Default to last 24 hours
        end: new Date()
      };

      console.log('[Dashboard] Fetching telemetry for sensor:', selectedFavoriteSensor, 'timeRange:', currentTimeRange, 'mode:', isLiveMode ? 'live' : 'historical');
      
      dispatch(
        fetchTelemetry({
          sensorIds: [selectedFavoriteSensor],
          timeRange: {
            start: currentTimeRange.start.toISOString(),
            end: currentTimeRange.end.toISOString(),
          },
        }) as any
      );
    } else {
      console.log('[Dashboard] No selected favorite sensor for telemetry fetch');
    }
  }, [dispatch, selectedFavoriteSensor, isLiveMode, timeRange]);

  // Handle time range change for favorite sensor view
  const handleTimeRangeChange = (newTimeRange: any) => {
    dispatch(setTimeRange(newTimeRange));
  };

  // Get chart data for selected favorite sensor
  const selectedFavoriteSensorData = React.useMemo(() => {
    console.log('[Dashboard] Computing chart data - selectedFavoriteSensor:', selectedFavoriteSensor);
    console.log('[Dashboard] Current telemetryData keys:', Object.keys(telemetryData));
    console.log('[Dashboard] Full telemetryData:', telemetryData);
    
    if (!selectedFavoriteSensor) {
      console.log('[Dashboard] No selected favorite sensor');
      return null;
    }
    
    const sensorData = telemetryData[selectedFavoriteSensor];
    if (!sensorData) {
      console.log('[Dashboard] No telemetry data for sensor:', selectedFavoriteSensor);
      return null;
    }
    
    console.log('[Dashboard] Creating chart config for sensor:', selectedFavoriteSensor, 'data:', sensorData);
    
    return {
      type: sensorData.type,
      unit: sensorData.unit,
      series: sensorData.series || [],
      color: '#006FEE', // Primary color
    };
  }, [selectedFavoriteSensor, telemetryData]);

  const stats = React.useMemo(
    () => ({
      totalGateways: gatewayStats?.totalGateways || 0,
      activeGateways: gateways.filter(gateway => getGatewayOnlineStatus(gateway)).length,
      totalSensors: sensorStats?.claimed || 0,
      activeSensors: sensorStats?.liveSensors || 0,
      favoriteSensors: favoriteSensors.length,
      lowBatterySensors: sensors.filter(s => s.battery && s.battery < 20).length,
    }),
    [gatewayStats, sensorStats, gateways, favoriteSensors.length, sensors]
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Progress
          size="sm"
          isIndeterminate
          aria-label="Loading..."
          className="max-w-md"
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl p-4 space-y-6">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-bold mb-6"
      >
        Dashboard Overview
      </motion.h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Gateways"
          value={stats.totalGateways.toString()}
          icon="lucide:cpu"
          color="primary"
        />
        <StatsCard
          title="Active Gateways"
          value={stats.activeGateways.toString()}
          icon="lucide:activity"
          color="success"
        />
        <StatsCard
          title="Total Sensors"
          value={stats.totalSensors.toString()}
          icon="lucide:radio"
          color="secondary"
        />
        <StatsCard
          title="Active Sensors"
          value={stats.activeSensors.toString()}
          icon="lucide:signal"
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gateways Card */}
        <Card>
          <CardHeader className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Recent Gateways</h2>
            <Button
              as={Link}
              to="/dashboard/gateways"
              color="primary"
              variant="light"
              endContent={<Icon icon="lucide:chevron-right" />}
            >
              View All
            </Button>
          </CardHeader>
          <CardBody>
            <Table removeWrapper aria-label="Recent Gateways">
              <TableHeader>
                <TableColumn>GATEWAY</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn>LAST SEEN</TableColumn>
              </TableHeader>
              <TableBody>
                {gateways.slice(0, 5).map((gateway) => (
                  <TableRow key={gateway._id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-bold text-small">
                          {gateway.label || gateway.mac}
                        </span>
                        <span className="text-tiny text-default-400">
                          {gateway.mac}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const isOnline = getGatewayOnlineStatus(gateway);
                        return (
                          <Chip
                            className="capitalize"
                            color={getStatusColor(isOnline)}
                            size="sm"
                            variant="flat"
                            startContent={
                              <Icon 
                                icon={isOnline ? "lucide:wifi" : "lucide:wifi-off"} 
                                className="w-3 h-3" 
                              />
                            }
                          >
                            {getStatusText(isOnline)}
                          </Chip>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {gateway.lastSeen
                        ? formatDistanceToNow(new Date(gateway.lastSeen), {
                            addSuffix: true,
                          })
                        : "Never"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

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
                <TableColumn>LAST VALUE</TableColumn>
              </TableHeader>
              <TableBody>
                {recentSensors.length > 0 ? (
                  recentSensors.map((sensor) => {
                    const telemetryDataForSensor = telemetryData[sensor._id];
                    // Show live value if in live mode, else show last value
                    const lastValue = isLiveMode && telemetryDataForSensor?.current !== undefined
                      ? telemetryDataForSensor.current
                      : sensor.lastValue;
                    // Show live timestamp if in live mode, else lastSeen
                    const lastReading = isLiveMode && telemetryDataForSensor?.lastUpdated
                      ? new Date(telemetryDataForSensor.lastUpdated)
                      : new Date(sensor.lastSeen);
                    
                    console.log('[Dashboard] Rendering sensor row:', sensor.displayName || sensor.mac, 'last value:', lastValue);
                    
                    return (
                      <TableRow key={sensor._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-bold text-small">
                                {sensor.displayName || sensor.mac}
                              </span>
                              {(sensor.favorite || sensor.isStarred) && (
                                <Icon icon="lucide:star" className="w-3 h-3 text-warning" />
                              )}
                            </div>
                            <span className="text-tiny text-default-400">
                              {sensor.mac}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Chip
                            className="capitalize"
                            color={
                              sensor.type === "temperature" ? "primary" :
                              sensor.type === "pressure" ? "secondary" :
                              sensor.type === "humidity" ? "success" : "default"
                            }
                            size="sm"
                            variant="flat"
                          >
                            {sensor.type}
                          </Chip>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-bold text-small">
                              {lastValue} {sensor.lastUnit}
                            </span>
                            {isLiveMode && (
                              <span className="text-tiny text-success">● Live</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>
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

      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Recent Alerts</h2>
        </CardHeader>
        <CardBody>
          {alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg ${
                    alert.severity === "high"
                      ? "bg-danger-100 text-danger-700"
                      : alert.severity === "medium"
                      ? "bg-warning-100 text-warning-700"
                      : "bg-info-100 text-info-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon
                        icon={
                          alert.severity === "high"
                            ? "lucide:alert-triangle"
                            : alert.severity === "medium"
                            ? "lucide:alert-circle"
                            : "lucide:info"
                        }
                        className="w-5 h-5"
                      />
                      <span className="font-medium">{alert.message}</span>
                    </div>
                    <Tooltip content={new Date(alert.timestamp).toLocaleString()}>
                      <span className="text-sm">
                        {formatDistanceToNow(new Date(alert.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-default-400">No recent alerts</div>
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

      {/* Enhanced Favorite Sensors Section */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold">Favorite Sensor</h2>
            <p className="text-sm text-default-500">Monitor your selected favorite sensor with live data and analytics</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-default-600">Live Mode:</span>
              <Button
                size="sm"
                variant={isLiveMode ? "solid" : "bordered"}
                color={isLiveMode ? "success" : "default"}
                startContent={<Icon icon={isLiveMode ? "lucide:radio" : "lucide:database"} className="w-3 h-3" />}
                onPress={() => {
                  console.log('[Dashboard] Toggling live mode from:', isLiveMode, 'to:', !isLiveMode);
                  dispatch(toggleLiveMode({ 
                    enable: !isLiveMode, 
                    gatewayIds: gateways.map(g => g._id) 
                  }) as any);
                }}
              >
                {isLiveMode ? "Live" : "Historical"}
              </Button>
            </div>
            {!isLiveMode && (
              <TimeRangeSelector
                timeRange={timeRange}
                onTimeRangeChange={handleTimeRangeChange}
                isMobile={false}
              />
            )}
          </div>
        </CardHeader>
        <CardBody>
          {favoriteSensors.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {/* Sensor Selection Dropdown - HeroUI */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <Select
                  label="Select Favorite Sensor"
                  placeholder="Choose a sensor to view"
                  selectedKeys={selectedFavoriteSensor ? [selectedFavoriteSensor] : []}
                  onSelectionChange={(keys) => {
                    const selectedKey = Array.from(keys)[0] as string;
                    console.log('[Dashboard] Favorite sensor selected:', selectedKey);
                    setSelectedFavoriteSensor(selectedKey);
                  }}
                  className="max-w-xs"
                  size="sm"
                  renderValue={() => {
                    if (selectedFavoriteSensor) {
                      const sensor = favoriteSensors.find(s => s._id === selectedFavoriteSensor);
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
                <div className="flex items-center gap-3">
                  <span className="text-sm text-default-600">View Mode:</span>
                  <Tabs
                    selectedKey={favoriteViewMode}
                    onSelectionChange={(key) => setFavoriteViewMode(key as 'chart' | 'table')}
                    size="sm"
                    variant="bordered"
                  >
                    <Tab key="chart" title="Chart" />
                    <Tab key="table" title="Table" />
                  </Tabs>
                </div>
              </div>

              {/* Sensor Info Panel */}
              {(() => {
                const sensor = favoriteSensors.find(s => s._id === selectedFavoriteSensor);
                if (!sensor) return null;
                const telemetryDataForSensor = telemetryData[sensor._id] || {};
                const currentValue = isLiveMode && telemetryDataForSensor.current !== undefined
                  ? telemetryDataForSensor.current
                  : sensor.lastValue;
                return (
                  <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-default-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-default-600">Current Value</p>
                      <p className="text-lg font-bold text-primary">{currentValue} {sensor.lastUnit}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-default-600">Battery</p>
                      <p className={`text-lg font-bold ${
                        (sensor.battery || 0) > 50 ? "text-success" :
                        (sensor.battery || 0) > 20 ? "text-warning" : "text-danger"
                      }`}>{sensor.battery || 0}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-default-600">Status</p>
                      <Chip color={sensor.isOnline ? "success" : "danger"} size="sm" variant="flat">
                        {sensor.isOnline ? "Online" : "Offline"}
                      </Chip>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-default-600">Data Source</p>
                      <Chip color={isLiveMode ? "success" : "primary"} size="sm" variant="flat" startContent={<Icon icon={isLiveMode ? "lucide:radio" : "lucide:database"} className="w-3 h-3" />}>
                        {isLiveMode ? "Live" : "Historical"}
                      </Chip>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-default-600">Last Seen</p>
                      <p className="text-lg font-bold text-default-700">{sensor.lastSeen ? new Date(sensor.lastSeen).toLocaleString() : "-"}</p>
                    </div>
                  </motion.div>
                );
              })()}

              {/* Chart/Table View */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {favoriteViewMode === 'chart' ? (
                  <div className="h-80">
                    {selectedFavoriteSensor && telemetryData[selectedFavoriteSensor] && telemetryData[selectedFavoriteSensor].series?.length > 0 ? (
                      <LineChart
                        config={{
                          type: telemetryData[selectedFavoriteSensor].type || "temperature",
                          unit: telemetryData[selectedFavoriteSensor].unit || "°C",
                          series: telemetryData[selectedFavoriteSensor].series || [],
                          color: '#006FEE',
                        }}
                        isLiveMode={isLiveMode}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Icon icon="lucide:bar-chart-3" className="w-12 h-12 text-default-300 mb-3 mx-auto" />
                          <p className="text-default-600">
                            {selectedFavoriteSensor ? 'Loading chart data...' : 'No chart data available'}
                          </p>
                          <p className="text-sm text-default-500">
                            {isLiveMode 
                              ? "Live data will appear here once sensor starts transmitting" 
                              : "Historical data will load for the selected time range"
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table removeWrapper aria-label="Sensor Data Table">
                      <TableHeader>
                        <TableColumn>TIMESTAMP</TableColumn>
                        <TableColumn>VALUE</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {selectedFavoriteSensor && telemetryData[selectedFavoriteSensor]?.series?.length > 0 ? (
                          telemetryData[selectedFavoriteSensor].series.slice(-10).reverse().map((point, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{new Date(point.timestamp).toLocaleString()}</TableCell>
                              <TableCell>{point.value} {telemetryData[selectedFavoriteSensor].unit}</TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={2}>
                              <div className="text-center py-8">
                                <Icon icon="lucide:database" className="w-8 h-8 text-default-300 mb-2 mx-auto" />
                                <p className="text-default-600">
                                  {selectedFavoriteSensor ? 'Loading table data...' : 'No table data available'}
                                </p>
                                <p className="text-sm text-default-500">
                                  {isLiveMode 
                                    ? "Live data will appear here once sensor starts transmitting" 
                                    : "Historical data will load for the selected time range"
                                  }
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <Icon icon="lucide:star-off" className="w-16 h-16 text-default-300 mb-4" />
              <p className="text-default-600 mb-4">No favorite sensors added yet</p>
              <p className="text-sm text-default-500 mb-6">Star your sensors from the Sensors page to see them here</p>
              <Button as={Link} to="/dashboard/sensors" color="primary" startContent={<Icon icon="lucide:star" />}>Browse Sensors</Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};