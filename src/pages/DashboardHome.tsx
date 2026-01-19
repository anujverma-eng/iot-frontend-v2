// src/pages/DashboardHome.tsx
import React from "react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { formatNumericValue } from "../utils/numberUtils";
import { AppDispatch, RootState } from "../store";
import { useOfflineDetectionIntegration } from "../hooks/useOfflineDetectionIntegration";
import { useLiveDataReadiness } from "../hooks/useLiveDataReadiness";
import { useSensorModeTransition } from "../hooks/useSensorModeTransition";
import { useBreakpoints } from "../hooks/use-media-query";
import { LiveDataLoading } from "../components/visualization/live-data-loading";
import { fetchGateways, fetchGatewayStats, selectGateways, selectGatewayStats } from "../store/gatewaySlice";
import {
  fetchSensors,
  fetchFavoriteSensors,
  fetchSensorStats,
  selectSensors,
  selectFavoriteSensors,
  selectSensorsLoading,
  selectSensorStats,
  selectEnhancedSensorStats,
  toggleSensorStar,
  addSelectedSensorId,
  selectSelectedSensorIds,
} from "../store/sensorsSlice";
import {
  fetchOptimizedTelemetry,
  selectTelemetryData,
  selectTelemetryLoading,
  selectTimeRange,
  setTimeRange,
  selectMaxLiveReadings,
  clearTelemetry,
  setSensorHistoricalMode,
  selectSensorHistoricalMode,
} from "../store/telemetrySlice";
import { createOptimizedTelemetryRequest } from "../utils/optimizationUtils";
import { 
  selectIsLiveMode,
  selectIsConnecting,
} from "../store/liveDataSlice";
import { selectActiveOrgReady } from "../store/activeOrgSlice";
import { Gateway } from "../types/gateway";
import { Sensor, ChartConfig } from "../types/sensor";
import { StatsCard } from "../components/stats-card";
import { LineChart } from "../components/visualization/line-chart";
import { TableView } from "../components/analytics/table-view";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Tooltip,
  Progress,
  Select,
  SelectItem,
  Tabs,
  Tab,
  TableRow,
  TableCell,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
} from "@heroui/react";
import { TimeRangeSelector } from "../components/analytics/time-range-selector";

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

  // Use responsive breakpoints for mobile optimization
  const { isMobile, isSmallScreen, isShortHeight } = useBreakpoints();

  // Get state from Redux
  const gateways = useSelector(selectGateways);
  const sensors = useSelector(selectSensors);
  const favoriteSensors = useSelector(selectFavoriteSensors);
  const sensorsLoading = useSelector(selectSensorsLoading);
  const gatewayStats = useSelector(selectGatewayStats);
  const sensorStats = useSelector(selectEnhancedSensorStats); // Use enhanced stats for real-time calculations
  const starredSensorIds = useSelector(selectSelectedSensorIds);
  const globalIsLiveMode = useSelector(selectIsLiveMode);
  const isConnecting = useSelector(selectIsConnecting);
  const telemetryData = useSelector(selectTelemetryData);
  const telemetryLoading = useSelector(selectTelemetryLoading);
  const timeRange = useSelector(selectTimeRange);
  const maxLiveReadings = useSelector(selectMaxLiveReadings);
  const activeOrgReady = useSelector(selectActiveOrgReady);
  const sensorHistoricalMode = useSelector(selectSensorHistoricalMode);

  // Initialize offline detection service
  useOfflineDetectionIntegration();

  // Local state
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedSensor, setSelectedSensor] = React.useState<string | null>(null);
  const [favoriteViewMode, setFavoriteViewMode] = React.useState<"chart" | "table">("chart");
  const [alerts, setAlerts] = React.useState<Alert[]>([]); // We'll need to implement an alerts API/redux slice later
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = React.useState(false);
  
  // Track when we're fetching NEW data (time range change, sensor change, mode change)
  // This forces the loader to show even if old data exists
  const [isFetchingNewData, setIsFetchingNewData] = React.useState(false);

  // Add refs for tracking requests
  const lastTimeRangeRequestRef = React.useRef<string>("");
  const requestInProgressRef = React.useRef<boolean>(false);

  // Use the per-sensor mode transition hook
  // DISABLED: We handle data fetching manually in this component with correct 'analytics' page context
  // The hook uses 'dashboard' context which gives 200 targetPoints instead of 800
  // We only use it for isLiveMode/isHistoricalMode state, not for auto-fetching
  const { isLiveMode, isHistoricalMode } = useSensorModeTransition({
    sensorId: selectedSensor,
    pageContext: 'analytics',  // Use analytics context for consistent 800 targetPoints
    chartType: 'line-chart',
    disabled: true,  // Disable auto-fetch - we handle fetching manually below
  });

  // Live data readiness hook for charts
  const liveDataReadiness = useLiveDataReadiness(selectedSensor, false); // false = not filtering offline sensors

  // Enhanced loading state that considers live data readiness and request progress
  // But excludes loading for offline sensors in live mode to show proper offline UI
  const effectiveIsLoading = React.useMemo(() => {
    // If we're fetching new data (time range change, sensor change, mode change), always show loading
    if (isFetchingNewData) {
      return true;
    }
    
    // If we're in live mode and have a selected sensor that's offline, don't show loading
    if (isLiveMode && selectedSensor) {
      const sensor = sensors.find(s => s._id === selectedSensor);
      if (sensor?.isOnline === false) {
        return false; // Force no loading for offline sensors in live mode
      }
    }
    
    return telemetryLoading || liveDataReadiness.shouldShowLoading || requestInProgressRef.current;
  }, [telemetryLoading, liveDataReadiness.shouldShowLoading, isFetchingNewData, isLiveMode, selectedSensor, sensors]);

  // DEBUG: Log when telemetry data changes (only when significant changes occur)
  const prevTelemetryRef = React.useRef<any>(null);
  React.useEffect(() => {
    const currentData = telemetryData[selectedSensor || ""];
    const prevData = prevTelemetryRef.current;
    
    // Only log if there's a meaningful change
    const hasSignificantChange = !prevData || 
      (currentData?.series?.length !== prevData?.series?.length) ||
      (telemetryLoading !== prevData?.wasLoading);
    
    if (hasSignificantChange) {
      prevTelemetryRef.current = {
        series: currentData?.series || [],
        wasLoading: telemetryLoading
      };
    }

    // Reset loading flags when telemetry loading completes
    // This ensures we show the new data after fetch completes
    if (!telemetryLoading && (requestInProgressRef.current || isFetchingNewData)) {
      requestInProgressRef.current = false;
      setIsFetchingNewData(false);
    }
  }, [telemetryData, selectedSensor, telemetryLoading, isFetchingNewData]);

  // Note: Mode transitions are now handled by useSensorModeTransition hook
  // It automatically fetches appropriate data when switching between live/historical modes

  // Mark initial load as completed immediately - we'll fetch limited data for first load
  React.useEffect(() => {
    if (!hasInitialLoadCompleted) {
      setHasInitialLoadCompleted(true);
    }
  }, [hasInitialLoadCompleted]);

  // Set default selected favorite sensor when favorites change
  React.useEffect(() => {
    if (favoriteSensors.length > 0 && !selectedSensor) {
      setSelectedSensor(favoriteSensors[0]._id);
    }
  }, [favoriteSensors, selectedSensor]);

  React.useEffect(() => {
    const fetchData = async () => {
      // Don't fetch org-scoped data until active org is ready
      if (!activeOrgReady) {
        // Set loading to false when org is not ready - this allows the dashboard 
        // layout to show (with the org picker modal if needed)
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        await Promise.all([
          dispatch(fetchGateways({ page: 1, limit: 5, search: "" }) as any),
          // Fetch more sensors (like analytics page) so selectEnhancedSensorStats 
          // can calculate accurate live/offline counts from the sensors array
          dispatch(
            fetchSensors({
              page: 1,
              limit: 50,
              claimed: true,
              search: "",
              sort: 'lastSeen',
              dir: 'desc'
            }) as any
          ),
          // Fetch favorite sensors separately with dedicated thunk
          dispatch(fetchFavoriteSensors({ page: 1, limit: 50, claimed: true, search: "" }) as any),
          dispatch(fetchGatewayStats() as any),
          dispatch(fetchSensorStats() as any),
        ]);
      } catch (error) {

      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dispatch, activeOrgReady]);

  // Get sorted sensors by battery level (lowest first) for recent sensors
  // Show up to 5 sensors sorted by lowest battery level first
  const recentSensors = React.useMemo(() => {
    return [...sensors]
      .sort((a, b) => (a.battery || 0) - (b.battery || 0)) // Sort by lowest battery first
      .slice(0, 5);
  }, [sensors]);

  // Optimized telemetry fetching with live data readiness
  React.useEffect(() => {
    if (!selectedSensor || !activeOrgReady) {
      return;
    }
    
    // Create a request ID based on current parameters
    const currentRequest = `${selectedSensor}-${timeRange?.start}-${timeRange?.end}-${isLiveMode}`;

    // Don't make duplicate requests or multiple concurrent requests
    if (lastTimeRangeRequestRef.current === currentRequest || requestInProgressRef.current) {
      return;
    }

    // Check if we should fetch API data based on live data readiness
    if (!liveDataReadiness.shouldFetchApiData) {
      return;
    }

    // Mark request as in progress and update request ref
    requestInProgressRef.current = true;
    lastTimeRangeRequestRef.current = currentRequest;
    setIsFetchingNewData(true); // Force loader to show on initial load

    // Determine time range to use based on initial load vs normal operation
    let timeRangeToUse;

    if (isLiveMode) {
      // For live mode, fetch last ~5 minutes to match live data view
      // Add +5 minute buffer to end time to account for network latency
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - (5 * 60 * 1000));
      const endWithBuffer = new Date(now.getTime() + (5 * 60 * 1000)); // +5 minute buffer
      
      timeRangeToUse = {
        start: fiveMinutesAgo,
        end: endWithBuffer
      };
    } else {
      // For historical mode, use selected time range or default to last 24 hours
      const currentTimeRange = timeRange || {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };
      
      timeRangeToUse = currentTimeRange;
    }

    // Create optimized request for dashboard chart
    // Use 'analytics' page context to get consistent targetPoints (800) with analytics/solo-view pages
    const optimizedRequest = createOptimizedTelemetryRequest({
      sensorIds: [selectedSensor],
      timeRange: {
        start: timeRangeToUse.start.toISOString(),
        end: timeRangeToUse.end.toISOString(),
      },
      context: {
        page: 'analytics',
        chartType: 'line-chart'
      },
      // Only pass liveMode when actually in live mode - otherwise backend uses targetPoints
      liveMode: isLiveMode ? { enabled: true, maxReadings: maxLiveReadings } : undefined
    });

    dispatch(fetchOptimizedTelemetry(optimizedRequest) as any);

    // Note: requestInProgressRef.current will be reset when telemetry loading completes
    // via the telemetry data change effect above
  }, [dispatch, selectedSensor, timeRange, liveDataReadiness.shouldFetchApiData, isLiveMode, activeOrgReady]);

  // Handle time range change for favorite sensor view
  const handleTimeRangeChange = (newTimeRange: any) => {
    dispatch(setTimeRange(newTimeRange));
    
    // ALWAYS fetch new data when time range changes, regardless of live/offline mode
    // The user explicitly selected a time range, so we should fetch historical data for that range
    if (selectedSensor) {
      // Create request ID to prevent duplicate fetches from the useEffect
      const newRequestId = `${selectedSensor}-${newTimeRange.start}-${newTimeRange.end}-${isLiveMode}`;
      
      // Set the ref immediately to prevent the useEffect from also firing
      lastTimeRangeRequestRef.current = newRequestId;
      requestInProgressRef.current = true;
      setIsFetchingNewData(true); // Force loader to show while fetching
      
      // When user changes time range, we're showing historical data for that range
      // Use 'analytics' page context to get consistent targetPoints (800) with analytics/solo-view pages
      const request = createOptimizedTelemetryRequest({
        sensorIds: [selectedSensor],
        timeRange: {
          start: newTimeRange.start.toISOString(),
          end: newTimeRange.end.toISOString()
        },
        context: {
          page: 'analytics',
          chartType: 'line-chart'
        },
        // When time range is explicitly changed, we want full historical data
        // Only use live mode limiting when streaming real-time data
        liveMode: isLiveMode ? { enabled: true, maxReadings: maxLiveReadings } : undefined
      });
      
      dispatch(fetchOptimizedTelemetry(request) as any);
    }
  };

  // Handle live mode change for current sensor
  const handleLiveModeChange = (enable: boolean) => {
    if (!selectedSensor) return;
    
    // Update mode state first
    dispatch(setSensorHistoricalMode({
      sensorId: selectedSensor,
      isHistorical: !enable,
      timeRange: !enable ? timeRange : undefined
    }));
    
    // Immediately fetch appropriate data for the new mode
    // This prevents the delay from waiting for useEffect to trigger
    requestInProgressRef.current = true;
    setIsFetchingNewData(true); // Force loader to show while fetching
    
    let fetchTimeRange;
    if (enable) {
      // Switching to LIVE mode - fetch recent data with buffer
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - (5 * 60 * 1000));
      const endWithBuffer = new Date(now.getTime() + (5 * 60 * 1000));
      fetchTimeRange = { start: fiveMinutesAgo, end: endWithBuffer };
    } else {
      // Switching to HISTORICAL mode - use selected time range
      fetchTimeRange = timeRange || {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };
    }
    
    // Update last request ref to prevent duplicate fetch from useEffect
    lastTimeRangeRequestRef.current = `${selectedSensor}-${fetchTimeRange.start}-${fetchTimeRange.end}-${enable}`;
    
    const request = createOptimizedTelemetryRequest({
      sensorIds: [selectedSensor],
      timeRange: {
        start: fetchTimeRange.start.toISOString(),
        end: fetchTimeRange.end.toISOString(),
      },
      context: {
        page: 'analytics',
        chartType: 'line-chart'
      },
      // Only use liveMode for live mode, otherwise let backend use targetPoints (800)
      liveMode: enable ? { enabled: true, maxReadings: maxLiveReadings } : undefined
    });
    
    dispatch(fetchOptimizedTelemetry(request) as any);
  };

  // Ensure time range is always set - fallback to default if not provided
  React.useEffect(() => {
    if (!timeRange) {
      const defaultTimeRange = {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date(),
      };
      dispatch(setTimeRange(defaultTimeRange));
    }
  }, [timeRange, dispatch]);

  // Get chart data for selected favorite sensor
  // Simplified to match analytics/solo-view behavior - directly use telemetry data without caching stale data
  const selectedSensorData: ChartConfig | null = React.useMemo(() => {
    if (!selectedSensor) {
      return null;
    }

    const data = telemetryData[selectedSensor];
    const sensor = sensors.find(s => s._id === selectedSensor);
    const isSensorOffline = sensor?.isOnline === false;
    
    // In live mode, if sensor is offline, don't show any chart data - force offline UI
    if (isLiveMode && isSensorOffline) {
      return null;
    }
    
    // Check if we have valid current data - same logic as analytics/solo-view
    if (!data || !data.series || data.series.length === 0) {
      return null;
    }

    const currentSeries = data.series;
    
    // Apply dynamic reading limit in live mode based on user's selection
    // In offline mode, show all data for proper historical analysis
    const shouldLimitToLatest = isLiveMode;
    const displaySeries = shouldLimitToLatest && currentSeries.length > maxLiveReadings ? 
      currentSeries.slice(-maxLiveReadings) : currentSeries;

    return {
      type: data.type,
      unit: data.unit,
      series: displaySeries,
      color: "#006FEE", // Primary color
    };
  }, [selectedSensor, telemetryData, isLiveMode, maxLiveReadings, sensors]);

  // DEBUG: Log chart render decision variables (only when decision changes)
  const prevRenderDecisionRef = React.useRef<string>("");
  React.useEffect(() => {
    const hasData = selectedSensor && selectedSensorData;
    const shouldShowLoading = effectiveIsLoading || isLoading || sensorsLoading || (!selectedSensor && sensors.length > 0);
    const renderChoice = hasData ? "CHART" : shouldShowLoading ? "LOADING" : "NO_DATA";
    
    // Only log when the render decision actually changes
    if (prevRenderDecisionRef.current !== renderChoice) {
      prevRenderDecisionRef.current = renderChoice;
    }
  }, [selectedSensor, selectedSensorData, effectiveIsLoading, isLoading, sensorsLoading, sensors.length, telemetryLoading, liveDataReadiness.shouldShowLoading, isLiveMode]);

  const stats = React.useMemo(
    () => ({
      totalGateways: gatewayStats?.totalGateways || 0,
      activeGateways: gateways.filter((gateway) => getGatewayOnlineStatus(gateway)).length,
      totalSensors: sensorStats?.claimed || 0,
      activeSensors: sensorStats?.liveSensors || 0,
      offlineSensors: sensorStats?.offlineSensors || 0,
      favoriteSensors: favoriteSensors.length,
      lowBatterySensors: sensorStats?.lowBatterySensors || 0,
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

  // Show waiting state when org is not ready (e.g., waiting for user to select org)
  if (!activeOrgReady) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center space-y-4">
          <Progress size="sm" isIndeterminate aria-label="Setting up organization..." className="max-w-md" />
          <p className="text-default-500">Setting up your organization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${
      isMobile 
        ? "p-0 space-y-3 m-0" // Mobile: reduced padding and spacing
        : "p-0 sm:p-4 lg:p-6 space-y-4 sm:space-y-6" // Desktop: normal spacing
    }`}>
      {/* <DebugActiveOrg /> */}
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-2xl sm:text-3xl font-bold ${
          isMobile 
            ? "mb-3 px-1" // Mobile: reduced margin and padding
            : "mb-4 sm:mb-6 px-2 sm:px-0" // Desktop: normal spacing
        }`}
      >
        Home
      </motion.h1>

      <div className={`grid grid-cols-2 lg:grid-cols-4 ${
        isMobile 
          ? "gap-2 px-1" // Mobile: reduced gap and padding
          : "gap-3 sm:gap-4 px-2 sm:px-0" // Desktop: normal spacing
      }`}>
        <StatsCard
          title="Total Sensors"
          value={(stats.totalSensors ?? 0).toString()}
          icon="lucide:radio"
          color="primary"
        />
        <StatsCard
          title="Live Sensors"
          value={(stats.activeSensors ?? 0).toString()}
          icon="lucide:wifi"
          color="success"
        />
        <StatsCard
          title="Offline Sensors"
          value={(stats.offlineSensors ?? 0).toString()}
          icon="lucide:wifi-off"
          color="danger"
        />
        <StatsCard
          title="Low Battery"
          value={(stats.lowBatterySensors ?? 0).toString()}
          icon="lucide:battery-warning"
          color="danger"
        />
      </div>

      <div className={`grid grid-cols-1 ${
        isMobile 
          ? "gap-3 px-1" // Mobile: reduced gap and padding
          : "gap-4 sm:gap-6 px-2 sm:px-0" // Desktop: normal spacing
      }`}>
        {/* Sensors Card */}
        <Card>
          <CardHeader className={`flex justify-between items-center ${
            isMobile ? "px-3 py-3" : "px-6 py-4" // Mobile: reduced padding
          }`}>
            <h2 className={`font-semibold ${
              isMobile ? "text-lg" : "text-xl" // Mobile: smaller heading
            }`}>Recent Sensors</h2>
            <Button
              as={Link}
              to="/dashboard/sensors"
              color="primary"
              variant="light"
              size={isMobile ? "sm" : "md"} // Mobile: smaller button
              endContent={<Icon icon="lucide:chevron-right" />}
            >
              View All
            </Button>
          </CardHeader>
          <CardBody className={isMobile ? "px-3 py-2" : "px-6 py-4"}> {/* Mobile: reduced padding */}
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
                              {(sensor.favorite) && (
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
        <CardHeader className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
          isMobile ? "px-3 py-3" : "px-6 py-4" // Mobile: reduced padding
        }`}>
          <div>
            <h2 className={`font-semibold ${
              isMobile ? "text-lg" : "text-xl" // Mobile: smaller heading
            }`}>Favorite Sensor</h2>
            <p className={`text-default-500 ${
              isMobile ? "text-xs" : "text-sm" // Mobile: smaller description
            }`}>
              Monitor your selected favorite sensor with live data and analytics
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <TimeRangeSelector 
              timeRange={timeRange} 
              onTimeRangeChange={handleTimeRangeChange} 
              isLiveMode={isLiveMode}
              onLiveModeChange={handleLiveModeChange}
              liveStatus={isConnecting ? 'connecting' : isLiveMode ? 'connected' : 'disconnected'}
              showApplyButtons={true}
              isMobile={true}
            />
          </div>
        </CardHeader>
        <CardBody className={isMobile ? "px-1 py-2" : "px-6 py-4"}> {/* Mobile: reduced padding */}
          {favoriteSensors.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${
              isMobile ? "space-y-3" : "space-y-4 sm:space-y-6" // Mobile: reduced spacing
            }`}>
              {/* Sensor Selection and View Mode - Mobile Optimized */}
              <div className={isMobile ? "space-y-3" : "space-y-4"}> {/* Mobile: reduced spacing */}
                {/* Mobile: Stack vertically, Desktop: Side by side */}
                <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:gap-4 lg:items-end lg:justify-between">
                  <div className="flex-1 lg:max-w-sm">
                    <Select
                      label="Select Favorite Sensor"
                      placeholder="Choose a sensor to view"
                      selectedKeys={selectedSensor ? [selectedSensor] : []}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;
                        if (!selectedKey || selectedKey === selectedSensor) return;
                        
                        setSelectedSensor(selectedKey);
                        
                        // Immediately fetch data for the new sensor to avoid delays
                        // Reset refs to allow the fetch
                        requestInProgressRef.current = true;
                        setIsFetchingNewData(true); // Force loader to show while fetching
                        
                        // Check what mode this sensor should be in
                        const sensorMode = sensorHistoricalMode[selectedKey];
                        const sensorIsLive = globalIsLiveMode && !sensorMode;
                        
                        let fetchTimeRange;
                        if (sensorIsLive) {
                          // Live mode - fetch recent data with buffer
                          const now = new Date();
                          const fiveMinutesAgo = new Date(now.getTime() - (5 * 60 * 1000));
                          const endWithBuffer = new Date(now.getTime() + (5 * 60 * 1000));
                          fetchTimeRange = { start: fiveMinutesAgo, end: endWithBuffer };
                        } else {
                          // Historical mode - use selected time range
                          fetchTimeRange = timeRange || {
                            start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                            end: new Date(),
                          };
                        }
                        
                        // Update ref to prevent duplicate from useEffect
                        lastTimeRangeRequestRef.current = `${selectedKey}-${fetchTimeRange.start}-${fetchTimeRange.end}-${sensorIsLive}`;
                        
                        const request = createOptimizedTelemetryRequest({
                          sensorIds: [selectedKey],
                          timeRange: {
                            start: fetchTimeRange.start.toISOString(),
                            end: fetchTimeRange.end.toISOString(),
                          },
                          context: {
                            page: 'analytics',
                            chartType: 'line-chart'
                          },
                          liveMode: sensorIsLive ? { enabled: true, maxReadings: maxLiveReadings } : undefined
                        });
                        
                        dispatch(fetchOptimizedTelemetry(request) as any);
                      }}
                      className="w-full"
                      size="sm"
                      renderValue={() => {
                        if (selectedSensor) {
                          const sensor = favoriteSensors.find((s) => s._id === selectedSensor);
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
                const sensor = favoriteSensors.find((s) => s._id === selectedSensor);
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
                    className={isMobile ? "space-y-3" : "space-y-4"} // Mobile: reduced spacing
                  >
                    {/* Mobile-first responsive sensor info */}
                    <div className={`bg-default-50 rounded-lg ${
                      isMobile ? "p-3" : "p-4" // Mobile: reduced padding
                    }`}>
                      {/* Mobile Layout - Stacked Cards */}
                      <div className={`block lg:hidden ${
                        isMobile ? "space-y-2" : "space-y-3" // Mobile: reduced spacing
                      }`}>
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
                {favoriteViewMode === "chart" ? (
                  <div className="w-full">
                    {/* Chart Container - Using explicit height for proper Recharts ResponsiveContainer */}
                    <div 
                      className={`bg-default-50 rounded-lg border border-default-200 w-full ${
                        isMobile ? 'h-[400px]' : 'h-[500px]'
                      }`}
                    >
                      {(() => {
                        // First priority: Check if sensor is offline and we're in live mode
                        const sensor = favoriteSensors.find((s) => s._id === selectedSensor);
                        const isSensorOffline = sensor?.isOnline === false;
                        const shouldShowOfflineFallback = isLiveMode && isSensorOffline;

                        // Show offline fallback BEFORE checking loading states
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
                                      // Switch to historical mode for this sensor only
                                      if (selectedSensor) {
                                        dispatch(
                                          setSensorHistoricalMode({
                                            sensorId: selectedSensor,
                                            isHistorical: true,
                                            timeRange: timeRange
                                          })
                                        );
                                      }
                                    }}
                                  >
                                    View Historical Data
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Second priority: Show loading when fetching NEW data
                        // This MUST be before showing old chart data to prevent stale data display
                        if (isFetchingNewData) {
                          return (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-center">
                                <Progress
                                  size="sm"
                                  isIndeterminate
                                  aria-label="Loading chart data..."
                                  className="max-w-md mb-3"
                                />
                                <p className="text-default-600 text-sm">Loading new data...</p>
                              </div>
                            </div>
                          );
                        }

                        // Third priority: Show chart if we have data
                        if (selectedSensor && selectedSensorData) {
                          return (
                            <div className="h-full w-full flex flex-col">
                              <LineChart
                                config={selectedSensorData}
                                isLiveMode={isLiveMode}
                              />
                            </div>
                          );
                        }

                        // Fourth priority: Show loading states
                        if (effectiveIsLoading || isLoading || sensorsLoading || (!selectedSensor && sensors.length > 0)) {
                          return (
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
                          );
                        }

                        // Fifth priority: Show live data loading
                        if (isLiveMode && liveDataReadiness.shouldShowLoading) {
                          return (
                            <div className="flex items-center justify-center h-full">
                              <LiveDataLoading 
                                sensorName={selectedSensor ? (favoriteSensors.find(s => s._id === selectedSensor)?.displayName || selectedSensor) : undefined}
                              />
                            </div>
                          );
                        }

                        // Sixth priority: Show no data state
                        return (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <Icon
                                icon="lucide:bar-chart-3"
                                className="w-8 h-8 sm:w-12 sm:h-12 text-default-300 mb-3 mx-auto"
                              />
                              <p className="text-default-600 text-sm sm:text-base">
                                {selectedSensor ? "No chart data available" : "Select a sensor to view chart"}
                              </p>
                              <p className="text-xs sm:text-sm text-default-500 mt-1">
                                {isLiveMode
                                  ? "Live data will appear here once sensor starts transmitting"
                                  : "Historical data will load for the selected time range"}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    {/* Use the same TableView component as analytics page for consistent UI/UX */}
                    {/* Check isFetchingNewData FIRST to show loader when fetching new data */}
                    {isFetchingNewData ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <Progress
                            size="sm"
                            isIndeterminate
                            aria-label="Loading table data..."
                            className="max-w-md mb-3 mx-auto"
                          />
                          <p className="text-default-600 text-sm">Loading new data...</p>
                        </div>
                      </div>
                    ) : selectedSensor && selectedSensorData && timeRange ? (
                      <div className="rounded-lg overflow-hidden">
                        <TableView
                          config={selectedSensorData as ChartConfig}
                          sensorId={selectedSensor}
                          timeRange={timeRange}
                          isLiveMode={isLiveMode}
                          hideInternalControls={false}
                        />
                      </div>
                    ) : effectiveIsLoading || isLoading || sensorsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <Progress
                            size="sm"
                            isIndeterminate
                            aria-label="Loading table data..."
                            className="max-w-md mb-3 mx-auto"
                          />
                          <p className="text-default-600 text-sm">Loading table data...</p>
                        </div>
                      </div>
                    ) : (() => {
                      // Check if sensor is offline and we're in live mode for table view
                      const sensor = favoriteSensors.find((s) => s._id === selectedSensor);
                      const isSensorOffline = sensor?.isOnline === false;
                      const shouldShowOfflineFallback = isLiveMode && isSensorOffline;

                      if (shouldShowOfflineFallback) {
                        return (
                          <div className="flex items-center justify-center py-12">
                            <div className="flex flex-col items-center gap-4 max-w-md">
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
                                    // Switch to historical mode for this sensor only
                                    if (selectedSensor) {
                                      dispatch(
                                        setSensorHistoricalMode({
                                          sensorId: selectedSensor,
                                          isHistorical: true,
                                          timeRange: timeRange
                                        })
                                      );
                                    }
                                  }}
                                >
                                  View Historical Data
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Normal no data state
                      return (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <Icon icon="lucide:database" className="w-8 h-8 text-default-300 mb-2 mx-auto" />
                            <p className="text-default-600 text-sm sm:text-base">
                              {selectedSensor
                                ? "No table data available"
                                : "Select a sensor to view data"}
                            </p>
                            <p className="text-xs sm:text-sm text-default-500 mt-1">
                              {isLiveMode
                                ? "Live data will appear here once sensor starts transmitting"
                                : "Historical data will load for the selected time range"}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
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
      {/* Hide favorite dashboard for time being */}
      
    </div>
  );
};
