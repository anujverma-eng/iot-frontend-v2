import { addToast, Button, Checkbox, CheckboxGroup, DateRangePicker, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, Input, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { CalendarDate, DateValue, getLocalTimeZone } from "@internationalized/date";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
  selectLiveSensors
} from "../store/telemetrySlice";
import { selectIsLiveMode, selectIsConnecting, toggleLiveMode } from "../store/liveDataSlice";
import { useDebouncedSensorSelection } from "../hooks/useDebouncedSensorSelection";
import { useOptimizedDataFetch } from "../hooks/useOptimizedDataFetch";
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
  const navigate = useNavigate();
  const { sensorId } = useParams<AnalyticsParams>();
  const location = useLocation();
  const isSoloMode = new URLSearchParams(location.search).get("solo") === "true";

  // Use responsive breakpoints
  const { isMobile, isSmallScreen, isLandscape } = useBreakpoints();

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

  const stats = useSelector(selectEnhancedSensorStats); // Use enhanced stats with battery count
  const [pendingFilters, setPendingFilters] = React.useState<FilterState | null>(null);

  // DEBUG: Log when sensors or stats change
  React.useEffect(() => {
    console.log(`[Analytics] DEBUG: Sensors data changed, count: ${sensors.length}`);
    sensors.forEach(sensor => {
      console.log(`[Analytics] DEBUG: Sensor ${sensor.mac} - status: ${sensor.status}, isOnline: ${sensor.isOnline}`);
    });
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
      list = list.filter((s) => 
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
        if(field === "starred" || field === "favorite") {
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
          const av = typeof a[field] === 'number' ? a[field] : -1;
          const bv = typeof b[field] === 'number' ? b[field] : -1;
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
  React.useEffect(() => {
    console.log('[Analytics] URL sensor effect triggered with:', { sensorId, selectedSensor, filteredSensorsLength: filteredSensors?.length });
    
    if (sensorId) {
      console.log('[Analytics] Setting sensor from URL parameter:', sensorId);
      dispatch(fetchSensorById(sensorId));
      setSelectedSensor(sensorId);
    } else if (filteredSensors && filteredSensors.length > 0 && !selectedSensor) {
      // Add null check for filteredSensors before accessing length
      const firstSensorId = filteredSensors[0].id;
      console.log('[Analytics] Auto-selecting first sensor:', firstSensorId);
      dispatch(fetchSensorById(firstSensorId));
      setSelectedSensor(firstSensorId);
      navigate(`/dashboard/sensors/${firstSensorId}`, { replace: true });
    }
  }, [sensorId, filteredSensors, selectedSensor, dispatch, navigate]);

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
    minSensorsForFetch
  } = useCompareSelection({
    timeRange: {
      start: toISO(filters.timeRange.start),
      end: toISO(filters.timeRange.end)
    },
    maxSensors: 10,
    minSensorsForFetch: 2 // Only start loading when 2+ sensors selected
  });

  // Stringify time range for reliable dependency comparison
  const timeRangeKey = React.useMemo(() => {
    return `${filters.timeRange.start.getTime()}-${filters.timeRange.end.getTime()}`;
  }, [filters.timeRange]);

  // Add a ref to track the most recent time range request
  const lastTimeRangeRequestRef = React.useRef<string>("");

  // Optimized telemetry fetching with debouncing and cancellation
  React.useEffect(() => {
    if (selectedSensor) {
      // Create a request ID based on current parameters
      const currentRequest = `${selectedSensor}-${timeRangeKey}`;
      
      // Don't make duplicate requests
      if (lastTimeRangeRequestRef.current === currentRequest) {
        return;
      }
      
      lastTimeRangeRequestRef.current = currentRequest;

      // Ensure end time is set to end of day
      const adjustedTimeRange = {
        start: new Date(filters.timeRange.start),
        end: new Date(filters.timeRange.end),
      };
      adjustedTimeRange.end.setHours(23, 59, 59, 999);

      console.log('[Analytics] Effect triggered - Fetching telemetry with time range:', {
        start: adjustedTimeRange.start.toISOString(),
        end: adjustedTimeRange.end.toISOString(),
      });

      // Use optimized data fetching
      fetchOptimizedData({
        sensorIds: [selectedSensor],
        timeRange: {
          start: toISO(adjustedTimeRange.start),
          end: toISO(adjustedTimeRange.end),
        },
      });
    }
  }, [selectedSensor, timeRangeKey, fetchOptimizedData]); // Use optimized fetch

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
  }, [selectedSensorIds, filters.timeRange, fetchOptimizedData]);

  // Add cleanup effect
  React.useEffect(() => {
    return () => {
      // Cancel any pending requests when component unmounts
      cancelPendingRequests();
    };
  }, [cancelPendingRequests]);

  const handleSensorSelect = (id: string) => {
    // Cancel any pending data requests for the previous sensor
    cancelPendingRequests();
    
    setSelectedSensor(id);
    navigate(`/dashboard/sensors/${id}`);
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

      console.log('[Analytics] Fetching telemetry with time range:', {
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
    const addedSensors = ids.filter(id => !currentIds.has(id));
    const removedSensors = selectedSensorIds.filter(id => !newIds.has(id));
    
    // Handle additions
    addedSensors.forEach(id => {
      if (canAddMoreSensors(ids.length)) {
        addSensorToComparison(id);
      }
    });
    
    // Handle removals
    removedSensors.forEach(id => {
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
      
      chartConfig.series.forEach(dataPoint => {
        const timestamp = new Date(dataPoint.timestamp).toISOString();
        csvContent += `${timestamp},${dataPoint.value}\n`;
      });

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const currentSensorData = sensors.find(s => s._id === selectedSensor);
      const filename = currentSensorData ? 
        `${currentSensorData.displayName || currentSensorData.mac}_data.csv` : 
        `sensor_data_${new Date().toISOString().split('T')[0]}.csv`;
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
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
      const activeGateway = gateways.find(gateway => gateway.status === 'active');
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
      console.error('[Analytics] Test command error:', error);
      addToast({
        title: "Command Error",
        description: error instanceof Error ? error.message : "Failed to send test command",
      });
    }
  };

  // Prepare chart config for selected sensor
  const chartConfig: ChartConfig | null = React.useMemo(() => {
    if (!selectedSensor || !telemetryData[selectedSensor]) return null;
    const sensorData = telemetryData[selectedSensor];
    
    // Enhanced debugging for live data
    const currentSeries = sensorData.series;
    console.log('[Analytics] Chart data content:', {
      sensorId: selectedSensor,
      dataPoints: currentSeries.length,
      firstPoint: currentSeries[0],
      lastPoint: currentSeries[currentSeries.length - 1],
      nonNullCount: currentSeries.filter((point) => point && point.value !== null && point.value !== undefined).length,
      lastFivePoints: currentSeries.slice(-5),
      timestamps: currentSeries.slice(-3).map(p => p.timestamp),
      values: currentSeries.slice(-3).map(p => p.value),
      seriesReference: currentSeries // Log reference to help debug mutations
    });
    
    console.log(`[Analytics] Rendering with series length: ${currentSeries.length}. Last point:`, currentSeries[currentSeries.length - 1]);

    return {
      type: sensorData.type,
      unit: sensorData.unit,
      series: sensorData.series, // Pass series directly - array reference will change on updates
      color: chartColors[0],
    };
  }, [
    selectedSensor, 
    // Depend on the series array reference itself - will change when Redux creates new array
    selectedSensor ? telemetryData[selectedSensor]?.series : null,
    isLiveMode // Track live mode changes
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
        return {
          id,
          name: sensor?.displayName || sensor?.mac || id,
          color: chartColors[index % chartColors.length],
          data: telemetryData[id].series,
        };
      }),
    };
  }, [
    telemetryData, 
    selectedSensorIds, 
    sensors,
    // In live mode, track data changes for selected sensors
    isLiveMode ? selectedSensorIds.map(id => 
      telemetryData[id] ? telemetryData[id].series.length : 0
    ).join(',') : null
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
    <div className="flex flex-col h-screen m-0 p-0">
      {/* ─────────────────────────  small header & cards  ───────────────────────── */}
      <div className="px-6 pt-4 space-y-6">
        {/* header row */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Sensors</h1>

          <div className="flex items-center gap-2">
            {/* Test command button - only show when live mode is active */}
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

        {/* stats section - responsive design */}
        {isSmallScreen ? (
          // Mobile compact stats - dropdown style
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
        ) : (
          // Desktop stats grid
          <div className="px-4">
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
                title="Low Battery Sensors"
                value={(stats?.lowBatterySensors ?? 0).toString()}
                icon="lucide:battery-warning"
                color="danger"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {!isSoloMode && !isMobile && (
          <div className="w-80 border-r border-divider flex flex-col">
            <div className="p-3 border-b border-divider flex justify-between items-center">
              {/* <h3 className="text-sm font-medium">My Sensors</h3> */}
              <FilterBar
                filters={filters}
                onFiltersChange={handleFiltersChange}
                isMobile={false}
              />
              <div className="flex items-center gap-2">
                {/* Live mode switch removed - now controlled via navbar and time-range-selector only */}
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
              isDataLoading={isLoadingData && !isCompareMode} // Only show for single sensor mode
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

        <div className="flex-1 flex flex-col overflow-hidden">
          {isMobile && !isSoloMode && (
            <div className="p-3 border-b border-divider">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Icon icon="lucide:list" width={16} />}
                    onPress={() => setIsMobileSensorDrawerOpen(true)}
                  >
                    Sensors
                  </Button>

                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<Icon icon="lucide:filter" width={16} />}
                    onPress={() => {
                      setPendingFilters({ ...filters });
                      const idx = timeRangePresets.findIndex((p) => {
                        const presetRange = p.getValue();
                        return sameRange(presetRange, filters.timeRange);
                      });
                      setSelectedTimeRangeIndex(idx === -1 ? timeRangePresets.length - 1 : idx);
                      setIsMobileFilterDrawerOpen(true);
                    }}
                  >
                    Filters
                  </Button>
                </div>

                {selectedSensor && currentSensor && (
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${currentSensor.isOnline ? "bg-success" : "bg-danger"}`}
                    />
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      {currentSensor.displayName || currentSensor.mac}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {/* Live mode switch removed - now controlled via navbar and time-range-selector only */}
                  <Button
                    size="sm"
                    color={isCompareMode ? "primary" : "default"}
                    variant={isCompareMode ? "solid" : "flat"}
                    startContent={<Icon icon="lucide:bar-chart-2" width={16} />}
                    onPress={toggleCompareMode}
                  >
                    {isCompareMode ? <>Compare ({selectedSensorIds.length})</> : "Compare"}
                  </Button>
                </div>
              </div>

              {/* Active filters display */}
              {(filters.types.length > 0 || filters.status !== "all" || filters.search) && (
                <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                  {filters.search && (
                    <div className="px-3 py-1 bg-default-100 text-default-700 rounded-full text-xs flex items-center gap-1">
                      <Icon icon="lucide:search" width={12} />
                      {filters.search}
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="p-0 ml-1 h-4 w-4 min-w-0"
                        onPress={() => handleSearchChange("")}
                      >
                        <Icon icon="lucide:x" width={10} />
                      </Button>
                    </div>
                  )}

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
                    {new Date(filters.timeRange.start).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    -{new Date(filters.timeRange.end).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 p-4 overflow-auto">
            {isCompareMode ? (
              shouldShowComparison(selectedSensorIds.length) && multiSeriesConfig ? (
                <ComparisonChart
                  config={multiSeriesConfig}
                  isLoading={isCompareLoading}
                  onDownloadCSV={handleDownloadCSV}
                  onRemoveSensor={removeSensorFromComparison}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-4" width={48} height={48} />
                  <h3 className="text-xl font-medium mb-2">Compare Sensors</h3>
                  <p className="text-default-500 mb-6 max-w-md">
                    {selectedSensorIds.length === 0 
                      ? "Select sensors from the list to compare their data."
                      : selectedSensorIds.length === 1
                      ? `Select ${minSensorsForFetch - selectedSensorIds.length} more sensor to start comparison.`
                      : `Select ${minSensorsForFetch - selectedSensorIds.length} more sensors to start comparison.`
                    }
                  </p>
                  {selectedSensorIds.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-default-400">
                        {selectedSensorIds.length} of {minSensorsForFetch} sensors selected
                      </p>
                    </div>
                  )}
                  {isMobile && (
                    <Button
                      color="primary"
                      onPress={() => setIsMobileSensorDrawerOpen(true)}
                      startContent={<Icon icon="lucide:list" width={16} />}
                    >
                      Select Sensors
                    </Button>
                  )}
                </div>
              )
            ) : isLoadingData ? (
              <div className="flex items-center justify-center h-full">
                <Spinner />
              </div>
            ) : chartConfig && currentSensor ? (
              <div className={`h-full ${isMobile ? "relative overflow-hidden" : ""}`}>
                {/* Main chart view */}
                <div
                  className={`h-full ${isMobile && isSwipingToGauge ? "translate-x-[-100%]" : ""} transition-transform duration-300`}
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
                    isLoading={isLoadingData}
                    timeRange={filters.timeRange}
                    onTimeRangeChange={syncTimeRange}
                    onLiveModeChange={syncLiveMode}
                    showTimeRangeApplyButtons={true}
                    isMobileView={isMobile}
                    isLiveMode={isLiveMode}
                    liveStatus={isConnecting ? "connecting" : isLiveMode ? "connected" : "disconnected"}
                  />
                </div>

                {/* Mobile gauge view (swipe panel) */}
                {isMobile && chartConfig && (chartConfig.type as any) !== "gauge" && (
                  <div
                    className="absolute top-0 left-full w-full h-full transition-transform duration-300"
                    style={{ transform: isSwipingToGauge ? "translateX(-100%)" : "translateX(0)" }}
                  >
                    <div className="h-full p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium">Gauge View</h3>
                        <Button
                          size="sm"
                          variant="light"
                          onPress={() => setIsSwipingToGauge(false)}
                          startContent={<Icon icon="lucide:chevron-left" width={16} />}
                        >
                          Back to Chart
                        </Button>
                      </div>
                      <div className="flex items-center justify-center h-[calc(100%-48px)]">
                        <div className="w-64 h-64">
                          <GaugeChart config={chartConfig} size="lg" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile swipe indicator */}
                {isMobile && (chartConfig.type as any) !== "gauge" && !isSwipingToGauge && (
                  <div className="absolute bottom-4 right-4">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => setIsSwipingToGauge(true)}
                      endContent={<Icon icon="lucide:chevron-right" width={16} />}
                    >
                      View Gauge
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-default-500">Select a sensor to view data</p>
              </div>
            )}
          </div>

          {!isSoloMode && !isMobile && selectedSensorIds.length > 0 && isCompareMode && (
            <div className="relative">
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

                              console.log('[Analytics] Mobile date range selected:', {
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
