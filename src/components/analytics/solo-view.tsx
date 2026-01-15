import {
  addToast,
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Spinner,
  Tab,
  Tabs,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { chartColors } from "../../data/analytics";
import { useOptimizedDataFetch } from "../../hooks/useOptimizedDataFetch";
import { AppDispatch, RootState } from "../../store";
import { fetchGateways, selectGateways } from "../../store/gatewaySlice";
import { initializeLiveConnection, selectIsConnecting, selectIsLiveMode } from "../../store/liveDataSlice";
import {
  fetchSensorById,
  fetchSensors,
  selectFilters,
  selectSelectedSensor,
  selectSelectedSensorId,
  selectSensors,
  selectSensorsLoading,
  setFilters,
  toggleSensorStar,
  updateSensorDisplayName,
} from "../../store/sensorsSlice";
import {
  selectMaxLiveReadings,
  selectTelemetryData,
  selectTelemetryLoading,
  setSensorHistoricalMode,
  setTimeRange,
} from "../../store/telemetrySlice";
import { ChartConfig, SensorType } from "../../types/sensor";
import { formatNumericValue } from "../../utils/numberUtils";
import { LineChart } from "../visualization/line-chart";
import { LiveDataLoading } from "../visualization/live-data-loading";
import { AnomalyDetectionChart } from "./distribution-charts/anomaly-detection-chart";
import { CorrelationAnalysisChart } from "./distribution-charts/correlation-analysis-chart";
import { DistributionChart } from "./distribution-charts/distribution-chart";
import { TrendAnalysisChart } from "./distribution-charts/trend-analysis-chart";
// import { FilterBar } from "./filter-bar";
import ExportConfirmationModal from "../ExportConfirmationModal";
import TelemetryService, { EstimateExportResponse } from "../../api/telemetry.service";
import { useBreakpoints } from "../../hooks/use-media-query";
import { useLiveDataReadiness } from "../../hooks/useLiveDataReadiness";
import { useOfflineDetectionIntegration } from "../../hooks/useOfflineDetectionIntegration";
import { createOptimizedChartConfig, useOptimizedChartData } from "../../hooks/useOptimizedChartData";
import { useSensorModeTransition } from "../../hooks/useSensorModeTransition";
import { LiveReadingsSelector } from "./live-readings-selector";
import { TableView } from "./table-view";
import { TimeRangeSelector } from "./time-range-selector";

// Fix the interface to satisfy the Record<string, string | undefined> constraint
interface SoloViewParams {
  [key: string]: string | undefined;
  sensorId?: string;
}

interface SoloViewProps {
  // When embedded inline, skip auto-enable live mode behavior
  isEmbedded?: boolean;
  // Sensor ID to use when embedded (since URL params won't be set)
  embeddedSensorId?: string;
  // When true, shows only the selected tab content in fullscreen mode
  isFullscreen?: boolean;
  // Callback to exit fullscreen mode
  onExitFullscreen?: () => void;
}

export const SoloView: React.FC<SoloViewProps> = ({ isEmbedded = false, embeddedSensorId, isFullscreen = false, onExitFullscreen }) => {
  const navigate = useNavigate();
  const { sensorId: urlSensorId } = useParams<SoloViewParams>();
  
  // When embedded, use the passed sensorId prop; otherwise use URL param
  const sensorId = isEmbedded ? embeddedSensorId : urlSensorId;
  
  const dispatch = useDispatch<AppDispatch>();

  // Capture inherited mode from URL only once on mount
  const [inheritedMode, setInheritedMode] = React.useState<string | null>(null);
  const [hasInheritedMode, setHasInheritedMode] = React.useState(false);

  // Read URL parameters only once on component mount
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get("mode"); // "live" or "offline"
    setInheritedMode(modeParam);
    setHasInheritedMode(modeParam === "live" || modeParam === "offline");
  }, []); // Empty dependency array - only run once on mount

  // Use enhanced responsive breakpoints
  const { isMobile, isSmallScreen, isLandscape, isMobileLandscape, isMobileDevice } = useBreakpoints();

  // Initialize offline detection integration
  useOfflineDetectionIntegration();

  // Get state from Redux
  const filters = useSelector(selectFilters);
  const telemetryData = useSelector(selectTelemetryData);
  const isLoadingData = useSelector(selectTelemetryLoading);
  const sensors = useSelector(selectSensors);
  const loading = useSelector(selectSensorsLoading);
  // Get selectedSensorData with stable ID reference to prevent unnecessary re-fetches
  const selectedSensorId = useSelector(selectSelectedSensorId);
  const selectedSensorData = useSelector(selectSelectedSensor);
  const gateways = useSelector(selectGateways);

  // Organization status selectors
  const activeOrgStatus = useSelector((state: RootState) => state.activeOrg?.status);
  const activeOrgId = useSelector((state: RootState) => state.activeOrg?.orgId);

  // Local state
  // Use global search state instead of local searchText
  // const [searchText, setSearchText] = React.useState(""); // REMOVED - using global filters now
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [selectedTab, setSelectedTab] = React.useState("chart");
  // const [page, setPage] = React.useState(1);
  // const [rowsPerPage, setRowsPerPage] = React.useState(10);
  // const [sortDescriptor, setSortDescriptor] = React.useState({ column: "timestamp", direction: "descending" });
  const [groupBy, setGroupBy] = React.useState<"none" | "hourly" | "daily" | "weekly">("none");
  const [starLoading, setStarLoading] = React.useState(false);
  const chartRef = React.useRef<HTMLDivElement>(null);

  // Live mode state - use per-sensor historical mode from telemetry slice
  const globalIsLiveMode = useSelector(selectIsLiveMode);
  const isConnecting = useSelector(selectIsConnecting);
  const maxLiveReadings = useSelector(selectMaxLiveReadings);

  // Use optimized data fetch hook for efficient live data updates
  const { fetchData: fetchOptimizedData, cancelPendingRequests } = useOptimizedDataFetch();

  // Use the per-sensor mode transition hook
  // This automatically fetches the appropriate data when switching between live/historical modes
  // When embedded, parent handles transitions so disable this hook
  const { isLiveMode, isHistoricalMode } = useSensorModeTransition({
    sensorId: sensorId || null,
    pageContext: 'solo-view',
    chartType: 'line-chart',
    disabled: isEmbedded, // Parent handles transitions when embedded
  });

  // Derive live status from centralized state
  const liveStatus = isConnecting ? "connecting" : isLiveMode ? "connected" : "disconnected";

  // Add live data readiness to prevent flickering (similar to analytics page)
  // Detect if we're filtering for offline sensors
  const isOfflineSensorFilter = filters.status === "offline";

  let liveDataReadiness;
  try {
    liveDataReadiness = useLiveDataReadiness(sensorId || null, isOfflineSensorFilter);
  } catch (error) {
    // Fallback values
    liveDataReadiness = {
      shouldWaitForLiveData: false,
      shouldShowLoading: false,
      shouldFetchApiData: true,
      hasReceivedLiveData: false,
    };
  }

  // Enhanced loading state that considers live data readiness
  const effectiveIsLoading = isLoadingData || liveDataReadiness.shouldShowLoading;

  // Add enhanced loading state similar to analytics page
  // When embedded, start with false since parent already has data
  const [isInitiallyLoading, setIsInitiallyLoading] = React.useState(!isEmbedded);

  // Add state to track auto-enable attempt completion
  // When embedded, consider it already attempted since parent handles mode
  const [hasAttemptedAutoEnable, setHasAttemptedAutoEnable] = React.useState(isEmbedded);

  // Add state to track if we've applied inherited mode from URL (only apply once)
  // When embedded, consider it already applied since parent handles mode
  const [hasAppliedInheritedMode, setHasAppliedInheritedMode] = React.useState(isEmbedded);

  // Set initial loading to false after a short delay (similar to analytics page)
  // Skip when embedded - parent already has data loaded
  React.useEffect(() => {
    if (isEmbedded) return; // Skip when embedded

    const timer = setTimeout(() => {
      setIsInitiallyLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [isEmbedded]);

  // Enhanced loading state that includes initial loading
  const enhancedEffectiveIsLoading = effectiveIsLoading || isInitiallyLoading;

  // Create base chart config for optimization
  const baseChartConfig: ChartConfig | null = React.useMemo(() => {
    if (!sensorId || !telemetryData[sensorId]) return null;

    const sensorData = telemetryData[sensorId];
    const currentSeries = sensorData.series;

    // Apply dynamic reading limit in live mode based on user's selection
    const shouldLimitToLatest = isLiveMode;
    const displaySeries =
      shouldLimitToLatest && currentSeries.length > maxLiveReadings
        ? currentSeries.slice(-maxLiveReadings)
        : currentSeries;

    return {
      type: sensorData.type,
      unit: sensorData.unit,
      series: displaySeries,
      color: chartColors[0],
    };
  }, [sensorId, telemetryData, isLiveMode, maxLiveReadings]);

  // Use centralized chart data optimization (same as LineChart)
  const optimizedChartData = useOptimizedChartData(baseChartConfig);

  // Cleanup on unmount - cancel any pending data requests only
  // Live mode cleanup is handled centrally, no need for component-specific cleanup
  React.useEffect(() => {
    return () => {
      cancelPendingRequests();
    };
  }, [cancelPendingRequests]);

  const sensorsLoaded = useSelector((s: RootState) => s.sensors.loaded);
  const sensorsLoading = useSelector(selectSensorsLoading);

  // Map sensors to the format expected by components
  const mappedSensors = React.useMemo(() => {
    return sensors.map((sensor) => ({
      ...sensor,
      id: sensor._id,
      displayName: sensor.displayName,
      starred: sensor.favorite,
    }));
  }, [sensors]);

  // Filter sensors based on global filters (not local search)
  const filteredSensors = React.useMemo(() => {
    let list = [...mappedSensors];

    /* search */
    if (filters?.search?.trim()) {
      const q = filters.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.mac.toLowerCase().includes(q) ||
          (s.displayName ?? "").toLowerCase().includes(q) ||
          (s.name ?? "").toLowerCase().includes(q)
      );
    }

    /* sensor type */
    if (filters.types.length) {
      list = list.filter((s) => filters.types.includes(s.type as SensorType));
    }

    /* status */
    if (filters.status !== "all") {
      if (filters.status === "live") {
        list = list.filter((s) => s.isOnline === true);
      } else if (filters.status === "offline") {
        list = list.filter((s) => s.isOnline === false);
      }
    }

    /* sort */
    if (filters.sort) {
      const { field, direction } = filters.sort;
      list = [...list].sort((a: any, b: any) => {
        if (field === "starred" || field === "favorite") {
          const af = a.favorite ? 1 : 0;
          const bf = b.favorite ? 1 : 0;
          if (af === bf) return 0;
          return (af > bf ? 1 : -1) * (direction === "asc" ? 1 : -1);
        }

        if (field === "lastSeen") {
          const av = new Date(a[field]).getTime();
          const bv = new Date(b[field]).getTime();
          if (isNaN(av) && isNaN(bv)) return 0;
          if (isNaN(av)) return 1;
          if (isNaN(bv)) return -1;
          return (av - bv) * (direction === "asc" ? 1 : -1);
        }

        if (field === "displayName" || field === "name") {
          const av = (a.displayName || a.name || a.mac || "").toString().toLowerCase();
          const bv = (b.displayName || b.name || b.mac || "").toString().toLowerCase();
          if (av === bv) return 0;
          return av.localeCompare(bv) * (direction === "asc" ? 1 : -1);
        }

        if (field === "battery") {
          const av = typeof a[field] === "number" ? a[field] : -1;
          const bv = typeof b[field] === "number" ? b[field] : -1;
          if (av === bv) return 0;
          return (av - bv) * (direction === "asc" ? 1 : -1);
        }

        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av > bv ? 1 : -1) * (direction === "asc" ? 1 : -1);
      });
    }

    return list;
  }, [mappedSensors, filters]);

  // Current sensor
  const currentSensor = React.useMemo(() => {
    return mappedSensors.find((s) => s._id === sensorId);
  }, [mappedSensors, sensorId]);

  // Add state for initial loading
  const [initialLoading, setInitialLoading] = React.useState(true);

  // Export modal state variables
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
  const [exportEstimation, setExportEstimation] = React.useState<EstimateExportResponse | null>(null);
  const [exportStatus, setExportStatus] = React.useState<
    "estimating" | "confirming" | "downloading" | "completed" | "error" | "cancelled"
  >("estimating");
  const [exportError, setExportError] = React.useState<string | null>(null);
  const [isExportLoading, setIsExportLoading] = React.useState(false);
  const [exportProgress, setExportProgress] = React.useState(0);
  const [downloadedBytes, setDownloadedBytes] = React.useState(0);
  const [totalBytes, setTotalBytes] = React.useState(0);
  const [exportAbortController, setExportAbortController] = React.useState<AbortController | null>(null);

  // Helper function to parse estimated duration string to milliseconds
  const parseEstimatedDuration = (duration: string): number => {
    const match = duration.match(/(\d+)([smh])/);
    if (!match) return 30000; // Default 30 seconds

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      default:
        return 30000;
    }
  };

  // Set initialLoading to false when sensors are loaded
  React.useEffect(() => {
    if (sensorsLoaded && initialLoading) {
      setInitialLoading(false);
    }
  }, [sensorsLoaded, initialLoading]);

  // Fetch sensors on component mount - ONLY ONCE
  React.useEffect(() => {
    if (sensorsLoaded || sensorsLoading) return; // already have / still fetching

    dispatch(
      fetchSensors({
        page: 1,
        limit: 50,
        claimed: true,
        search: "", // Remove search from API - do client-side filtering instead
      })
    )
      .unwrap() // ← propagates real promise
      .catch((e) => {});
  }, [dispatch, sensorsLoaded, sensorsLoading]); // Remove filters.search dependency

  // Fetch gateways for live mode functionality
  React.useEffect(() => {
    // Only fetch gateways when organization context is ready
    if (activeOrgStatus === "ready" && activeOrgId) {
      dispatch(fetchGateways({ page: 1, limit: 1000, search: "" }));
    }
  }, [dispatch, activeOrgStatus, activeOrgId]);

  // Handle inherited mode from URL (live/offline) and apply per-sensor historical mode
  // MQTT connection is now auto-managed at the app level, so we only need to handle 
  // the per-sensor historical mode setting based on URL parameter
  React.useEffect(() => {
    // Skip when embedded inline - preserve parent's mode
    if (isEmbedded) {
      setHasAttemptedAutoEnable(true);
      setHasAppliedInheritedMode(true);
      return;
    }

    // Apply inherited mode from URL if specified
    if (hasInheritedMode && sensorId && !hasAppliedInheritedMode) {
      // If inherited mode is "offline", set this sensor to historical mode
      if (inheritedMode === "offline") {
        dispatch(setSensorHistoricalMode({
          sensorId,
          isHistorical: true,
          timeRange: filters.timeRange
        }));
      } else if (inheritedMode === "live") {
        // Clear historical mode for this sensor if URL says live
        dispatch(setSensorHistoricalMode({
          sensorId,
          isHistorical: false
        }));
      }
      setHasAttemptedAutoEnable(true);
      setHasAppliedInheritedMode(true);
    } else if (!hasInheritedMode && sensorId && !hasAppliedInheritedMode) {
      // Default behavior: sensor starts in live mode (no historical mode set)
      // Clear any previous historical mode that might exist
      dispatch(setSensorHistoricalMode({
        sensorId,
        isHistorical: false
      }));
      setHasAttemptedAutoEnable(true);
      setHasAppliedInheritedMode(true);
    }
  }, [sensorId, hasInheritedMode, inheritedMode, hasAppliedInheritedMode, isEmbedded, dispatch, filters.timeRange]);

  /*****************************************************************************
   * 2️⃣  Ensure we always have a “selected” sensor
   *****************************************************************************/
  const filteredIds = React.useMemo(() => {
    return filteredSensors.map((s) => s.id).join("|");
  }, [filteredSensors.length, filteredSensors.map((s) => s.id).join("|")]);

  React.useEffect(() => {
    // Skip sensor selection when embedded - parent handles this
    if (isEmbedded) return;

    if (!sensorsLoaded) return; // wait for list

    /* a) we have an id in the URL ----------------------------------------- */
    if (sensorId) {
      // Only fetch if we don't have the sensor data OR if the sensor ID is different
      // Use stable selectedSensorId to prevent re-fetches on lastSeen/status updates
      if (!selectedSensorId || selectedSensorId !== sensorId) {
        dispatch(fetchSensorById(sensorId));
      } else {
      }
      return;
    }

    /* b) no id → redirect to first sensor --------------------------------- */
    if (filteredSensors.length && !selectedSensorData.data) {
      const firstId = filteredSensors[0].id;

      navigate(`/dashboard/sensors/${firstId}?solo=true`, { replace: true });
    }
  }, [sensorId, filteredIds, sensorsLoaded, selectedSensorId, dispatch, navigate, isEmbedded]);

  // Fetch telemetry data when selected sensor or time range changes - FIXED DEPENDENCIES
  React.useEffect(() => {
    // Skip data fetching when embedded - parent (analytics page) handles data fetching
    // This prevents duplicate API calls and ensures live data appending works correctly
    if (isEmbedded) {
      return;
    }

    if (initialLoading) return; // wait until list call finished

    // Wait for auto-enable attempt to complete before fetching data
    if (!hasAttemptedAutoEnable) {
      return;
    }

    // Add a small delay after auto-enable to let the live connection attempt start
    // This prevents fetching historical data immediately after enabling live mode
    const fetchTimer = setTimeout(() => {
      // Check if we should fetch API data based on live data readiness (same as analytics page)
      if (!liveDataReadiness.shouldFetchApiData) {
        return;
      }

      if (sensorId && !initialLoading) {
        // Use optimized data fetch for better performance and live mode support
        // Note: fetchOptimizedData internally uses isLiveMode from Redux to set liveMode parameter
        fetchOptimizedData({
          sensorIds: [sensorId],
          timeRange: filters.timeRange,
          pageContext: "solo-view",
        });
      }
    }, 500); // Small delay to let live connection attempt start

    return () => clearTimeout(fetchTimer);
    // IMPORTANT: Include isLiveMode in dependencies to re-fetch with correct liveMode parameter when mode changes
  }, [
    sensorId,
    filters.timeRange.start,
    filters.timeRange.end,
    initialLoading,
    fetchOptimizedData,
    liveDataReadiness.shouldFetchApiData,
    hasAttemptedAutoEnable,
    isLiveMode,
    isEmbedded,
  ]);

  // Create optimized chart config using centralized optimization (for charts only)
  const chartConfig: ChartConfig | null = React.useMemo(() => {
    if (!baseChartConfig || !optimizedChartData.hasData) return null;

    return createOptimizedChartConfig(baseChartConfig, optimizedChartData);
  }, [baseChartConfig, optimizedChartData]);

  // Create separate config for table that uses FULL API data (not optimized)
  const tableConfig: ChartConfig | null = React.useMemo(() => {
    if (!baseChartConfig) return null;

    // Use the baseChartConfig which contains full API data
    return baseChartConfig;
  }, [baseChartConfig]);

  // Check if sensor is offline - only show offline state when we have sensor data and it's actually offline
  // AND we're not waiting for live data (give live connection a chance to update the status)
  const isSensorOffline =
    selectedSensorData?.data && selectedSensorData.data.isOnline === false && !liveDataReadiness.shouldWaitForLiveData;

  // Prepare table data with grouping
  // const tableData = React.useMemo(() => {
  //   if (!sensorId || !telemetryData[sensorId]) return [];

  //   const series = telemetryData[sensorId].series;

  //   if (groupBy === "none") {
  //     return series.map((point) => ({
  //       timestamp: point.timestamp,
  //       value: point.value,
  //       date: new Date(point.timestamp).toLocaleDateString(),
  //       time: new Date(point.timestamp).toLocaleTimeString(),
  //     }));
  //   }

  //   // Group data
  //   const groupedData: Record<string, { min: number; max: number; avg: number; count: number; timestamp: number }> = {};

  //   series.forEach((point) => {
  //     const date = new Date(point.timestamp);
  //     let key: string;

  //     switch (groupBy) {
  //       case "hourly":
  //         date.setMinutes(0, 0, 0);
  //         key = date.toISOString();
  //         break;
  //       case "daily":
  //         date.setHours(0, 0, 0, 0);
  //         key = date.toISOString();
  //         break;
  //       case "weekly":
  //         const dayOfWeek = date.getDay();
  //         const diff = date.getDate() - dayOfWeek;
  //         const startOfWeek = new Date(date);
  //         startOfWeek.setDate(diff);
  //         startOfWeek.setHours(0, 0, 0, 0);
  //         key = startOfWeek.toISOString();
  //         break;
  //       default:
  //         key = date.toISOString();
  //     }

  //     if (!groupedData[key]) {
  //       groupedData[key] = {
  //         min: point.value,
  //         max: point.value,
  //         avg: point.value,
  //         count: 1,
  //         timestamp: date.getTime(),
  //       };
  //     } else {
  //       groupedData[key].min = Math.min(groupedData[key].min, point.value);
  //       groupedData[key].max = Math.max(groupedData[key].max, point.value);
  //       groupedData[key].avg =
  //         (groupedData[key].avg * groupedData[key].count + point.value) / (groupedData[key].count + 1);
  //       groupedData[key].count += 1;
  //     }
  //   });

  //   return Object.entries(groupedData).map(([, data]) => ({
  //     timestamp: data.timestamp,
  //     value: data.avg,
  //     min: data.min,
  //     max: data.max,
  //     count: data.count,
  //     date: new Date(data.timestamp).toLocaleDateString(),
  //     time: new Date(data.timestamp).toLocaleTimeString(),
  //   }));
  // }, [sensorId, telemetryData, groupBy]);

  // Sort and paginate table data
  // const sortedData = React.useMemo(() => {
  //   if (!tableData.length) return [];

  //   const sorted = [...tableData].sort((a, b) => {
  //     const { column, direction } = sortDescriptor;
  //     const first = a[column as keyof typeof a];
  //     const second = b[column as keyof typeof b];
  //     const cmp = first < second ? -1 : first > second ? 1 : 0;

  //     return direction === "descending" ? -cmp : cmp;
  //   });

  //   return sorted;
  // }, [tableData, sortDescriptor]);

  // const paginatedData = React.useMemo(() => {
  //   const start = (page - 1) * rowsPerPage;
  //   const end = start + rowsPerPage;

  //   return sortedData.slice(start, end);
  // }, [sortedData, page, rowsPerPage]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!sensorId || !telemetryData[sensorId]) return null;

    const sensorData = telemetryData[sensorId];
    const currentSeries = sensorData.series;

    // Apply same dynamic reading limit as chart for consistency
    const shouldLimitToLatest = isLiveMode;
    const displaySeries =
      shouldLimitToLatest && currentSeries.length > maxLiveReadings
        ? currentSeries.slice(-maxLiveReadings)
        : currentSeries;

    if (!displaySeries.length) return null;

    // Convert string values to numbers for calculations
    const values = displaySeries.map((point) => {
      const numValue = typeof point.value === "string" ? parseFloat(point.value) : point.value;
      return isNaN(numValue) ? 0 : numValue;
    });

    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

    // Ensure latest is also converted to number
    const latestValue = displaySeries[displaySeries.length - 1].value;
    const latest = typeof latestValue === "string" ? parseFloat(latestValue) : latestValue;

    // Calculate standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, avg, latest: isNaN(latest) ? 0 : latest, stdDev };
  }, [sensorId, telemetryData, isLiveMode, maxLiveReadings]);

  // Handlers
  const handleBackToAnalytics = () => {
    navigate(`/dashboard/sensors/${sensorId}`);
  };

  const handleSearchChange = (text: string) => {
    dispatch(setFilters({ ...filters, search: text }));
    if (text) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const handleSensorSelect = (id: string) => {
    navigate(`/dashboard/sensors/${id}?solo=true`);
    setIsDropdownOpen(false);
    dispatch(setFilters({ ...filters, search: "" }));
  };

  const handleFiltersChange = (newFilters: any) => {
    dispatch(setFilters({ ...filters, ...newFilters }));
  };

  const handleBrushChange = (start: Date, end: Date) => {
    dispatch(
      setFilters({
        ...filters,
        timeRange: { start, end },
      })
    );
  };

  const handleTimeRangeChange = (range: { start: Date; end: Date }) => {
    // Update both slices like the main analytics page
    dispatch(setFilters({ ...filters, timeRange: range })); // sensors slice
    dispatch(setTimeRange(range)); // telemetry slice
  };

  const handleLiveModeChange = async (isLive: boolean) => {
    if (!sensorId) return;
    
    // Use per-sensor historical mode instead of global toggle
    // This only affects the currently selected sensor, not the whole app
    dispatch(setSensorHistoricalMode({
      sensorId,
      isHistorical: !isLive,
      timeRange: !isLive ? filters.timeRange : undefined
    }));

    // Update URL parameter to reflect user's choice (optional - keeps URL in sync)
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set("mode", isLive ? "live" : "offline");
    window.history.replaceState({}, "", currentUrl.toString());
  };

  const handleRetryConnection = async () => {
    try {
      // Re-initialize the MQTT connection using centralized logic
      await dispatch(initializeLiveConnection()).unwrap();
      
      // Also clear historical mode for current sensor so it shows live data
      if (sensorId) {
        dispatch(setSensorHistoricalMode({
          sensorId,
          isHistorical: false,
        }));
      }
    } catch (error) {
      // Error handled silently
    }
  };

  const handleDownloadCSV = async () => {
    try {
      // Check if we have a sensor selected
      if (!currentSensor?.mac) {
        addToast({
          title: "Download Failed",
          description: "Sensor MAC address not available",
        });
        return;
      }

      // Prepare export request parameters
      const sensorIds = [currentSensor.mac];
      const timeRange = {
        start: filters.timeRange.start.toISOString(),
        end: filters.timeRange.end.toISOString(),
      };

      // Reset modal state and open it
      setExportEstimation(null);
      setExportError(null);
      setExportStatus("estimating");
      setIsExportModalOpen(true);

      // Get export estimation
      const estimationResponse = await TelemetryService.estimateExport({
        sensorIds,
        timeRange,
      });

      if (estimationResponse.success) {
        setExportEstimation(estimationResponse);
        setExportStatus("confirming");
      } else {
        throw new Error(estimationResponse.error || "Failed to estimate export size");
      }
    } catch (error) {
      console.error("Export estimation failed:", error);
      setExportError(error instanceof Error ? error.message : "Failed to estimate export");
      setExportStatus("error");
    }
  };

  const handleConfirmExport = async () => {
    if (!currentSensor || !exportEstimation) return;

    // Create abort controller for cancellation
    const abortController = new AbortController();
    setExportAbortController(abortController);

    try {
      setIsExportLoading(true);
      setExportStatus("downloading");

      const sensorIds = [currentSensor.mac];
      const timeRange = {
        start: filters.timeRange.start.toISOString(),
        end: filters.timeRange.end.toISOString(),
      };

      // Generate filename
      const filename = currentSensor.displayName
        ? `${currentSensor.displayName}_data.csv`
        : `${currentSensor.mac}_data.csv`;

      // Reset progress tracking
      setExportProgress(0);
      setDownloadedBytes(0);
      setTotalBytes(0);

      // Convert estimated duration to milliseconds
      const estimatedDurationMs = parseEstimatedDuration(exportEstimation.data.estimatedDuration);

      // Stream export with real progress tracking
      const blob = await TelemetryService.streamExport(
        {
          sensorIds,
          timeRange,
          format: "csv",
          filename,
          batchSize: exportEstimation.data.recommendedBatchSize,
          maxRecords: 500000, // Safety limit
          includeMetadata: false,
        },
        (progress, loaded, total) => {
          // Update real progress
          setExportProgress(progress);
          setDownloadedBytes(loaded);
          if (total) {
            setTotalBytes(total);
          }
        },
        exportEstimation.data.estimatedSizeKB,
        estimatedDurationMs,
        abortController.signal
      );

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportStatus("completed");

      addToast({
        title: "CSV Downloaded",
        description: `${exportEstimation.data.totalRecords.toLocaleString()} records downloaded successfully`,
      });
    } catch (error) {
      console.error("Export failed:", error);
      if (error instanceof Error && error.name === "CanceledError") {
        setExportStatus("cancelled");
      } else {
        setExportError(error instanceof Error ? error.message : "Export failed");
        setExportStatus("error");
      }
    } finally {
      setIsExportLoading(false);
      setExportAbortController(null);
    }
  };

  const handleCancelExport = () => {
    if (exportAbortController) {
      exportAbortController.abort();
      console.log("🚫 Export cancelled by user");
    }
  };

  const handleCloseExportModal = () => {
    // Only allow closing if not currently downloading
    if (exportStatus !== "downloading") {
      setIsExportModalOpen(false);
      setExportEstimation(null);
      setExportError(null);
      setExportStatus("estimating");
      setIsExportLoading(false);
      setExportProgress(0);
      setDownloadedBytes(0);
      setTotalBytes(0);
      setExportAbortController(null);
    }
  };

  const downloadPNG = async () => {
    try {
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current, {
          useCORS: true,
          allowTaint: false,
          logging: false,
          width: chartRef.current.offsetWidth,
          height: chartRef.current.offsetHeight,
        });

        canvas.toBlob((blob) => {
          if (blob) {
            const filename = currentSensor
              ? `${currentSensor.displayName || currentSensor.mac}_chart.png`
              : `sensor_chart_${new Date().toISOString().split("T")[0]}.png`;

            saveAs(blob, filename);

            addToast({
              title: "Chart Downloaded",
              description: "Chart image has been downloaded as PNG",
            });
          }
        }, "image/png");
      }
    } catch (error) {
      addToast({
        title: "Download Failed",
        description: "Failed to download chart image",
      });
    }
  };

  const handleDownload = async (type: "csv" | "png") => {
    if (type === "csv") {
      handleDownloadCSV();
    } else {
      await downloadPNG();
    }
  };

  const handleDisplayNameChange = (displayName: string) => {
    if (currentSensor) {
      dispatch(
        updateSensorDisplayName({
          mac: currentSensor.mac, // or id: currentSensor._id – whichever your slice expects
          displayName,
        })
      );

      addToast({
        title: "Display Name Updated",
        description: `Sensor ${currentSensor.mac} display name saved`,
      });
    }
  };

  const handleToggleStar = async () => {
    setStarLoading(true);
    try {
      if (currentSensor?.mac) {
        await dispatch(toggleSensorStar(currentSensor.mac)).unwrap();
      }
    } catch (e) {
      addToast({
        title: "Failed to update favorite",
        description: typeof e === "string" ? e : "Please try again.",
      });
    } finally {
      setStarLoading(false);
    }
  };

  const handleGroupByChange = (value: "none" | "hourly" | "daily" | "weekly") => {
    setGroupBy(value);
    // setPage(1); // Reset to first page when changing grouping
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* <div className="bg-content1 border-b border-divider p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button isIconOnly size="sm" variant="light" onPress={handleBackToAnalytics}>
                <Icon icon="lucide:arrow-left" width={16} />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <FilterBar filters={filters} onFiltersChange={handleFiltersChange} />
            </div>
          </div>

          {(filters.types.length > 0 || filters.status !== "all") && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.types.length > 0 && (
                <div className="px-3 py-1 bg-primary-100 text-primary rounded-full text-xs flex items-center gap-1">
                  <Icon icon="lucide:tag" width={12} />
                  {filters.types.length === 1
                    ? filters.types[0].charAt(0).toUpperCase() + filters.types[0].slice(1)
                    : `${filters.types.length} Types`}
                </div>
              )}

              {filters.status !== "all" && (
                <div className="px-3 py-1 bg-primary-100 text-primary rounded-full text-xs flex items-center gap-1">
                  <Icon icon={filters.status === "live" ? "lucide:wifi" : "lucide:wifi-off"} width={12} />
                  {filters.status === "live" ? "Online" : filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}
                </div>
              )}

              <div className="px-3 py-1 bg-primary-100 text-primary rounded-full text-xs flex items-center gap-1">
                <Icon icon="lucide:calendar" width={12} />
                {new Date(filters.timeRange.start).toLocaleDateString() ===
                new Date(filters.timeRange.end).toLocaleDateString()
                  ? new Date(filters.timeRange.start).toLocaleDateString()
                  : `${new Date(filters.timeRange.start).toLocaleDateString()} - ${new Date(filters.timeRange.end).toLocaleDateString()}`}
              </div>
            </div>
          )}
        </div>
      </div> */}

      {/* Main content with tabs */}
      <div className="flex-1 p-4 overflow-auto" onClick={() => setIsDropdownOpen(false)}>
        {isLoadingData ? (
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        ) : currentSensor ? (
          <div className="h-full flex flex-col">
            {/* Sensor info header - only show when not embedded (embedded shows info in breadcrumbs) */}
            {!isEmbedded && (
              <div className="mb-4">
                <Card className="w-full">
                  <CardBody>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <h2 className="text-xl font-semibold">{currentSensor.displayName || currentSensor.mac}</h2>
                          {/* Online/Offline status indicator */}
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                isSensorOffline ? "bg-danger animate-pulse" : "bg-success"
                              }`}
                            />
                            <span className={`text-sm font-medium ${isSensorOffline ? "text-danger" : "text-success"}`}>
                              {isSensorOffline ? "OFFLINE" : "ONLINE"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Time Range Selector */}
                        <TimeRangeSelector
                          timeRange={filters.timeRange}
                          onTimeRangeChange={handleTimeRangeChange}
                          showApplyButtons={true}
                          isMobile={false}
                          isLiveMode={isLiveMode}
                          onLiveModeChange={handleLiveModeChange}
                          liveStatus={liveStatus}
                          onRetryConnection={handleRetryConnection}
                          gatewayIds={gateways.map((g) => g._id)}
                        />

                        {/* Live Readings Selector */}
                        <LiveReadingsSelector isLiveMode={isLiveMode} className="flex-shrink-0" />

                        {starLoading ? (
                          <Spinner size="sm" />
                        ) : (
                          <Icon
                            icon={currentSensor.favorite ? "mdi:star" : "mdi:star-outline"}
                            className={`cursor-pointer ${currentSensor.favorite ? "text-warning" : "text-default-400"}`}
                            style={currentSensor.favorite ? { color: "#fbbf24" } : {}}
                            onClick={handleToggleStar}
                          />
                        )}
                        <Dropdown>
                          <DropdownTrigger>
                            <Button size="sm" variant="light" color="primary" isIconOnly>
                              <Icon icon="lucide:download" width={16} />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu aria-label="Download options">
                            <DropdownItem
                              key="csv"
                              startContent={<Icon icon="lucide:download" width={16} />}
                              onPress={() => handleDownload("csv")}
                            >
                              Download as CSV
                            </DropdownItem>
                            {/* <DropdownItem
                            key="png"
                            startContent={<Icon icon="lucide:image" width={16} />}
                            onPress={() => handleDownload("png")}
                          >
                            Download as PNG
                          </DropdownItem> */}
                          </DropdownMenu>
                        </Dropdown>
                      </div>
                    </div>
                    <p className="text-small text-default-500 mt-1">{currentSensor.mac}</p>
                  </CardBody>
                </Card>
              </div>
            )}

            {/* Stats cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4">
                <Card>
                  <CardBody className="p-3">
                    <p className="text-xs text-default-500">Latest</p>
                    <p className="text-xl font-semibold text-success-800">{formatNumericValue(stats.latest, 4)}</p>
                    <p className="text-xs">{chartConfig?.unit}</p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="p-3">
                    <p className="text-xs text-default-500">Average</p>
                    <p className="text-xl font-semibold text-primary-700">{formatNumericValue(stats.avg, 4)}</p>
                    <p className="text-xs">{chartConfig?.unit}</p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="p-3">
                    <p className="text-xs text-default-500">Minimum</p>
                    <p className="text-xl font-semibold text-danger-700">{formatNumericValue(stats.min, 4)}</p>
                    <p className="text-xs">{chartConfig?.unit}</p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="p-3">
                    <p className="text-xs text-default-500">Maximum</p>
                    <p className="text-xl font-semibold text-warning-700">{formatNumericValue(stats.max, 4)}</p>
                    <p className="text-xs">{chartConfig?.unit}</p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="p-3">
                    <p className="text-xs text-default-500">Max - Min</p>
                    <p className="text-xl font-semibold text-sky-800">{formatNumericValue(stats.max - stats.min, 4)}</p>
                    <p className="text-xs">{chartConfig?.unit}</p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="p-3">
                    <p className="text-xs text-default-500">Std Dev</p>
                    <p className="text-xl font-semibold">{formatNumericValue(stats.stdDev, 4)}</p>
                    <p className="text-xs">{chartConfig?.unit}</p>
                  </CardBody>
                </Card>
              </div>
            )}

            {/* Fullscreen mode - show only the selected tab content */}
            {isFullscreen ? (
              <div className="fixed inset-0 z-50 bg-background overflow-auto">
                {/* Fullscreen header */}
                <div className="sticky top-0 z-10 border-b border-divider px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {selectedTab === "chart" && "Chart View"}
                      {selectedTab === "table" && "Table View"}
                      {selectedTab === "distribution" && "Distribution"}
                      {selectedTab === "trend" && "Trend Analysis"}
                      {selectedTab === "anomaly" && "Anomaly Detection"}
                      {selectedTab === "correlation" && "Correlation"}
                      {selectedTab === "multichart" && "Multi-Chart View"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="light"
                    onPress={onExitFullscreen}
                    startContent={<Icon icon="lucide:minimize-2" width={16} />}
                  >
                    Exit Fullscreen
                  </Button>
                </div>

                {/* Fullscreen content */}
                <div className="p-4 h-[calc(100vh-60px)]">
                  {selectedTab === "chart" && (
                    <div className="w-full h-full rounded-lg bg-white dark:bg-content1 p-4" ref={chartRef}>
                      {isSensorOffline && isLiveMode ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <Icon
                            icon="lucide:wifi-off"
                            className="text-danger-400 animate-pulse"
                            width={64}
                            height={64}
                          />
                          <h3 className="text-lg font-semibold text-danger-600 mt-4">Sensor Offline</h3>
                          <p className="text-default-600 text-sm">Waiting for sensor to come back online</p>
                        </div>
                      ) : chartConfig ? (
                        <LineChart config={chartConfig} isLiveMode={isLiveMode} />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Spinner size="lg" color="primary" />
                        </div>
                      )}
                    </div>
                  )}
                  {selectedTab === "table" && (
                    <div className="h-full overflow-auto">
                      {tableConfig ? (
                        <TableView
                          config={tableConfig}
                          sensorId={sensorId || ""}
                          timeRange={filters.timeRange}
                          onDownloadCSV={handleDownloadCSV}
                          isLiveMode={isLiveMode}
                        />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Spinner size="lg" color="primary" />
                        </div>
                      )}
                    </div>
                  )}
                  {selectedTab === "distribution" && (
                    <div className="h-full">
                      {chartConfig ? (
                        <DistributionChart config={chartConfig} showCards showChart isLiveMode={isLiveMode} />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Spinner size="lg" color="primary" />
                        </div>
                      )}
                    </div>
                  )}
                  {selectedTab === "trend" && (
                    <div className="h-full">
                      {chartConfig ? (
                        <TrendAnalysisChart config={chartConfig} showCards showChart isLiveMode={isLiveMode} />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Spinner size="lg" color="primary" />
                        </div>
                      )}
                    </div>
                  )}
                  {selectedTab === "anomaly" && (
                    <div className="h-full">
                      {chartConfig ? (
                        <AnomalyDetectionChart config={chartConfig} showCards showChart isLiveMode={isLiveMode} />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Spinner size="lg" color="primary" />
                        </div>
                      )}
                    </div>
                  )}
                  {selectedTab === "correlation" && (
                    <div className="h-full">
                      {chartConfig ? (
                        <CorrelationAnalysisChart config={chartConfig} showCards showChart isLiveMode={isLiveMode} />
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <Spinner size="lg" color="primary" />
                        </div>
                      )}
                    </div>
                  )}
                  {selectedTab === "multichart" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                      <Card className="shadow-sm">
                        <CardBody className="p-3">
                          <h3 className="text-sm font-medium mb-2 text-primary-600">Value Distribution</h3>
                          <div className="h-[calc(50vh-100px)]">
                            {chartConfig ? (
                              <DistributionChart config={chartConfig} showChart isLiveMode={isLiveMode} />
                            ) : (
                              <Spinner />
                            )}
                          </div>
                        </CardBody>
                      </Card>
                      <Card className="shadow-sm">
                        <CardBody className="p-3">
                          <h3 className="text-sm font-medium mb-2 text-secondary-600">Trend Analysis</h3>
                          <div className="h-[calc(50vh-100px)]">
                            {chartConfig ? (
                              <TrendAnalysisChart config={chartConfig} showChart isLiveMode={isLiveMode} />
                            ) : (
                              <Spinner />
                            )}
                          </div>
                        </CardBody>
                      </Card>
                      <Card className="shadow-sm">
                        <CardBody className="p-3">
                          <h3 className="text-sm font-medium mb-2 text-danger-600">Anomaly Detection</h3>
                          <div className="h-[calc(50vh-100px)]">
                            {chartConfig ? (
                              <AnomalyDetectionChart config={chartConfig} showChart isLiveMode={isLiveMode} />
                            ) : (
                              <Spinner />
                            )}
                          </div>
                        </CardBody>
                      </Card>
                      <Card className="shadow-sm">
                        <CardBody className="p-3">
                          <h3 className="text-sm font-medium mb-2 text-success-600">Correlation Analysis</h3>
                          <div className="h-[calc(50vh-100px)]">
                            {chartConfig ? (
                              <CorrelationAnalysisChart config={chartConfig} showChart isLiveMode={isLiveMode} />
                            ) : (
                              <Spinner />
                            )}
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Tabs - responsive */}
                <Tabs
                  selectedKey={selectedTab}
                  onSelectionChange={setSelectedTab as any}
                  className={`mb-${isSmallScreen ? "2" : "4"}`}
                  size={isSmallScreen ? "sm" : "md"}
                  variant="underlined"
                  classNames={{
                    cursor: "bg-primary",
                  }}
                  color="primary"
                >
                  <Tab key="chart" title={isSmallScreen ? "Chart" : "Chart View"}>
                    <div
                      className={`w-full rounded-l p-${isSmallScreen ? "2" : "4"} ${
                        isMobileDevice ? (isMobileLandscape ? "h-[400px]" : "h-[350px]") : "h-[500px]"
                      }`}
                      ref={chartRef}
                    >
                      {/* Show offline sensor waiting state - only in live mode and when we're not loading chart data */}
                      {isSensorOffline && isLiveMode ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <div className="flex flex-col items-center gap-4 max-w-md">
                            {/* Animated loading icon */}
                            <div className="relative">
                              <Icon
                                icon="lucide:wifi-off"
                                className="text-danger-400 animate-pulse"
                                width={64}
                                height={64}
                              />
                              {/* <div className="absolute -bottom-2 -right-2 bg-danger-500 rounded-full p-1">
                              <Icon 
                                icon="lucide:loader-2" 
                                className="text-white animate-spin" 
                                width={16} 
                                height={16} 
                              />
                            </div> */}
                            </div>

                            {/* Status message */}
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-danger-600">Sensor Offline</h3>
                              <p className="text-default-600 text-sm leading-relaxed">
                                Waiting for{" "}
                                <span className="font-medium text-primary-600">
                                  {selectedSensorData?.data?.displayName || selectedSensorData?.data?.mac}
                                </span>{" "}
                                to come back online
                              </p>
                              <p className="text-default-500 text-xs">
                                Chart will update automatically once the sensor becomes live
                              </p>
                            </div>

                            {/* View Old Readings Button */}
                            <div className="flex flex-col gap-2 mt-4">
                              <Button
                                color="primary"
                                variant="flat"
                                size="sm"
                                onPress={() => {
                                  handleLiveModeChange(false);
                                }}
                                startContent={<Icon icon="lucide:history" width={16} />}
                              >
                                View Old Readings Instead
                              </Button>
                              <p className="text-xs text-default-400">Switch to historical data view</p>
                            </div>

                            {/* Optional retry indicator */}
                            <div className="flex items-center gap-2 text-xs text-default-400 mt-2">
                              <Icon icon="lucide:refresh-cw" className="animate-spin" width={12} />
                              <span>Monitoring sensor status...</span>
                            </div>
                          </div>
                        </div>
                      ) : chartConfig ? (
                        <LineChart config={chartConfig} isLiveMode={isLiveMode} />
                      ) : enhancedEffectiveIsLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <div className="flex flex-col items-center gap-4 max-w-md">
                            {isLiveMode && liveDataReadiness.shouldWaitForLiveData ? (
                              <LiveDataLoading
                                sensorName={selectedSensorData?.data?.displayName || selectedSensorData?.data?.mac}
                              />
                            ) : (
                              <>
                                <Spinner size="lg" color="primary" />
                                <div className="space-y-2">
                                  <h3 className="text-lg font-semibold text-primary-600">
                                    {isLiveMode ? "Connecting to Live Data" : "Loading Data"}
                                  </h3>
                                  <p className="text-default-600 text-sm">
                                    {isLiveMode
                                      ? "Establishing real-time connection..."
                                      : "Fetching sensor readings..."}
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <div className="flex flex-col items-center gap-4 max-w-md">
                            <Icon
                              icon="lucide:chart-no-axes-column"
                              className="text-default-400"
                              width={64}
                              height={64}
                            />
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-default-600">No Data Available</h3>
                              <p className="text-default-600 text-sm">No data found for the selected time range</p>
                              <p className="text-default-500 text-xs">
                                Try selecting a different time range or check if the sensor was active during this
                                period
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Tab>
                  <Tab key="table" title={isSmallScreen ? "Table" : "Table View"}>
                    <div>
                      {/* Show offline sensor waiting state in table view too - only in live mode */}
                      {isSensorOffline && isLiveMode ? (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                          <div className="flex flex-col items-center gap-4 max-w-md">
                            <Icon icon="lucide:table" className="text-danger-400" width={48} height={48} />
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-danger-600">No Data Available</h3>
                              <p className="text-default-600 text-sm">
                                Sensor{" "}
                                <span className="font-medium text-primary-600">
                                  {selectedSensorData?.data?.displayName || selectedSensorData?.data?.mac}
                                </span>{" "}
                                is currently offline
                              </p>
                              <p className="text-default-500 text-xs">
                                Table will populate once sensor comes back online
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : tableConfig ? (
                        <TableView
                          config={tableConfig}
                          sensorId={sensorId || ""}
                          timeRange={filters.timeRange}
                          onDownloadCSV={handleDownloadCSV}
                          isLiveMode={isLiveMode}
                        />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                          <div className="flex flex-col items-center gap-4 max-w-md">
                            {enhancedEffectiveIsLoading ? (
                              <>
                                <Spinner size="lg" color="primary" />
                                <div className="space-y-2">
                                  <h3 className="text-lg font-semibold text-primary-600">Loading Table Data</h3>
                                  <p className="text-default-600 text-sm">Fetching data for selected time range...</p>
                                </div>
                              </>
                            ) : (
                              <>
                                <Icon icon="lucide:table-2" className="text-default-400" width={48} height={48} />
                                <div className="space-y-2">
                                  <h3 className="text-lg font-semibold text-default-600">No Data Available</h3>
                                  <p className="text-default-600 text-sm">No data found for the selected time range</p>
                                  <p className="text-default-500 text-xs">Try selecting a different time range</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Tab>

                  <Tab key="distribution" title={isSmallScreen ? "Dist" : "Distribution"}>
                    <div className={`${isMobileDevice ? "h-[500px]" : "h-[600px]"}`}>
                      {isSensorOffline && isLiveMode ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <div className="flex flex-col items-center gap-4 max-w-md">
                            <Icon icon="lucide:bar-chart-4" className="text-danger-400" width={48} height={48} />
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-danger-600">Distribution Unavailable</h3>
                              <p className="text-default-600 text-sm">Sensor is currently offline</p>
                            </div>
                          </div>
                        </div>
                      ) : chartConfig ? (
                        <DistributionChart config={chartConfig} showCards showChart isLiveMode={isLiveMode} />
                      ) : enhancedEffectiveIsLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <Spinner size="lg" color="primary" />
                          <p className="text-default-600 text-sm mt-4">Loading Distribution Data...</p>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <Icon icon="lucide:bar-chart-4" className="text-default-400" width={64} height={64} />
                          <p className="text-default-600 text-sm mt-4">No Distribution Data</p>
                        </div>
                      )}
                    </div>
                  </Tab>

                  <Tab key="trend" title={isSmallScreen ? "Trend" : "Trend Analysis"}>
                    <div className={`${isMobileDevice ? "h-[500px]" : "h-[600px]"}`}>
                      {isSensorOffline && isLiveMode ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <div className="flex flex-col items-center gap-4 max-w-md">
                            <Icon icon="lucide:trending-up" className="text-danger-400" width={48} height={48} />
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-danger-600">Trend Analysis Unavailable</h3>
                              <p className="text-default-600 text-sm">Sensor is currently offline</p>
                            </div>
                          </div>
                        </div>
                      ) : chartConfig ? (
                        <TrendAnalysisChart config={chartConfig} showCards showChart isLiveMode={isLiveMode} />
                      ) : enhancedEffectiveIsLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <Spinner size="lg" color="primary" />
                          <p className="text-default-600 text-sm mt-4">Loading Trend Data...</p>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <Icon icon="lucide:trending-up" className="text-default-400" width={64} height={64} />
                          <p className="text-default-600 text-sm mt-4">No Trend Data</p>
                        </div>
                      )}
                    </div>
                  </Tab>

                  <Tab key="anomaly" title={isSmallScreen ? "Anomaly" : "Anomaly Detection"}>
                    <div className={`${isMobileDevice ? "h-[500px]" : "h-[600px]"}`}>
                      {isSensorOffline && isLiveMode ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <div className="flex flex-col items-center gap-4 max-w-md">
                            <Icon icon="lucide:alert-triangle" className="text-danger-400" width={48} height={48} />
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-danger-600">Anomaly Detection Unavailable</h3>
                              <p className="text-default-600 text-sm">Sensor is currently offline</p>
                            </div>
                          </div>
                        </div>
                      ) : chartConfig ? (
                        <AnomalyDetectionChart config={chartConfig} showCards showChart isLiveMode={isLiveMode} />
                      ) : enhancedEffectiveIsLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <Spinner size="lg" color="primary" />
                          <p className="text-default-600 text-sm mt-4">Loading Anomaly Data...</p>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <Icon icon="lucide:alert-triangle" className="text-default-400" width={64} height={64} />
                          <p className="text-default-600 text-sm mt-4">No Anomaly Data</p>
                        </div>
                      )}
                    </div>
                  </Tab>

                  <Tab key="correlation" title={isSmallScreen ? "Corr" : "Correlation"}>
                    <div className={`${isMobileDevice ? "h-[500px]" : "h-[600px]"}`}>
                      {isSensorOffline && isLiveMode ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <div className="flex flex-col items-center gap-4 max-w-md">
                            <Icon icon="lucide:git-branch" className="text-danger-400" width={48} height={48} />
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-danger-600">Correlation Unavailable</h3>
                              <p className="text-default-600 text-sm">Sensor is currently offline</p>
                            </div>
                          </div>
                        </div>
                      ) : chartConfig ? (
                        <CorrelationAnalysisChart config={chartConfig} showCards showChart isLiveMode={isLiveMode} />
                      ) : enhancedEffectiveIsLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <Spinner size="lg" color="primary" />
                          <p className="text-default-600 text-sm mt-4">Loading Correlation Data...</p>
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                          <Icon icon="lucide:git-branch" className="text-default-400" width={64} height={64} />
                          <p className="text-default-600 text-sm mt-4">No Correlation Data</p>
                        </div>
                      )}
                    </div>
                  </Tab>

                  <Tab key="multichart" title={isMobileDevice ? "Multi" : "Multi-Chart View"}>
                    {/* Show offline sensor waiting state in multi-chart view too - only in live mode */}
                    {isSensorOffline && isLiveMode ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                        <div className="flex flex-col items-center gap-4 max-w-md">
                          <Icon icon="lucide:layout-grid" className="text-danger-400" width={48} height={48} />
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-danger-600">Multi-Chart View Unavailable</h3>
                            <p className="text-default-600 text-sm">
                              Sensor{" "}
                              <span className="font-medium text-primary-600">
                                {selectedSensorData?.data?.displayName || selectedSensorData?.data?.mac}
                              </span>{" "}
                              is currently offline
                            </p>
                            <p className="text-default-500 text-xs">
                              Multi-chart view will be available once sensor comes back online
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className={`grid ${isMobileDevice ? "grid-cols-1 gap-3" : "grid-cols-1 md:grid-cols-2 gap-4"}`}
                      >
                        <Card className="shadow-sm">
                          <CardBody className="p-3">
                            <h3 className="text-sm font-medium mb-2 text-primary-600">Value Distribution</h3>
                            <div className={`${isMobileDevice ? "h-[300px]" : "h-[250px]"}`}>
                              {chartConfig ? (
                                <DistributionChart config={chartConfig} showChart isLiveMode={isLiveMode} />
                              ) : enhancedEffectiveIsLoading ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                  <Spinner size="md" color="primary" />
                                  <p className="text-xs text-default-500 mt-2">Loading...</p>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center">
                                  <Icon icon="lucide:bar-chart-4" className="text-default-300" width={32} height={32} />
                                  <p className="text-xs text-default-400 mt-1">No data</p>
                                </div>
                              )}
                            </div>
                          </CardBody>
                        </Card>

                        <Card className="shadow-sm">
                          <CardBody className="p-3">
                            <h3 className="text-sm font-medium mb-2 text-secondary-600">Trend Analysis</h3>
                            <div className={`${isMobileDevice ? "h-[300px]" : "h-[250px]"}`}>
                              {chartConfig ? (
                                <TrendAnalysisChart config={chartConfig} showChart isLiveMode={isLiveMode} />
                              ) : enhancedEffectiveIsLoading ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                  <Spinner size="md" color="secondary" />
                                  <p className="text-xs text-default-500 mt-2">Loading...</p>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center">
                                  <Icon icon="lucide:trending-up" className="text-default-300" width={32} height={32} />
                                  <p className="text-xs text-default-400 mt-1">No data</p>
                                </div>
                              )}
                            </div>
                          </CardBody>
                        </Card>

                        <Card className="shadow-sm">
                          <CardBody className="p-3">
                            <h3 className="text-sm font-medium mb-2 text-danger-600">Anomaly Detection</h3>
                            <div className={`${isMobileDevice ? "h-[300px]" : "h-[250px]"}`}>
                              {chartConfig ? (
                                <AnomalyDetectionChart config={chartConfig} showChart isLiveMode={isLiveMode} />
                              ) : enhancedEffectiveIsLoading ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                  <Spinner size="md" color="danger" />
                                  <p className="text-xs text-default-500 mt-2">Loading...</p>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center">
                                  <Icon
                                    icon="lucide:alert-triangle"
                                    className="text-default-300"
                                    width={32}
                                    height={32}
                                  />
                                  <p className="text-xs text-default-400 mt-1">No data</p>
                                </div>
                              )}
                            </div>
                          </CardBody>
                        </Card>

                        <Card className="shadow-sm">
                          <CardBody className="p-3">
                            <h3 className="text-sm font-medium mb-2 text-success-600">Correlation Analysis</h3>
                            <div className={`${isMobileDevice ? "h-[300px]" : "h-[250px]"}`}>
                              {chartConfig ? (
                                <CorrelationAnalysisChart config={chartConfig} showChart isLiveMode={isLiveMode} />
                              ) : enhancedEffectiveIsLoading ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                  <Spinner size="md" color="success" />
                                  <p className="text-xs text-default-500 mt-2">Loading...</p>
                                </div>
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center">
                                  <Icon icon="lucide:git-branch" className="text-default-300" width={32} height={32} />
                                  <p className="text-xs text-default-400 mt-1">No data</p>
                                </div>
                              )}
                            </div>
                          </CardBody>
                        </Card>
                      </div>
                    )}
                  </Tab>
                </Tabs>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Icon icon="lucide:alert-circle" className="text-default-300 mb-2 mx-auto" width={48} height={48} />
              <p className="text-default-500">No sensor selected or data available</p>
              <Button
                color="primary"
                className="mt-4"
                onPress={() => setIsDropdownOpen(true)}
                startContent={<Icon icon="lucide:search" width={16} />}
              >
                Search for sensors
              </Button>
            </div>
          </div>
        )}
      </div>

      <ExportConfirmationModal
        isOpen={isExportModalOpen}
        onClose={handleCloseExportModal}
        onConfirm={handleConfirmExport}
        onCancel={handleCancelExport}
        estimation={exportEstimation}
        isLoading={isExportLoading}
        exportStatus={exportStatus}
        error={exportError}
        selectedSensors={currentSensor?.mac ? [currentSensor.mac] : []}
        timeRange={{
          start: filters.timeRange.start.toISOString(),
          end: filters.timeRange.end.toISOString(),
        }}
        progress={exportProgress}
        downloadedBytes={downloadedBytes}
        totalBytes={totalBytes}
      />
    </div>
  );
};
