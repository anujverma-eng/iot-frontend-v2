import {
  addToast,
  Button,
  Checkbox,
  CheckboxGroup,
  DateRangePicker,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { CalendarDate, DateValue, getLocalTimeZone } from "@internationalized/date";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { LiveDataLoading } from "../components/visualization/live-data-loading";
import { CompareTray } from "../components/analytics/compare-tray";
import { FilterBar } from "../components/analytics/filter-bar";
import { SensorCard } from "../components/analytics/sensor-card";
import { SensorList } from "../components/analytics/sensor-list";
import { SoloView } from "../components/analytics/solo-view";
import { ClaimSensorModal } from "../components/sensors/claim-sensor-modal";
import { StatsCard } from "../components/stats-card";
import { ChartContainer } from "../components/visualization/chart-container";
import { ComparisonChart } from "../components/visualization/comparison-chart";
import { useBreakpoints } from "../hooks/use-media-query";
import { useOfflineDetectionIntegration } from "../hooks/useOfflineDetectionIntegration";
import { GaugeChart } from "../components/visualization/gauge-chart";
import { chartColors, sensorTypes, statusOptions, timeRangePresets } from "../data/analytics";
import { AppDispatch, RootState } from "../store";
import { fetchGateways, selectGateways } from "../store/gatewaySlice";
import {
  addSelectedSensorId,
  clearSelectedSensorIds,
  fetchSensorById,
  fetchSensors,
  fetchSensorStats,
  removeSelectedSensorId,
  selectFilters,
  selectSelectedSensor,
  selectSelectedSensorIds,
  selectSensorPagination,
  selectSensors,
  selectSensorsLoading,
  selectSensorStats,
  selectEnhancedSensorStats, // Import enhanced stats selector
  setClaimModalOpen,
  setFilters,
  setPage,
  setSelectedSensorIds,
  toggleSensorStar,
  updateSensorDisplayName,
} from "../store/sensorsSlice";
import {
  fetchTelemetry,
  selectTelemetryData,
  selectTelemetryLoading,
  setTimeRange,
  selectLiveSensors,
  selectMaxLiveReadings,
} from "../store/telemetrySlice";
import { selectIsLiveMode, selectIsConnecting, toggleLiveMode } from "../store/liveDataSlice";
import { useDebouncedSensorSelection } from "../hooks/useDebouncedSensorSelection";
import { useOptimizedDataFetch } from "../hooks/useOptimizedDataFetch";
import { useLiveDataReadiness } from "../hooks/useLiveDataReadiness";
import { useCompareSelection } from "../hooks/useCompareSelection";
import { ChartConfig, FilterState, MultiSeriesConfig, SensorStatus, SensorType } from "../types/sensor";
import { sortSensorsByBattery } from "../utils/battery"; // Import battery sorting utility

type RangeValue<T> = { start: T | null; end: T | null };

const toCal = (d: Date): CalendarDate => new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());

interface AnalyticsParams {
  [key: string]: string | undefined;
  sensorId?: string;
}

export const AnalyticsPage: React.FC = () => {
  console.log("[AnalyticsPage] 🚀 Component render started at:", new Date().toISOString());

  const navigate = useNavigate();
  const { sensorId } = useParams<AnalyticsParams>();
  const location = useLocation();
  const isSoloMode = new URLSearchParams(location.search).get("solo") === "true";

  console.log("[AnalyticsPage] 🎯 Initial params and flags:", {
    sensorId,
    isSoloMode,
    pathname: location.pathname,
    search: location.search,
    timestamp: new Date().toISOString(),
  });

  // Use responsive breakpoints
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

  // Enhanced mobile landscape detection - more reliable for iPhone 14 Pro
  const isMobileLandscapeShort = React.useMemo(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    // iPhone 14 Pro landscape: 844x390
    // iPhone 13 Pro landscape: 844x390
    // Generic mobile landscape with short height
    return isLandscape && height <= 450 && width >= 800 && ("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, [isLandscape]);

  // Dynamic chart height calculation for optimal visibility
  const getChartContainerStyle = React.useCallback(() => {
    const baseStyle = {
      width: "100%",
      position: "relative" as const,
      boxSizing: "border-box" as const,
      display: "flex" as const,
      flexDirection: "column" as const,
    };

    let styles;

    if (isMobileLandscapeShort) {
      styles = {
        ...baseStyle,
        // Use a more aggressive height calculation for landscape
        height: "100%", // Reduced from previous calc
        minHeight: "200px", // Ensure minimum usable space
        paddingTop: "2px",
        paddingBottom: "2px",
        paddingLeft: "2px",
        paddingRight: "2px",
      };
    } else if (isMobile && isShortHeight) {
      styles = {
        ...baseStyle,
        height: "100%", // Let it fill the flex container
        padding: "8px",
      };
    } else if (isMobile) {
      styles = {
        ...baseStyle,
        padding: "8px",
      };
    } else {
      styles = {
        ...baseStyle,
        maxHeight: "700px",
        minHeight: "150px",
        flexGrow: 1,
        padding: "18px",
      };
    }
    console.log("..styles", styles);
    return styles;
  }, [isMobileLandscapeShort, isMobile, isShortHeight]);

  // Initialize offline detection integration
  useOfflineDetectionIntegration();

  // Legacy mobile states for drawer management
  const [isMobileSensorDrawerOpen, setIsMobileSensorDrawerOpen] = React.useState(false);
  const [isMobileFilterDrawerOpen, setIsMobileFilterDrawerOpen] = React.useState(false);
  const [selectedTimeRangeIndex, setSelectedTimeRangeIndex] = React.useState(1);
  const dispatch = useDispatch<AppDispatch>();

  // Get state from Redux
  const filters = useSelector(selectFilters);
  const selectedSensorIds = useSelector(selectSelectedSensorIds);
  const telemetryData = useSelector(selectTelemetryData);
  const isLoadingData = useSelector(selectTelemetryLoading);
  const sensors = useSelector(selectSensors);
  const loading = useSelector(selectSensorsLoading);
  const selectedSensorData = useSelector(selectSelectedSensor);
  const pagination = useSelector(selectSensorPagination);
  const gateways = useSelector(selectGateways);

  // Live mode Redux state (now centralized)
  const isLiveMode = useSelector(selectIsLiveMode);
  const isConnecting = useSelector(selectIsConnecting);
  const liveSensors = useSelector(selectLiveSensors);
  const maxLiveReadings = useSelector(selectMaxLiveReadings);

  const stats = useSelector(selectEnhancedSensorStats); // Use enhanced stats with battery count
  const [pendingFilters, setPendingFilters] = React.useState<FilterState | null>(null);

  // DEBUG: Log when sensors or stats change (reduced frequency)
  React.useEffect(() => {
    if (Math.random() < 0.02) {
      // Log only 2% of the time
      console.log(`[Analytics] DEBUG: Sensors data changed, count: ${sensors.length}`);
    }
  }, [sensors]);

  React.useEffect(() => {
    if (stats) {
      console.log(`[Analytics] DEBUG: Stats updated - Live: ${stats.liveSensors}, Offline: ${stats.offlineSensors}`);
    }
  }, [stats]);

  const applyPendingFilters = () => {
    if (pendingFilters) {
      // First update filters state
      dispatch(setFilters(pendingFilters));

      // Explicitly set time range - this is critical!
      dispatch(setTimeRange(pendingFilters.timeRange));

      // Then trigger telemetry data fetch with the new time range
      if (selectedSensor) {
        dispatch(
          fetchTelemetry({
            sensorIds: [selectedSensor],
            timeRange: {
              start: toISO(pendingFilters.timeRange.start),
              end: toISO(pendingFilters.timeRange.end),
            },
          })
        );
      }

      // Also fetch data for comparison sensors if in compare mode
      if (selectedSensorIds.length > 0) {
        dispatch(
          fetchTelemetry({
            sensorIds: selectedSensorIds,
            timeRange: {
              start: toISO(pendingFilters.timeRange.start),
              end: toISO(pendingFilters.timeRange.end),
            },
          })
        );
      }

      // Clear pending filters and close drawer
      setPendingFilters(null);
      setIsMobileFilterDrawerOpen(false);
    }
  };

  // Use optimized data fetching hook
  const { fetchData: fetchOptimizedData, cancelPendingRequests } = useOptimizedDataFetch();

  // --- local search text (controlled input) ----------------------------
  const [searchQuery, setSearchQuery] = React.useState(filters.search || "");

  // keep local box in sync if an outside action changed the global filter
  React.useEffect(() => setSearchQuery(filters.search || ""), [filters.search]);

  // Debounced update to Redux - only update Redux store when user stops typing
  React.useEffect(() => {
    const id = setTimeout(() => {
      dispatch(setFilters({ ...filters, search: searchQuery }));
    }, 300); // Reduced debounce time for better UX
    return () => clearTimeout(id);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Add state for selected sensor
  const [selectedSensor, setSelectedSensor] = React.useState<string | null>(null);

  // Add state for compare mode
  const [isCompareMode, setIsCompareMode] = React.useState(false);

  // Add live data readiness hook to prevent flickering
  // Detect if we're filtering for offline sensors
  const isOfflineSensorFilter = filters.status === "offline";

  console.log("[Analytics] 🔄 Hook setup:", {
    selectedSensor,
    isOfflineSensorFilter,
    filtersStatus: filters.status,
    hookFunction: typeof useLiveDataReadiness,
    hookExists: !!useLiveDataReadiness,
    timestamp: new Date().toISOString(),
  });

  let liveDataReadiness;
  try {
    console.log("[Analytics] 🎯 Attempting to call useLiveDataReadiness hook...");
    liveDataReadiness = useLiveDataReadiness(selectedSensor, isOfflineSensorFilter);
    console.log("[Analytics] ✅ Hook call successful!");
  } catch (error) {
    console.error("[Analytics] ❌ Hook call failed:", error);
    // Fallback values
    liveDataReadiness = {
      shouldWaitForLiveData: false,
      shouldShowLoading: false,
      shouldFetchApiData: true,
      hasReceivedLiveData: false,
    };
  }

  console.log("[Analytics] 📊 Hook results:", {
    selectedSensor,
    liveDataReadiness,
    timestamp: new Date().toISOString(),
  });

  // Enhanced loading state that considers live data readiness
  const effectiveIsLoading = isLoadingData || liveDataReadiness.shouldShowLoading;

  console.log("[Analytics] 🎯 Loading states:", {
    isLoadingData,
    hookShouldShowLoading: liveDataReadiness.shouldShowLoading,
    effectiveIsLoading,
    timestamp: new Date().toISOString(),
  });

  // Track if this is the initial load for the current sensor to prevent duplicate fetches
  const initialLoadRef = React.useRef<string | null>(null);

  // Comprehensive state tracking effect (with proper dependencies to avoid render loop)
  React.useEffect(() => {
    console.log("[Analytics] 🔍 COMPREHENSIVE STATE TRACKING:", {
      // Core states
      selectedSensor,
      isLiveMode,
      effectiveIsLoading,
      isLoadingData,

      // Hook states
      liveDataReadiness: {
        shouldWaitForLiveData: liveDataReadiness.shouldWaitForLiveData,
        shouldShowLoading: liveDataReadiness.shouldShowLoading,
        shouldFetchApiData: liveDataReadiness.shouldFetchApiData,
        hasReceivedLiveData: liveDataReadiness.hasReceivedLiveData,
      },

      // Data states
      hasTelemetryData: selectedSensor ? !!telemetryData[selectedSensor] : false,
      telemetryDataKeys: Object.keys(telemetryData),
      hasChartConfig: !!chartConfig,

      // Filter states
      isOfflineSensorFilter,
      filtersStatus: filters.status,

      // UI states
      isMobile,
      isSoloMode,
      isConnecting,

      timestamp: new Date().toISOString(),
    });
  }, [
    selectedSensor,
    isLiveMode,
    effectiveIsLoading,
    isLoadingData,
    liveDataReadiness.shouldWaitForLiveData,
    liveDataReadiness.shouldShowLoading,
    isOfflineSensorFilter,
  ]);

  // DEBUG: Comprehensive device and layout debugging
  React.useEffect(() => {
    const debugInfo = {
      // Device Info
      device: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      userAgent: navigator.userAgent.substring(0, 100),

      // Breakpoint States
      isMobile,
      isLandscape,
      isShortHeight,
      isVeryShortHeight,
      isMobileLandscapeShort,
      isIPhone14Pro,
      isIPhoneLandscape,
      isPixelLandscape,

      // Layout Decisions
      showHeader: !isMobileLandscapeShort,
      showMobileControls:
        isMobile && !isSoloMode && !(isCompareMode && selectedSensorIds.length === 0) && !isMobileLandscapeShort,
      showFloatingControls: isMobileLandscapeShort && !isSoloMode,
      showSidebar: !isSoloMode && !isMobile,

      // Chart Calculations
      chartPaddingTop: isMobileLandscapeShort ? "48px" : "0px",
      calculatedMinHeight: (() => {
        if (isMobileLandscapeShort) {
          return `${Math.max(300, window.innerHeight - 60)}px`;
        } else if (isVeryShortHeight && isMobile) {
          return `${Math.max(280, window.innerHeight - 140)}px`;
        } else if (isMobile) {
          return `${Math.max(400, window.innerHeight - 280)}px`;
        }
        return "auto";
      })(),
    };

    console.log("[Analytics] Comprehensive Device Debug:", debugInfo);

    // iPhone 14 Pro specific debugging
    if (window.innerWidth === 844 && window.innerHeight === 390) {
      console.log("[Analytics] iPhone 14 Pro Landscape Detected - Special handling active");
    }

    // Pixel phone specific debugging
    if (window.innerHeight < 450 && window.innerWidth > 800 && window.innerWidth < 950) {
      console.log("[Analytics] Pixel Landscape Detected - Special handling active");
    }
  }, [
    isMobile,
    isLandscape,
    isShortHeight,
    isVeryShortHeight,
    isMobileLandscapeShort,
    isIPhone14Pro,
    isIPhoneLandscape,
    isPixelLandscape,
    isSoloMode,
    isCompareMode,
    selectedSensorIds.length,
  ]);

  const syncTimeRange = (range: { start: Date; end: Date }) => {
    dispatch(setFilters({ ...filters, timeRange: range })); // sensors slice
    dispatch(setTimeRange(range)); // telemetry slice
  };

  const syncLiveMode = (isLive: boolean) => {
    dispatch(toggleLiveMode({ enable: isLive })); // This sets the live mode in Redux
  };

  // Fetch sensors on component mount
  React.useEffect(() => {
    dispatch(
      fetchSensors({
        page: 1,
        limit: 50,
        claimed: true,
        search: "", // Remove search from API - do client-side filtering instead
        // TODO: add `type` & `status` here when the backend supports them
      })
    );
    dispatch(fetchSensorStats());
    dispatch(fetchGateways({ page: 1, limit: 1000, search: "" }));
  }, [dispatch, filters.types, filters.status]); // Remove filters.search from dependency

  // Note: Live mode is now controlled only via navbar and time-range-selector
  // Removed auto-enable logic to prevent conflicts with manual user controls

  // Refresh sensor data (for use after sensor updates/deletions)
  const refreshSensorData = React.useCallback(() => {
    dispatch(
      fetchSensors({
        page: pagination.page,
        limit: pagination.limit,
        claimed: true,
        search: "", // Remove search from API - do client-side filtering instead
        sort: filters.sort?.field,
        dir: filters.sort?.direction,
      })
    );
    dispatch(fetchSensorStats());
  }, [dispatch, pagination.page, pagination.limit, filters.sort]); // Remove filters.search from dependency

  // Map sensors to the format expected by components
  const mappedSensors = React.useMemo(() => {
    return sensors.map((sensor) => ({
      ...sensor,
      id: sensor._id,
      favorite: typeof sensor.favorite === "boolean" ? sensor.favorite : false, // ensure favorite is always boolean
      name: sensor.displayName || sensor.mac,
    }));
  }, [sensors]);

  // Filter sensors based on current filters
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

    /* status - Fix to use isOnline field instead of status field */
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
        // Handle favorite/starred fields
        if (field === "starred" || field === "favorite") {
          const af = a.favorite ? 1 : 0;
          const bf = b.favorite ? 1 : 0;
          if (af === bf) return 0;
          return (af > bf ? 1 : -1) * (direction === "asc" ? 1 : -1);
        }

        // Handle date fields (lastSeen)
        if (field === "lastSeen") {
          const av = new Date(a[field]).getTime();
          const bv = new Date(b[field]).getTime();
          if (isNaN(av) && isNaN(bv)) return 0;
          if (isNaN(av)) return 1; // Put invalid dates at end
          if (isNaN(bv)) return -1;
          return (av - bv) * (direction === "asc" ? 1 : -1);
        }

        // Handle string fields (displayName, name)
        if (field === "displayName" || field === "name") {
          const av = (a.displayName || a.name || a.mac || "").toString().toLowerCase();
          const bv = (b.displayName || b.name || b.mac || "").toString().toLowerCase();
          if (av === bv) return 0;
          return av.localeCompare(bv) * (direction === "asc" ? 1 : -1);
        }

        // Handle numeric fields (battery)
        if (field === "battery") {
          const av = typeof a[field] === "number" ? a[field] : -1;
          const bv = typeof b[field] === "number" ? b[field] : -1;
          if (av === bv) return 0;
          return (av - bv) * (direction === "asc" ? 1 : -1);
        }

        // Generic field handling
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av > bv ? 1 : -1) * (direction === "asc" ? 1 : -1);
      });
    } else {
      // Only apply battery sorting when no specific sort is selected
      list = sortSensorsByBattery(list);
    }

    return list;
  }, [mappedSensors, filters]);

  const [isCompareExpanded, setIsCompareExpanded] = React.useState(false);
  const [isMobileCompareSheetOpen, setIsMobileCompareSheetOpen] = React.useState(false);
  const [isSwipingToGauge, setIsSwipingToGauge] = React.useState(false);

  // Add loading state for skeleton
  const [isPageLoading, setIsPageLoading] = React.useState(true);

  const claimModalOpen = useSelector((state: RootState) => state.sensors.claimModal.isOpen);

  // Simulate initial page load
  React.useEffect(() => {
    const idx = timeRangePresets.findIndex((p) => {
      const presetRange = p.getValue();
      return sameRange(presetRange, filters.timeRange);
    });
    if (idx !== -1) setSelectedTimeRangeIndex(idx);
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Handle URL parameter for selected sensor
  // CRITICAL FIX: Only depend on sensor IDs, not the entire filteredSensors array
  // to prevent API calls on every WebSocket message
  const sensorIds = React.useMemo(
    () => filteredSensors?.map((s) => s.id) || [],
    [filteredSensors?.length, filteredSensors?.map((s) => s.id).join(",")]
  );

  React.useEffect(() => {
    console.log("[Analytics] 🎯 URL sensor effect triggered with:", {
      sensorId,
      selectedSensor,
      sensorCount: sensorIds.length,
      hasFilteredSensors: !!filteredSensors?.length,
      timestamp: new Date().toISOString(),
    });

    if (sensorId) {
      console.log("[Analytics] 🔗 Setting sensor from URL parameter:", {
        sensorId,
        timestamp: new Date().toISOString(),
      });
      dispatch(fetchSensorById(sensorId));
      setSelectedSensor(sensorId);
    } else if (sensorIds.length > 0 && !selectedSensor) {
      const firstSensorId = sensorIds[0];
      console.log("[Analytics] 🎲 Auto-selecting first sensor:", {
        firstSensorId,
        availableSensors: sensorIds.length,
        timestamp: new Date().toISOString(),
      });
      dispatch(fetchSensorById(firstSensorId));
      setSelectedSensor(firstSensorId);
      navigate(`/dashboard/sensors/${firstSensorId}`, { replace: true });
    } else {
      console.log("[Analytics] ❌ No sensor selection action taken:", {
        hasSensorId: !!sensorId,
        sensorCount: sensorIds.length,
        hasSelectedSensor: !!selectedSensor,
        timestamp: new Date().toISOString(),
      });
    }
  }, [sensorId, sensorIds.length, sensorIds.join(","), selectedSensor, dispatch, navigate]);

  // Enhanced loading state that considers initial page load scenarios
  const isInitiallyLoading =
    loading || (!selectedSensor && (sensorIds.length > 0 || sensors.length > 0) && !isCompareMode);
  const enhancedEffectiveIsLoading = effectiveIsLoading || isInitiallyLoading;

  console.log("[Analytics] 🎯 Enhanced loading states:", {
    originalEffectiveIsLoading: effectiveIsLoading,
    isInitiallyLoading,
    sensorsLoading: loading,
    sensorsCount: sensors.length,
    sensorIdsCount: sensorIds.length,
    hasSelectedSensor: !!selectedSensor,
    isCompareMode,
    finalEffectiveIsLoading: enhancedEffectiveIsLoading,
    timestamp: new Date().toISOString(),
  });

  // Note: Live mode cleanup is now handled centrally by the live data system
  // No need for page-specific cleanup

  const toISO = (d: Date | string) => new Date(d).toISOString();

  // Use comparison selection hook for better loading states
  const {
    addSensorToComparison,
    removeSensorFromComparison,
    isSensorLoading,
    canAddMoreSensors,
    shouldShowComparison,
    isGlobalLoading: isCompareLoading,
    minSensorsForFetch,
  } = useCompareSelection({
    timeRange: {
      start: toISO(filters.timeRange.start),
      end: toISO(filters.timeRange.end),
    },
    maxSensors: 10,
    minSensorsForFetch: 2, // Only start loading when 2+ sensors selected
  });

  // Stringify time range for reliable dependency comparison
  const timeRangeKey = React.useMemo(() => {
    return `${filters.timeRange.start.getTime()}-${filters.timeRange.end.getTime()}`;
  }, [filters.timeRange]);

  // Add a ref to track the most recent time range request
  const lastTimeRangeRequestRef = React.useRef<string>("");
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = React.useState(false);

  // Mark initial load as completed
  React.useEffect(() => {
    if (!hasInitialLoadCompleted) {
      console.log("[Analytics] ✅ Initial load completed");
      setHasInitialLoadCompleted(true);
    }
  }, [hasInitialLoadCompleted]);

  // Optimized telemetry fetching - always fetch API data, but control display
  React.useEffect(() => {
    console.log("[Analytics] 🚀 Data fetching effect triggered:", {
      selectedSensor,
      hasSelectedSensor: !!selectedSensor,
      timeRangeKey,
      lastRequest: lastTimeRangeRequestRef.current,
      hasInitialLoadCompleted,
      timestamp: new Date().toISOString(),
    });

    if (!selectedSensor) {
      console.log("[Analytics] ❌ No selected sensor, skipping fetch");
      return;
    }

    // Create a request ID based on current parameters
    const currentRequest = `${selectedSensor}-${timeRangeKey}`;

    // Don't make duplicate requests
    if (lastTimeRangeRequestRef.current === currentRequest) {
      console.log("[Analytics] 🔄 Duplicate request prevented:", {
        currentRequest,
        lastRequest: lastTimeRangeRequestRef.current,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // On initial load, give live connection a chance to start before fetching data
    // This prevents fetching full historical data when live mode will be enabled
    const isInitialLoad = lastTimeRangeRequestRef.current === "";
    if (isInitialLoad && !isLiveMode && !isConnecting) {
      console.log("[Analytics] ⏱️ Initial load detected - delaying fetch to allow live connection:", {
        isInitialLoad,
        isLiveMode,
        isConnecting,
        willRetryAfter: "500ms",
        timestamp: new Date().toISOString(),
      });

      // Give live connection 500ms to start, then retry this effect
      setTimeout(() => {
        console.log("[Analytics] 🔄 Initial load delay completed, triggering re-fetch");
        // Trigger the effect again by updating a dummy state or using a different approach
        // Since we can't directly trigger the effect, we'll just proceed with the fetch
        // The live connection should have started by now
      }, 500);
      return;
    }

    console.log("[Analytics] 📊 Data fetch conditions:", {
      sensor: selectedSensor,
      liveDataReadiness: {
        shouldFetchApiData: liveDataReadiness.shouldFetchApiData,
        shouldShowLoading: liveDataReadiness.shouldShowLoading,
        shouldWaitForLiveData: liveDataReadiness.shouldWaitForLiveData,
        hasReceivedLiveData: liveDataReadiness.hasReceivedLiveData,
      },
      globalStates: {
        isLiveMode,
        isOfflineSensorFilter,
        isLoadingData,
      },
      timestamp: new Date().toISOString(),
    });

    // Always update the request ref to prevent duplicate attempts
    lastTimeRangeRequestRef.current = currentRequest;
    console.log("[Analytics] 📝 Request ref updated to:", currentRequest);

    // Check if we should fetch API data based on live data readiness
    if (!liveDataReadiness.shouldFetchApiData) {
      console.log("[Analytics] 🚫 SKIPPING API fetch - waiting for live data:", {
        shouldFetchApiData: liveDataReadiness.shouldFetchApiData,
        shouldShowLoading: liveDataReadiness.shouldShowLoading,
        shouldWaitForLiveData: liveDataReadiness.shouldWaitForLiveData,
        reason: "Live data readiness hook says don't fetch API data yet",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    console.log("[Analytics] 🔥 FETCHING API data for sensor:", {
      selectedSensor,
      timeRange: {
        start: filters.timeRange.start.toISOString(),
        end: filters.timeRange.end.toISOString(),
      },
      hookPermission: {
        shouldFetchApiData: liveDataReadiness.shouldFetchApiData,
        shouldShowLoading: liveDataReadiness.shouldShowLoading,
      },
      timestamp: new Date().toISOString(),
    });

    // Determine if we should fetch limited data or full time range
    const isLiveModeOrConnecting = isLiveMode || isConnecting;
    let timeRangeToUse;

    if (isInitialLoad) {
      // For initial load, use the selected time range - respecting user's filter choice
      timeRangeToUse = {
        start: new Date(filters.timeRange.start),
        end: new Date(filters.timeRange.end),
      };
      timeRangeToUse.end.setHours(23, 59, 59, 999);

      console.log("[Analytics] 📅 Using selected time range for INITIAL LOAD:", {
        timeRange: {
          start: timeRangeToUse.start.toISOString(),
          end: timeRangeToUse.end.toISOString(),
        },
        isInitialLoad: true,
      });
    } else if (isLiveModeOrConnecting) {
      // For live mode, use the selected time range - respecting user's filter choice
      timeRangeToUse = {
        start: new Date(filters.timeRange.start),
        end: new Date(filters.timeRange.end),
      };
      timeRangeToUse.end.setHours(23, 59, 59, 999);

      console.log("[Analytics] � Using LIMITED time range for live mode:", {
        reason: "Using user's selected time range",
        timeRange: {
          start: timeRangeToUse.start.toISOString(),
          end: timeRangeToUse.end.toISOString(),
        },
        isLiveMode,
        isConnecting,
      });
    } else {
      // For normal mode, use the full selected time range
      timeRangeToUse = {
        start: new Date(filters.timeRange.start),
        end: new Date(filters.timeRange.end),
      };
      timeRangeToUse.end.setHours(23, 59, 59, 999);

      console.log("[Analytics] 📅 Using FULL time range for normal mode:", {
        timeRange: {
          start: timeRangeToUse.start.toISOString(),
          end: timeRangeToUse.end.toISOString(),
        },
      });
    }

    fetchOptimizedData({
      sensorIds: [selectedSensor],
      timeRange: {
        start: toISO(timeRangeToUse.start),
        end: toISO(timeRangeToUse.end),
      },
    });

    console.log("[Analytics] ✅ API fetch initiated");
  }, [selectedSensor, timeRangeKey, isOfflineSensorFilter, isLiveMode, isConnecting, hasInitialLoadCompleted]);

  const sameRange = (a: { start: Date; end: Date }, b: { start: Date; end: Date }) =>
    new Date(a.start).getTime() === new Date(b.start).getTime() &&
    new Date(a.end).getTime() === new Date(b.end).getTime();

  // Fetch data for comparison sensors with optimization
  React.useEffect(() => {
    if (selectedSensorIds.length > 0) {
      fetchOptimizedData({
        sensorIds: selectedSensorIds,
        timeRange: {
          start: toISO(filters.timeRange.start),
          end: toISO(filters.timeRange.end),
        },
      });
    }
  }, [selectedSensorIds, filters.timeRange]); // Remove fetchOptimizedData to prevent unnecessary re-renders

  // Add cleanup effect
  React.useEffect(() => {
    return () => {
      // Cancel any pending requests when component unmounts
      cancelPendingRequests();
    };
  }, [cancelPendingRequests]);

  const handleSensorSelect = (id: string) => {
    console.log("[Analytics] 🎯 Sensor selection initiated:", {
      newSensorId: id,
      previousSensor: selectedSensor,
      timestamp: new Date().toISOString(),
    });

    // No need to cancel - optimized fetch will handle deduplication
    setSelectedSensor(id);
    navigate(`/dashboard/sensors/${id}`);

    console.log("[Analytics] ✅ Sensor selection completed, navigation triggered");
  };

  const handleSearchChange = (txt: string) => setSearchQuery(txt);

  const handleLoadMore = () => {
    if (pagination.page >= pagination.totalPages || loading) return;
    const next = pagination.page + 1;
    dispatch(
      fetchSensors({
        page: next,
        limit: 50,
        claimed: true,
        search: filters.search || "",
        sort: filters.sort?.field,
        dir: filters.sort?.direction,
      })
    );
    dispatch(setPage(next));
  };

  const handleTypeChange = (types: SensorType[]) => {
    dispatch(setFilters({ ...filters, types }));
  };

  const handleStatusChange = (status: string) => {
    dispatch(setFilters({ ...filters, status: status as SensorStatus | "all" }));
  };

  const handleFiltersChange = (newFilters: Partial<FilterState>) => {
    const merged = { ...filters, ...newFilters };
    dispatch(setFilters(merged));

    if (newFilters.timeRange) {
      // 1. Ensure end date is set to end of day for consistency
      const timeRange = {
        start: new Date(newFilters.timeRange.start),
        end: new Date(newFilters.timeRange.end),
      };

      // Ensure end time is end of day
      timeRange.end.setHours(23, 59, 59, 999);

      // 2. Update Redux state with the sanitized time range
      dispatch(setTimeRange(timeRange));

      console.log("[Analytics] Fetching telemetry with time range:", {
        start: timeRange.start.toISOString(),
        end: timeRange.end.toISOString(),
      });

      // 3. Force-fetch data with the new time range
      if (selectedSensor) {
        dispatch(
          fetchTelemetry({
            sensorIds: [selectedSensor],
            timeRange: {
              start: toISO(timeRange.start),
              end: toISO(timeRange.end),
            },
          })
        );
      }

      // Also fetch for comparison mode
      if (selectedSensorIds.length > 0) {
        dispatch(
          fetchTelemetry({
            sensorIds: selectedSensorIds,
            timeRange: {
              start: toISO(timeRange.start),
              end: toISO(timeRange.end),
            },
          })
        );
      }
    }
  };

  const handleMobileTypeChange = (types: SensorType[]) => {
    if (isMobile) {
      setPendingFilters((prev) => ({
        ...(prev || filters),
        types,
      }));
    } else {
      handleTypeChange(types);
    }
  };

  const handleMobileStatusChange = (status: string) => {
    if (isMobile) {
      setPendingFilters((prev) => ({
        ...(prev || filters),
        status: status as SensorStatus | "all", // Cast to the correct type
      }));
    } else {
      handleStatusChange(status);
    }
  };

  const handleMobileSortChange = (field: string, direction: "asc" | "desc") => {
    if (isMobile) {
      setPendingFilters((prev) => ({ ...(prev || filters), sort: { field, direction } }));
    } else {
      dispatch(setFilters({ ...filters, sort: { field, direction } }));
    }
  };

  const handleMobileTimeRangeChange = (index: number) => {
    setSelectedTimeRangeIndex(index);

    // Get the time range from the preset
    const newTimeRange = timeRangePresets[index].getValue();

    if (isMobile) {
      setPendingFilters((prev) => ({
        ...(prev || filters),
        timeRange: newTimeRange,
      }));
    } else {
      syncTimeRange(newTimeRange);
    }
  };

  const handleMultiSelect = (ids: string[]) => {
    // Use the comparison hook for optimized loading states
    const currentIds = new Set(selectedSensorIds);
    const newIds = new Set(ids);

    // Find added and removed sensors
    const addedSensors = ids.filter((id) => !currentIds.has(id));
    const removedSensors = selectedSensorIds.filter((id) => !newIds.has(id));

    // Handle additions
    addedSensors.forEach((id) => {
      if (canAddMoreSensors(ids.length)) {
        addSensorToComparison(id);
      }
    });

    // Handle removals
    removedSensors.forEach((id) => {
      removeSensorFromComparison(id);
    });
  };

  const handleRemoveCompare = (id: string) => {
    // Directly dispatch the removeSelectedSensorId action
    dispatch(removeSelectedSensorId(id));

    // If removing the last sensor, exit compare mode
    if (selectedSensorIds.length <= 1) {
      setIsCompareExpanded(false);
      setIsCompareMode(false);
    }
  };

  const handleClearCompare = () => {
    // Directly dispatch the clearSelectedSensorIds action
    dispatch(clearSelectedSensorIds());
    setIsCompareExpanded(false);
    setIsCompareMode(false);
  };

  const handleBrushChange = (start: Date, end: Date) => {
    dispatch(
      setFilters({
        ...filters,
        timeRange: { start, end },
      })
    );
  };

  const handleDownloadCSV = () => {
    try {
      if (!chartConfig || !chartConfig.series) {
        addToast({
          title: "Download Failed",
          description: "No data available to download",
        });
        return;
      }

      let csvContent = "Timestamp,Value\n";

      chartConfig.series.forEach((dataPoint) => {
        const timestamp = new Date(dataPoint.timestamp).toISOString();
        csvContent += `${timestamp},${dataPoint.value}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const currentSensorData = sensors.find((s) => s._id === selectedSensor);
      const filename = currentSensorData
        ? `${currentSensorData.displayName || currentSensorData.mac}_data.csv`
        : `sensor_data_${new Date().toISOString().split("T")[0]}.csv`;

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

      addToast({
        title: "CSV Downloaded",
        description: "Sensor data has been downloaded as CSV",
      });
    } catch (error) {
      console.error("Error downloading CSV:", error);
      addToast({
        title: "Download Failed",
        description: "Failed to download CSV data",
      });
    }
  };

  const handleDisplayNameChange = (displayName: string) => {
    if (selectedSensor) {
      dispatch(updateSensorDisplayName({ mac: selectedSensor, displayName }));
    }
  };

  const handleToggleStar = async (mac: string) => {
    try {
      await dispatch(toggleSensorStar(mac)).unwrap();
    } catch (e) {
      addToast({
        title: "Failed to update favorite",
        description: typeof e === "string" ? e : "Please try again.",
      });
    }
  };

  const handleOpenInNewTab = () => {
    if (selectedSensor) {
      // Open in new tab with solo=true parameter
      const url = new URL(`/dashboard/sensors/${selectedSensor}`, window.location.origin);
      url.searchParams.set("solo", "true");
      window.open(url.toString(), "_blank");
    }
  };

  const handleToggleCompareSheet = () => {
    setIsMobileCompareSheetOpen(!isMobileCompareSheetOpen);
  };

  // Add handler for toggling compare mode
  const toggleCompareMode = () => {
    setIsCompareMode(!isCompareMode);
    if (!isCompareMode) {
      // When entering compare mode, clear any existing selection
      dispatch(clearSelectedSensorIds());
    }
  };

  // Optional: Test publish command function
  const handleSendTestCommand = async () => {
    if (!isLiveMode) {
      addToast({
        title: "Live Mode Required",
        description: "Enable live mode before sending commands",
      });
      return;
    }

    try {
      // Get the first active gateway to send test to
      const activeGateway = gateways.find((gateway) => gateway.status === "active");
      if (!activeGateway) {
        addToast({
          title: "No Active Gateway",
          description: "No active gateway found to send command to",
        });
        return;
      }

      const gatewayId = activeGateway._id;
      // TODO: Re-enable when publishCommand is available
      // await publishCommand(gatewayId, { type: 'ping', ts: Date.now() });

      addToast({
        title: "Test Command Sent",
        description: `Sent ping command to ${gatewayId}`,
      });
    } catch (error) {
      console.error("[Analytics] Test command error:", error);
      addToast({
        title: "Command Error",
        description: error instanceof Error ? error.message : "Failed to send test command",
      });
    }
  };

  // Prepare chart config for selected sensor with live data readiness control
  const chartConfig: ChartConfig | null = React.useMemo(() => {
    console.log("[Analytics] 📊 Chart config computation started:", {
      selectedSensor,
      hasTelemetryData: selectedSensor ? !!telemetryData[selectedSensor] : false,
      liveDataReadiness,
      timestamp: new Date().toISOString(),
    });

    if (!selectedSensor || !telemetryData[selectedSensor]) {
      console.log("[Analytics] ❌ No chart config - missing sensor or telemetry data:", {
        hasSelectedSensor: !!selectedSensor,
        hasTelemetryData: selectedSensor ? !!telemetryData[selectedSensor] : false,
      });
      return null;
    }

    const sensorData = telemetryData[selectedSensor];

    // Enhanced debugging for live data
    const currentSeries = sensorData.series;
    
    // Apply dynamic reading limit in live mode based on user's selection
    // In offline mode, show all data for proper historical analysis
    const shouldLimitToLatest = isLiveMode; // Only limit in live mode
    const displaySeries = shouldLimitToLatest && currentSeries.length > maxLiveReadings ? 
      currentSeries.slice(-maxLiveReadings) : currentSeries;
    
    const chartConfigResult = {
      type: sensorData.type,
      unit: sensorData.unit,
      series: displaySeries,
      color: chartColors[0],
    };

    console.log("[Analytics] 📈 Chart config created:", {
      sensorId: selectedSensor,
      totalDataPoints: currentSeries.length,
      displayedDataPoints: displaySeries.length,
      wasLimited: displaySeries.length < currentSeries.length,
      isLiveMode,
      maxLiveReadings,
      limitApplied: shouldLimitToLatest ? `Live mode - limited to ${maxLiveReadings}` : "Offline mode - show all",
      firstPoint: displaySeries[0],
      lastPoint: displaySeries[displaySeries.length - 1],
      nonNullCount: displaySeries.filter((point) => point && point.value !== null && point.value !== undefined).length,
      isLive: sensorData.isLive,
      shouldShowLoading: liveDataReadiness.shouldShowLoading,
      type: sensorData.type,
      unit: sensorData.unit,
      timestamp: new Date().toISOString(),
    });

    return chartConfigResult;
  }, [
    selectedSensor,
    // Depend on the series array reference itself - will change when Redux creates new array
    selectedSensor ? telemetryData[selectedSensor]?.series : null,
    isLiveMode, // Track live mode changes
    maxLiveReadings, // Track reading limit changes
    liveDataReadiness.shouldShowLoading, // Track loading state changes
  ]);

  // Prepare multi-series chart config for comparison
  const multiSeriesConfig: MultiSeriesConfig | null = React.useMemo(() => {
    if (Object.keys(telemetryData).length === 0 || selectedSensorIds.length === 0) return null;

    // Find sensors with available telemetry data
    const availableSensors = selectedSensorIds.filter((id) => telemetryData[id]);

    if (availableSensors.length === 0) return null;

    // Find a common type if possible
    const types = new Set(availableSensors.map((id) => telemetryData[id].type));
    const commonType = types.size === 1 ? telemetryData[availableSensors[0]].type : ("temperature" as SensorType); // Use a valid SensorType instead of 'generic'

    // Find a common unit if possible
    const units = new Set(availableSensors.map((id) => telemetryData[id].unit));
    const commonUnit = units.size === 1 ? telemetryData[availableSensors[0]].unit : "value";

    return {
      type: commonType,
      unit: commonUnit,
      series: availableSensors.map((id, index) => {
        const sensor = sensors.find((s) => s._id === id);
        const sensorSeries = telemetryData[id].series;
        
        // Apply dynamic reading limit in live mode based on user's selection
        // In offline mode, show all data for proper historical analysis
        const shouldLimitToLatest = isLiveMode; // Only limit in live mode
        const displaySeries = shouldLimitToLatest && sensorSeries.length > maxLiveReadings ? 
          sensorSeries.slice(-maxLiveReadings) : sensorSeries;
        
        return {
          id,
          name: sensor?.displayName || sensor?.mac || id,
          color: chartColors[index % chartColors.length],
          data: displaySeries,
        };
      }),
    };
  }, [
    telemetryData,
    selectedSensorIds,
    sensors,
    isLiveMode, // Track live mode changes
    maxLiveReadings, // Track reading limit changes
    // In live mode, track data changes for selected sensors
    isLiveMode
      ? selectedSensorIds.map((id) => (telemetryData[id] ? telemetryData[id].series.length : 0)).join(",")
      : null,
  ]);

  // Find the currently selected sensor object
  const currentSensor = React.useMemo(() => {
    return filteredSensors.find((s) => s.id === selectedSensor);
  }, [filteredSensors, selectedSensor]);

  // Find selected sensors for comparison
  const selectedSensorsForCompare = React.useMemo(() => {
    return filteredSensors.filter((s) => selectedSensorIds.includes(s.id));
  }, [filteredSensors, selectedSensorIds]);

  if (loading || isPageLoading) {
    return (
      <div className="flex flex-col h-screen">
        {!isMobile && (
          <div className="w-full bg-content1 border-b border-divider px-6 py-3">
            <div className="flex flex-wrap items-center gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 w-32 bg-default-200 animate-pulse rounded-md"></div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {!isSoloMode && !isMobile && (
            <div className="w-80 border-r border-divider flex flex-col">
              <div className="p-4 border-b border-divider">
                <div className="h-10 bg-default-200 animate-pulse rounded-md"></div>
              </div>
              <div className="flex-1 p-2 space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-20 bg-default-200 animate-pulse rounded-md"></div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 p-4">
              <div className="h-full bg-default-200 animate-pulse rounded-md"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Return solo view if in solo mode
  if (isSoloMode) {
    return <SoloView />;
  }

  return (
    // <div className="w-full h-screen overflow-hidden bg-background">
    <div
      className={`w-full bg-background ${
        isMobileLandscapeShort || isMobile
          ? "min-h-screen overflow-auto" // Allow scrolling
          : "h-screen overflow-hidden" // Normal desktop behavior
      }`}
    >
      {/* Mobile-first responsive structure */}

      {/* Header Section - Mobile First Design */}
      <div className={`shrink-0 border-b border-divider bg-content1`}>
        {/* Mobile: Ultra-compact header */}
        {isMobile ? (
          <div className={`px-3 ${isShortHeight ? "py-0.5" : "py-2"}`}>
            <div className="flex items-center justify-between">
              <div className="px-4">
                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      variant="bordered"
                      startContent={<Icon icon="lucide:bar-chart-3" width={16} />}
                      endContent={<Icon icon="lucide:chevron-down" width={16} />}
                      className="w-full justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs">Sensors:</span>
                        <span className="font-semibold text-success">{stats?.liveSensors ?? 0}</span>
                        <span className="text-xs text-default-500">/{stats?.claimed ?? 0}</span>
                      </div>
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Sensor statistics">
                    <DropdownItem key="total" textValue="Total Sensors">
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                          <Icon icon="lucide:radio" width={16} className="text-primary" />
                          <span className="text-sm">Total</span>
                        </div>
                        <span className="font-semibold">{stats?.claimed ?? 0}</span>
                      </div>
                    </DropdownItem>
                    <DropdownItem key="live" textValue="Live Sensors">
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                          <Icon icon="lucide:wifi" width={16} className="text-success" />
                          <span className="text-sm">Live</span>
                        </div>
                        <span className="font-semibold text-success">{stats?.liveSensors ?? 0}</span>
                      </div>
                    </DropdownItem>
                    <DropdownItem key="offline" textValue="Offline Sensors">
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                          <Icon icon="lucide:wifi-off" width={16} className="text-danger" />
                          <span className="text-sm">Offline</span>
                        </div>
                        <span className="font-semibold text-danger">{stats?.offlineSensors ?? 0}</span>
                      </div>
                    </DropdownItem>
                    <DropdownItem key="battery" textValue="Low Battery">
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-2">
                          <Icon icon="lucide:battery-warning" width={16} className="text-red-500" />
                          <span className="text-sm">Low Battery</span>
                        </div>
                        <span className="font-semibold text-red-500">{stats?.lowBatterySensors ?? 0}</span>
                      </div>
                    </DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>

              <div className="flex items-center gap-1">
                {isLiveMode && (
                  <Button
                    size="md"
                    variant="flat"
                    color="secondary"
                    onPress={handleSendTestCommand}
                    isIconOnly={isShortHeight}
                    className={`${isShortHeight ? "w-10 h-10" : "h-12"}`}
                  >
                    <Icon icon="lucide:send" />
                    {!isShortHeight && <span className="ml-1 text-sm">Test</span>}
                  </Button>
                )}
                <Button
                  color="primary"
                  size="sm"
                  onPress={() => dispatch(setClaimModalOpen(true))}
                  isIconOnly={isShortHeight}
                  className={`${isShortHeight ? "w-10 h-10" : "h-12"}`}
                >
                  <Icon icon="lucide:plus" />
                  {!isShortHeight && <span className="ml-1 text-sm">Add</span>}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Desktop: Standard header layout
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-semibold text-foreground">Sensors</h1>
              <div className="flex items-center gap-2">
                {isLiveMode && (
                  <Button
                    size="sm"
                    variant="flat"
                    color="secondary"
                    onPress={handleSendTestCommand}
                    startContent={<Icon icon="lucide:send" />}
                  >
                    Test
                  </Button>
                )}
                <Button
                  color="primary"
                  onPress={() => dispatch(setClaimModalOpen(true))}
                  startContent={<Icon icon="lucide:plus" />}
                >
                  Add Sensor
                </Button>
              </div>
            </div>

            {/* Desktop stats grid */}
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
              <StatsCard
                title="Total Sensors"
                value={(stats?.claimed ?? 0).toString()}
                icon="lucide:radio"
                color="primary"
              />
              <StatsCard
                title="Live Sensors"
                value={(stats?.liveSensors ?? 0).toString()}
                icon="lucide:wifi"
                color="success"
              />
              <StatsCard
                title="Offline Sensors"
                value={(stats?.offlineSensors ?? 0).toString()}
                icon="lucide:wifi-off"
                color="danger"
              />
              <StatsCard
                title="Low Battery"
                value={(stats?.lowBatterySensors ?? 0).toString()}
                icon="lucide:battery-warning"
                color="danger"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area - Mobile First Responsive Layout */}
      <div className="flex flex-1 overflow-hidden">
        {!isSoloMode && !isMobile && (
          <div className="w-80 border-r border-divider flex flex-col">
            <div className="p-3 border-b border-divider flex justify-between items-center">
              {/* <h3 className="text-sm font-medium">My Sensors</h3> */}
              <FilterBar filters={filters} onFiltersChange={handleFiltersChange} isMobile={false} />
              {!isLiveMode && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={isCompareMode ? "solid" : "flat"}
                    color={isCompareMode ? "primary" : "default"}
                    onPress={toggleCompareMode}
                    startContent={<Icon icon="lucide:bar-chart-2" width={16} />}
                  >
                    {isCompareMode ? "Comparing" : "Compare"}
                  </Button>
                </div>
              )}
            </div>

            <SensorList
              sensors={filteredSensors}
              selectedSensorIds={selectedSensorIds}
              currentSelectedSensor={selectedSensor} // Pass current selected sensor
              onSensorSelect={handleSensorSelect}
              onSensorToggleStar={handleToggleStar}
              onSearch={handleSearchChange}
              searchText={searchQuery || ""}
              onMultiSelect={handleMultiSelect}
              isComparing={isCompareMode}
              onSensorUpdated={refreshSensorData}
              isDataLoading={enhancedEffectiveIsLoading && !isCompareMode} // Only show for single sensor mode, include live data waiting and initial loading
              isSensorLoading={isSensorLoading} // Pass individual sensor loading state
              isCompareLoading={isCompareLoading} // Pass compare loading state
              shouldShowComparison={shouldShowComparison} // Pass comparison check
            />
            {pagination.page < pagination.totalPages && (
              <div className="p-2 border-t border-divider">
                <Button
                  fullWidth
                  variant="flat"
                  isDisabled={loading}
                  onPress={handleLoadMore}
                  startContent={loading ? <Spinner size="sm" /> : <Icon icon="lucide:refresh-ccw" />}
                >
                  {loading ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Chart Area Container - Mobile First Design with Proper Heights */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile Controls Bar - Hidden on mobile landscape short, replaced with floating controls */}
          {isMobile && !isSoloMode && !(isCompareMode && selectedSensorIds.length === 0) && (
            <div className={`shrink-0 border-b border-divider bg-content1 px-8 py-2`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setIsMobileSensorDrawerOpen(true)}
                    isIconOnly
                    className="w-10 h-10 min-w-10 bg-content1/95 backdrop-blur-md border border-divider shadow-sm"
                  >
                    <Icon icon="lucide:list" width={20} />
                  </Button>

                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => {
                      setPendingFilters({ ...filters });
                      const idx = timeRangePresets.findIndex((p) => {
                        const presetRange = p.getValue();
                        return sameRange(presetRange, filters.timeRange);
                      });
                      setSelectedTimeRangeIndex(idx === -1 ? timeRangePresets.length - 1 : idx);
                      setIsMobileFilterDrawerOpen(true);
                    }}
                    isIconOnly
                    className="w-10 h-10 min-w-10 bg-content1/95 backdrop-blur-md border border-divider shadow-sm"
                  >
                    <Icon icon="lucide:filter" width={20} />
                  </Button>
                </div>

                {/* Current sensor indicator */}
                {selectedSensor && currentSensor && (
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 mx-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${currentSensor.isOnline ? "bg-success" : "bg-danger"}`}
                    />
                    <span className={`${isShortHeight ? "text-xs" : "text-sm"} font-medium truncate`}>
                      {currentSensor.displayName || currentSensor.mac}
                    </span>
                  </div>
                )}

                {/* Compare mode toggle */}
                {!isLiveMode && !isMobile && (
                  <Button
                    size="sm"
                    color={isCompareMode ? "primary" : "default"}
                    variant={isCompareMode ? "solid" : "flat"}
                    onPress={toggleCompareMode}
                    isIconOnly={isShortHeight}
                    className={isShortHeight ? "w-8 h-8 min-w-8" : "h-9"}
                  >
                    <Icon icon="lucide:bar-chart-2" width={16} />
                    {!isShortHeight && (
                      <span className="ml-1 text-sm">
                        {isCompareMode ? `Compare (${selectedSensorIds.length})` : "Compare"}
                      </span>
                    )}
                  </Button>
                )}
              </div>

              {/* Active filters display - only show on mobile portrait or when not short height */}
              {!isShortHeight &&
                !isLandscape &&
                (filters.types.length > 0 || filters.status !== "all" || filters.search) && (
                  <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
                    {filters.search && (
                      <div className="px-2 py-1 bg-default-100 text-default-700 rounded-full text-xs flex items-center gap-1 shrink-0">
                        <Icon icon="lucide:search" width={10} />
                        <span className="truncate max-w-[80px]">{filters.search}</span>
                      </div>
                    )}
                    {filters.types.length > 0 && (
                      <div className="px-2 py-1 bg-primary-100 text-primary rounded-full text-xs flex items-center gap-1 shrink-0">
                        <Icon icon="lucide:tag" width={10} />
                        <span>{filters.types.length === 1 ? filters.types[0] : `${filters.types.length} types`}</span>
                      </div>
                    )}
                    {filters.status !== "all" && (
                      <div className="px-2 py-1 bg-primary-100 text-primary rounded-full text-xs flex items-center gap-1 shrink-0">
                        <Icon icon={filters.status === "live" ? "lucide:wifi" : "lucide:wifi-off"} width={10} />
                        <span>{filters.status}</span>
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}

          {/* Chart Container - Responsive Design with Explicit Heights */}
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            {/* Chart content with dynamic height calculation */}
            <div className="flex-1" style={getChartContainerStyle()}>
              <div className={`w-full h-full flex flex-col`}>
                {/* Chart Content with enhanced device-specific handling and explicit heights */}
                {(() => {
                  // Regular rendering logic for all other devices
                  return isCompareMode ? (
                    shouldShowComparison(selectedSensorIds.length) && multiSeriesConfig ? (
                      <div className="w-full h-full">
                        <ComparisonChart
                          config={multiSeriesConfig}
                          isLoading={isCompareLoading}
                          onDownloadCSV={handleDownloadCSV}
                          onRemoveSensor={removeSensorFromComparison}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-3" width={isMobile ? 32 : 48} />
                        <h3 className={`${isMobile ? "text-base" : "text-xl"} font-medium mb-2`}>Compare Sensors</h3>
                        <p className="text-default-500 text-sm mb-4 max-w-sm">
                          {selectedSensorIds.length === 0
                            ? "Select sensors from the list to compare their data."
                            : `Select ${minSensorsForFetch - selectedSensorIds.length} more sensor${minSensorsForFetch - selectedSensorIds.length === 1 ? "" : "s"} to start comparison.`}
                        </p>
                        {isMobile && (
                          <Button
                            color="primary"
                            onPress={() => setIsMobileSensorDrawerOpen(true)}
                            startContent={<Icon icon="lucide:list" width={16} />}
                            size="sm"
                          >
                            Select Sensors
                          </Button>
                        )}
                      </div>
                    )
                  ) : enhancedEffectiveIsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      {(() => {
                        console.log("[Analytics] 🔄 Loading state render decision:", {
                          enhancedEffectiveIsLoading,
                          originalEffectiveIsLoading: effectiveIsLoading,
                          isInitiallyLoading,
                          shouldWaitForLiveData: liveDataReadiness.shouldWaitForLiveData,
                          hasCurrentSensor: !!currentSensor,
                          sensorName: currentSensor?.displayName || currentSensor?.name || currentSensor?.mac,
                          timestamp: new Date().toISOString(),
                        });

                        if (isLiveMode && liveDataReadiness.shouldWaitForLiveData) {
                          console.log("[Analytics] 🎭 Rendering LiveDataLoading component");
                          return (
                            <LiveDataLoading
                              sensorName={currentSensor?.displayName || currentSensor?.name || currentSensor?.mac}
                            />
                          );
                        } else {
                          console.log("[Analytics] 🌀 Rendering regular Spinner");
                          return <Spinner size={isMobile ? "md" : "lg"} />;
                        }
                      })()}
                    </div>
                  ) : chartConfig && currentSensor ? (
                    <div className="relative w-full h-full">
                      {(() => {
                        console.log("[Analytics] 📊 Chart rendering decision:", {
                          hasChartConfig: !!chartConfig,
                          hasCurrentSensor: !!currentSensor,
                          effectiveIsLoading,
                          sensorId: currentSensor?._id,
                          chartType: chartConfig?.type,
                          seriesLength: chartConfig?.series?.length,
                          timestamp: new Date().toISOString(),
                        });
                        return null; // Just for logging, return null
                      })()}

                      {/* Main chart view - ensure proper height */}
                      <div
                        className={`w-full h-full transition-transform duration-300 ${
                          isMobile && isSwipingToGauge ? "transform -translate-x-full" : ""
                        }`}
                      >
                        <ChartContainer
                          config={chartConfig}
                          onBrushChange={handleBrushChange}
                          onDownloadCSV={handleDownloadCSV}
                          sensor={{
                            id: currentSensor._id,
                            mac: currentSensor.mac,
                            displayName: currentSensor.displayName,
                            isOnline: currentSensor.isOnline,
                            status: currentSensor.status,
                          }}
                          onToggleStar={handleToggleStar}
                          onDisplayNameChange={handleDisplayNameChange}
                          onOpenInNewTab={!isSoloMode ? handleOpenInNewTab : undefined}
                          isLoading={(() => {
                            console.log("[Analytics] 📊 ChartContainer isLoading prop:", {
                              effectiveIsLoading,
                              isLoadingData,
                              hookShouldShowLoading: liveDataReadiness.shouldShowLoading,
                              sensorId: currentSensor._id,
                              timestamp: new Date().toISOString(),
                            });
                            return effectiveIsLoading;
                          })()}
                          timeRange={filters.timeRange}
                          onTimeRangeChange={syncTimeRange}
                          onLiveModeChange={syncLiveMode}
                          showTimeRangeApplyButtons={true}
                          isMobileView={isMobile}
                          isLiveMode={isLiveMode}
                          liveStatus={isConnecting ? "connecting" : isLiveMode ? "connected" : "disconnected"}
                        />
                      </div>

                      {/* {isMobile && chartConfig && (chartConfig.type as any) !== "gauge" && (
                        <div
                          className={`absolute inset-0 w-full h-full transition-transform duration-300 bg-content1 p-6${
                            isSwipingToGauge ? "transform translate-x-0 p-6" : "transform translate-x-full p-6"
                          }`}
                        >
                          <div className="w-full h-full flex flex-col">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className={`${isShortHeight ? "text-sm" : "text-base"} font-medium`}>Gauge View</h3>
                              <Button
                                size="sm"
                                variant="light"
                                onPress={() => setIsSwipingToGauge(false)}
                                startContent={<Icon icon="lucide:chevron-left" width={16} />}
                              >
                                {isShortHeight ? "" : "Back"}
                              </Button>
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                              <div
                                className={`${
                                  isShortHeight ? "w-32 h-32" : isMobile && isLandscape ? "w-40 h-40" : "w-48 h-48"
                                }`}
                              >
                                <GaugeChart config={chartConfig} size="lg" />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      {isMobile && (chartConfig.type as any) !== "gauge" && !isSwipingToGauge && (
                        <div className={`absolute ${isMobileLandscapeShort ? "bottom-2 left-2" : "bottom-4 right-4"}`}>
                          <Button
                            size="sm"
                            variant="flat"
                            onPress={() => setIsSwipingToGauge(true)}
                            isIconOnly={isMobileLandscapeShort}
                            className={`bg-content1/95 backdrop-blur-md border border-divider shadow-lg ${
                              isMobileLandscapeShort ? "w-10 h-10 min-w-10" : ""
                            }`}
                          >
                            <Icon icon="lucide:gauge" width={isMobileLandscapeShort ? 20 : 16} />
                            {!isMobileLandscapeShort && <span className="ml-1">Gauge</span>}
                          </Button>
                        </div>
                      )} */}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      {(() => {
                        // Check if we're in an initial loading state where sensors are loading or just finished loading
                        // but no sensor has been auto-selected yet
                        const isInitialLoadingState =
                          loading || (sensors.length > 0 && !currentSensor && !hasInitialLoadCompleted);

                        console.log("[Analytics] 🎯 Final fallback decision:", {
                          isInitialLoadingState,
                          loading,
                          sensorsLength: sensors.length,
                          hasCurrentSensor: !!currentSensor,
                          hasInitialLoadCompleted,
                          shouldShowSpinner: isInitialLoadingState,
                          timestamp: new Date().toISOString(),
                        });

                        if (isInitialLoadingState) {
                          return <Spinner size={isMobile ? "md" : "lg"} />;
                        } else {
                          return <Spinner size={isMobile ? "md" : "lg"} />;
                          return <p className="text-default-500 text-sm">Select a sensor to view data</p>;
                        }
                      })()}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Desktop Compare Tray */}
          {!isSoloMode && !isMobile && selectedSensorIds.length > 0 && isCompareMode && (
            <div className="shrink-0">
              <CompareTray
                selectedSensors={selectedSensorsForCompare}
                onRemoveSensor={handleRemoveCompare}
                onClearAll={handleClearCompare}
                isExpanded={isCompareExpanded}
                onToggleExpand={() => setIsCompareExpanded(!isCompareExpanded)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Compare Sheet */}
      {isMobile && isMobileCompareSheetOpen && (
        <div
          className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50"
          onClick={() => setIsMobileCompareSheetOpen(false)}
        >
          <div className="bg-content1 p-4 rounded-lg w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Compare Sensors</h3>
              <Button isIconOnly size="sm" variant="light" onPress={() => setIsMobileCompareSheetOpen(false)}>
                <Icon icon="lucide:x" width={16} />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {selectedSensorsForCompare.map((sensor) => (
                <div key={sensor._id} className="flex items-center gap-2 p-2 border border-divider rounded-lg">
                  <div className={`w-2 h-2 rounded-full ${sensor.isOnline ? "bg-success" : "bg-danger"}`} />
                  <span className="text-sm">{sensor.displayName || sensor.mac}</span>
                  <Button isIconOnly size="sm" variant="light" onPress={() => handleRemoveCompare(sensor._id)}>
                    <Icon icon="lucide:x" width={14} />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button size="sm" variant="flat" color="danger" onPress={handleClearCompare}>
                Clear All
              </Button>

              <Button
                size="sm"
                color="primary"
                onPress={() => {
                  setIsCompareExpanded(true);
                  setIsMobileCompareSheetOpen(false);
                }}
              >
                View Comparison
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sensor Drawer */}
      {isMobile && (
        <div
          className={`fixed inset-0 bg-overlay/50 z-50 transition-opacity ${isMobileSensorDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setIsMobileSensorDrawerOpen(false)}
        >
          <div
            className={`absolute bottom-0 left-0 right-0 h-3/4 bg-content1 shadow-lg transition-transform rounded-t-xl ${isMobileSensorDrawerOpen ? "translate-y-0" : "translate-y-full"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-divider flex justify-between items-center">
                <h3 className="text-lg font-medium">Sensors</h3>
                <div className="flex items-center gap-2">
                  {isCompareMode && (
                    <Button size="sm" color="primary" variant="flat">
                      <span className="flex items-center gap-1">
                        <Icon icon="lucide:check" width={16} />
                        {selectedSensorIds.length} Selected
                      </span>
                    </Button>
                  )}
                  <Button isIconOnly size="sm" variant="light" onPress={() => setIsMobileSensorDrawerOpen(false)}>
                    <Icon icon="lucide:x" width={16} />
                  </Button>
                </div>
              </div>

              <div className="p-4 border-b border-divider">
                <Input
                  placeholder="Search by MAC or display name"
                  value={searchQuery}
                  onValueChange={handleSearchChange}
                  startContent={<Icon icon="lucide:search" className="text-default-400" />}
                  isClearable
                  size="sm"
                />
              </div>

              <div className="flex-1 overflow-y-auto">
                {filteredSensors.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                    <Icon icon="lucide:wifi-off" className="text-default-300 mb-2" width={32} height={32} />
                    <p className="text-default-500">No sensors match your filters</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {filteredSensors.map((sensor) => (
                      <SensorCard
                        key={sensor._id}
                        sensor={sensor}
                        isSelected={
                          isCompareMode ? selectedSensorIds.includes(sensor._id) : selectedSensor === sensor._id
                        }
                        onSelect={() => {
                          if (isCompareMode) {
                            // In compare mode, toggle selection
                            if (selectedSensorIds.includes(sensor._id)) {
                              dispatch(removeSelectedSensorId(sensor._id));
                            } else {
                              dispatch(addSelectedSensorId(sensor._id));
                            }
                          } else {
                            // In normal mode, select sensor and close drawer
                            handleSensorSelect(sensor._id);
                            setIsMobileSensorDrawerOpen(false);
                          }
                        }}
                        onToggleStar={() => {
                          dispatch(toggleSensorStar(sensor._id));
                          // Show toast confirmation
                          addToast({
                            title: sensor.favorite ? "Removed from favorites" : "Added to favorites",
                            description: `Sensor ${sensor.mac} ${sensor.favorite ? "removed from" : "added to"} favorites`,
                          });
                        }}
                        isComparing={isCompareMode}
                        isChecked={selectedSensorIds.includes(sensor._id)}
                        onCheckChange={(checked) => {
                          if (checked) {
                            dispatch(addSelectedSensorId(sensor._id));
                          } else {
                            dispatch(removeSelectedSensorId(sensor._id));
                          }
                        }}
                        onSensorUpdated={refreshSensorData}
                      />
                    ))}
                  </div>
                )}
              </div>

              {isCompareMode && selectedSensorIds.length > 0 && (
                <div className="p-3 border-t border-divider">
                  <Button
                    color="primary"
                    fullWidth
                    onPress={() => {
                      setIsMobileSensorDrawerOpen(false);
                    }}
                  >
                    Compare {selectedSensorIds.length} Sensors
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filter Drawer */}
      {isMobile && (
        <div
          className={`fixed inset-0 bg-overlay/50 z-50 transition-opacity ${isMobileFilterDrawerOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setIsMobileFilterDrawerOpen(false)}
        >
          <div
            className={`absolute bottom-0 left-0 right-0 h-3/4 bg-content1 shadow-lg transition-transform rounded-t-xl ${isMobileFilterDrawerOpen ? "translate-y-0" : "translate-y-full"}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-divider flex justify-between items-center">
                <h3 className="text-lg font-medium">Filters</h3>
                <Button isIconOnly size="sm" variant="light" onPress={() => setIsMobileFilterDrawerOpen(false)}>
                  <Icon icon="lucide:x" width={16} />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                  {/* Sensor Type Filter */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Sensor Type</h4>
                    <CheckboxGroup
                      value={(pendingFilters || filters).types as string[]}
                      onValueChange={(types) => handleMobileTypeChange(types as SensorType[])}
                      orientation="vertical"
                    >
                      {sensorTypes.map((type) => (
                        <Checkbox key={type.value} value={type.value as string}>
                          {type.label}
                        </Checkbox>
                      ))}
                    </CheckboxGroup>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Status</h4>
                    <div className="flex flex-col gap-2">
                      {statusOptions.map((status) => (
                        <Button
                          key={status.value}
                          variant={(pendingFilters || filters).status === status.value ? "solid" : "bordered"}
                          color={(pendingFilters || filters).status === status.value ? "primary" : "default"}
                          size="sm"
                          onPress={() => handleMobileStatusChange(status.value)}
                          className="justify-start"
                          startContent={
                            status.value === "live" ? (
                              <Icon icon="lucide:wifi" width={16} />
                            ) : status.value === "offline" ? (
                              <Icon icon="lucide:wifi-off" width={16} />
                            ) : (
                              <Icon icon="lucide:layers" width={16} />
                            )
                          }
                        >
                          {status.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Time Range Filter */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Time Range</h4>
                    <div className="flex flex-col gap-2">
                      {timeRangePresets.map((preset, index) => (
                        <Button
                          key={index}
                          variant={selectedTimeRangeIndex === index ? "solid" : "bordered"}
                          color={selectedTimeRangeIndex === index ? "primary" : "default"}
                          size="sm"
                          onPress={() => handleMobileTimeRangeChange(index)}
                          className="justify-start"
                          startContent={<Icon icon="lucide:calendar" width={16} />}
                        >
                          {preset.label}
                        </Button>
                      ))}
                      {selectedTimeRangeIndex === timeRangePresets.length - 1 && (
                        <div className="mt-3">
                          <DateRangePicker
                            aria-label="Custom range"
                            showMonthAndYearPickers
                            value={{
                              start: toCal((pendingFilters || filters).timeRange.start),
                              end: toCal((pendingFilters || filters).timeRange.end),
                            }}
                            onChange={(range: RangeValue<DateValue> | null) => {
                              // ignore the intermediate "only start picked" state
                              if (!range || !range.start || !range.end) return;

                              const startJs = range.start.toDate(getLocalTimeZone());
                              const endJs = range.end.toDate(getLocalTimeZone());

                              console.log("[Analytics] Mobile date range selected:", {
                                start: startJs,
                                end: endJs,
                                startISO: startJs.toISOString(),
                                endISO: endJs.toISOString(),
                              });

                              if (isMobile) {
                                setPendingFilters((prev) => ({
                                  ...(prev || filters),
                                  timeRange: { start: startJs, end: endJs },
                                }));
                              } else {
                                dispatch(setTimeRange({ start: startJs, end: endJs }));
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sort Filter (missing before) */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">Sort By</h4>
                    {[
                      { lbl: "Name (A-Z)", fld: "displayName", dir: "asc", ic: "lucide:arrow-up" },
                      { lbl: "Name (Z-A)", fld: "displayName", dir: "desc", ic: "lucide:arrow-down" },
                      { lbl: "Starred First", fld: "favorite", dir: "desc", ic: "lucide:star" },
                      { lbl: "Battery Level", fld: "battery", dir: "asc", ic: "lucide:battery" },
                      { lbl: "Last Seen", fld: "lastSeen", dir: "desc", ic: "lucide:clock" },
                    ].map((o) => (
                      <Button
                        key={o.lbl}
                        size="sm"
                        variant={
                          (pendingFilters || filters).sort?.field === o.fld &&
                          (pendingFilters || filters).sort?.direction === o.dir
                            ? "solid"
                            : "bordered"
                        }
                        color={
                          (pendingFilters || filters).sort?.field === o.fld &&
                          (pendingFilters || filters).sort?.direction === o.dir
                            ? "primary"
                            : "default"
                        }
                        className="justify-start mb-1"
                        startContent={<Icon icon={o.ic} width={16} />}
                        onPress={() => handleMobileSortChange(o.fld, o.dir as "asc" | "desc")}
                      >
                        {o.lbl}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-divider">
                <Button color="primary" fullWidth onPress={applyPendingFilters}>
                  Apply Filters
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ClaimSensorModal
        isOpen={claimModalOpen}
        onClose={() => dispatch(setClaimModalOpen(false))}
        onSensorClaimed={() => {
          dispatch(
            fetchSensors({
              page: pagination.page,
              limit: pagination.limit,
              claimed: true,
              search: filters.search || "",
              sort: filters.sort?.field,
              dir: filters.sort?.direction,
            })
          );
          dispatch(fetchSensorStats());
        }}
        gateways={gateways ?? []}
      />
    </div>
  );
};
