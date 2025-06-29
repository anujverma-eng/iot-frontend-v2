import {
  addToast,
  Badge,
  Button,
  Card,
  CardBody,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Spinner,
  Tab,
  Tabs,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { chartColors } from "../../data/analytics";
import { AppDispatch, RootState } from "../../store";
import {
  fetchSensorById,
  fetchSensors,
  selectFilters,
  selectSelectedSensor,
  selectSensors,
  selectSensorsLoading,
  setFilters,
  toggleSensorStar,
  updateSensorDisplayName,
} from "../../store/sensorsSlice";
import { fetchTelemetry, selectTelemetryData, selectTelemetryLoading } from "../../store/telemetrySlice";
import { ChartConfig } from "../../types/sensor";
import { ChartContainer } from "../visualization/chart-container";
import { AnomalyDetectionChart } from "./distribution-charts/anomaly-detection-chart";
import { CorrelationAnalysisChart } from "./distribution-charts/correlation-analysis-chart";
import { DistributionChart } from "./distribution-charts/distribution-chart";
import { TrendAnalysisChart } from "./distribution-charts/trend-analysis-chart";
import { FilterBar } from "./filter-bar";
import { TableView } from "./table-view";

// Fix the interface to satisfy the Record<string, string | undefined> constraint
interface SoloViewParams {
  [key: string]: string | undefined;
  sensorId?: string;
}

export const SoloView: React.FC = () => {
  const log = (...msg: any[]) => console.log("[SoloView]", ...msg);
  const navigate = useNavigate();
  const { sensorId } = useParams<SoloViewParams>();
  const dispatch = useDispatch<AppDispatch>();

  // Get state from Redux
  const filters = useSelector(selectFilters);
  const telemetryData = useSelector(selectTelemetryData);
  const isLoadingData = useSelector(selectTelemetryLoading);
  const sensors = useSelector(selectSensors);
  const loading = useSelector(selectSensorsLoading);
  const selectedSensorData = useSelector(selectSelectedSensor);

  // Local state
  const [searchText, setSearchText] = React.useState("");
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [selectedTab, setSelectedTab] = React.useState("chart");
  // const [page, setPage] = React.useState(1);
  // const [rowsPerPage, setRowsPerPage] = React.useState(10);
  // const [sortDescriptor, setSortDescriptor] = React.useState({ column: "timestamp", direction: "descending" });
  const [groupBy, setGroupBy] = React.useState<"none" | "hourly" | "daily" | "weekly">("none");

  const sensorsLoaded = useSelector((s: RootState) => s.sensors.loaded);
  const sensorsLoading = useSelector(selectSensorsLoading);

  // Map sensors to the format expected by components
  const mappedSensors = React.useMemo(() => {
    return sensors.map((sensor) => ({
      ...sensor,
      id: sensor._id,
      displayName: sensor.displayName,
      starred: sensor.isStarred,
    }));
  }, [sensors]);

  // Filter sensors based on search text
  const filteredSensors = React.useMemo(() => {
    if (!searchText) return mappedSensors;

    const lowerSearch = searchText.toLowerCase();
    return mappedSensors.filter(
      (sensor) =>
        sensor.mac.toLowerCase().includes(lowerSearch) ||
        (sensor.displayName && sensor.displayName.toLowerCase().includes(lowerSearch))
    );
  }, [mappedSensors, searchText]);

  // Current sensor
  const currentSensor = React.useMemo(() => {
    return mappedSensors.find((s) => s._id === sensorId);
  }, [mappedSensors, sensorId]);

  // Add state for initial loading
  const [initialLoading, _setInitialLoading] = React.useState(true);

  // Fetch sensors on component mount - ONLY ONCE
  React.useEffect(() => {
    if (sensorsLoaded || sensorsLoading) return; // already have / still fetching
    log("⏩ fetchSensors (once)");
    dispatch(
      fetchSensors({
        page: 1,
        limit: 50,
        claimed: true,
        search: filters.search || "",
      })
    )
      .unwrap() // ← propagates real promise
      .catch((e) => log("⚠️ fetchSensors error", e));
  }, [dispatch, sensorsLoaded, sensorsLoading, filters.search]);

  /*****************************************************************************
   * 2️⃣  Ensure we always have a “selected” sensor
   *****************************************************************************/
  const filteredIds = React.useMemo(() => filteredSensors.map((s) => s.id).join("|"), [filteredSensors]);

  React.useEffect(() => {
    if (!sensorsLoaded) return; // wait for list

    /* a) we have an id in the URL ----------------------------------------- */
    if (sensorId) {
      if (selectedSensorData.data?._id !== sensorId) {
        log("⏩ fetchSensorById", sensorId);
        dispatch(fetchSensorById(sensorId));
      }
      return;
    }

    /* b) no id → redirect to first sensor --------------------------------- */
    if (filteredSensors.length && !selectedSensorData.data) {
      const firstId = filteredSensors[0].id;
      log("↪️ redirect to first sensor", firstId);
      navigate(`/dashboard/sensors/${firstId}?solo=true`, { replace: true });
    }
  }, [sensorId, filteredIds, sensorsLoaded, selectedSensorData.data?._id, dispatch, navigate]);

  // Fetch telemetry data when selected sensor or time range changes - FIXED DEPENDENCIES
  React.useEffect(() => {
    log("🔄 sensor-selection effect", { sensorId, filteredIds, selectedId: selectedSensorData.data?._id });

    if (initialLoading) return; // wait until list call finished
    if (sensorId && !initialLoading) {
      dispatch(
        fetchTelemetry({
          sensorIds: [sensorId],
          timeRange: {
            start: filters.timeRange.start.toISOString(),
            end: filters.timeRange.end.toISOString(),
          },
        })
      );
    }
  }, [sensorId, filters.timeRange.start, filters.timeRange.end, initialLoading, dispatch]);

  // Prepare chart config for selected sensor
  const chartConfig: ChartConfig | null = React.useMemo(() => {
    if (!sensorId || !telemetryData[sensorId]) return null;

    const sensorData = telemetryData[sensorId];

    return {
      type: sensorData.type,
      unit: sensorData.unit,
      series: sensorData.series,
      color: chartColors[0],
    };
  }, [sensorId, telemetryData]);

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

    const series = telemetryData[sensorId].series;
    if (!series.length) return null;

    const values = series.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const latest = series[series.length - 1].value;

    // Calculate standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, avg, latest, stdDev };
  }, [sensorId, telemetryData]);

  // Handlers
  const handleBackToAnalytics = () => {
    navigate(`/dashboard/sensors/${sensorId}`);
  };

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (text) {
      setIsDropdownOpen(true);
    } else {
      setIsDropdownOpen(false);
    }
  };

  const handleSensorSelect = (id: string) => {
    navigate(`/dashboard/sensors/${id}?solo=true`);
    setIsDropdownOpen(false);
    setSearchText("");
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

  const handleDownloadCSV = () => {
    addToast({
      title: "CSV Downloaded",
      description: "Sensor data has been downloaded as CSV",
    });
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

  const handleToggleStar = () => {
    if (sensorId) {
      dispatch(toggleSensorStar(sensorId));
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
      <div className="bg-content1 border-b border-divider p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button isIconOnly size="sm" variant="light" onPress={handleBackToAnalytics}>
                <Icon icon="lucide:arrow-left" width={16} />
              </Button>

              {/* <div className="relative w-full max-w-xs">
                <Input
                  placeholder="Search sensors"
                  value={searchText}
                  onValueChange={handleSearchChange}
                  startContent={<Icon icon="lucide:search" className="text-default-400" />}
                  size="sm"
                  className="w-full"
                  isClearable
                  onClear={() => setIsDropdownOpen(false)}
                  onFocus={() => filteredSensors.length > 0 && setIsDropdownOpen(true)}
                />

                {isDropdownOpen && filteredSensors.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-content1 shadow-md rounded-md z-50 max-h-[300px] overflow-y-auto">
                    {filteredSensors.map((sensor) => (
                      <div
                        key={sensor._id}
                        className={`flex items-center gap-2 p-2 hover:bg-content2 cursor-pointer ${sensor._id === sensorId ? "bg-primary-100" : ""}`}
                        onClick={() => handleSensorSelect(sensor._id)}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${sensor.status === "live" ? "bg-success" : "bg-danger"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{sensor.displayName || sensor.mac}</div>
                          {sensor.displayName && <div className="text-xs text-default-500 truncate">{sensor.mac}</div>}
                        </div>
                        {sensor.starred && <Icon icon="lucide:star" className="text-warning fill-warning" width={14} />}
                      </div>
                    ))}
                  </div>
                )}
              </div> */}
            </div>

            <div className="flex items-center gap-2">
              <FilterBar filters={filters} onFiltersChange={handleFiltersChange} />
            </div>
          </div>

          {/* Active filters display */}
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
                  {filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}
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
      </div>

      {/* Main content with tabs */}
      <div className="flex-1 p-4 overflow-auto" onClick={() => setIsDropdownOpen(false)}>
        {isLoadingData ? (
          <div className="flex items-center justify-center h-full">
            <Spinner />
          </div>
        ) : currentSensor ? (
          <div className="h-full flex flex-col">
            {/* Sensor info header */}
            <div className="mb-4">
              <Card className="w-full">
                <CardBody>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold">{currentSensor.displayName || currentSensor.mac}</h2>
                      <Badge color={currentSensor.status === "live" ? "success" : "danger"} variant="flat">
                        {currentSensor?.status?.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button isIconOnly size="sm" variant="light" onPress={handleToggleStar}>
                        <Icon
                          icon="lucide:star"
                          className={currentSensor.starred ? "text-warning fill-warning" : "text-default-400"}
                        />
                      </Button>
                    </div>
                  </div>
                  <p className="text-small text-default-500 mt-1">{currentSensor.mac}</p>

                  {/* Stats cards */}
                  {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mt-4">
                      <Card>
                        <CardBody className="p-3">
                          <p className="text-xs text-default-500">Latest</p>
                          <p className="text-xl font-semibold text-success-800">{stats.latest.toFixed(1)}</p>
                          <p className="text-xs">{chartConfig?.unit}</p>
                        </CardBody>
                      </Card>
                      <Card>
                        <CardBody className="p-3">
                          <p className="text-xs text-default-500">Average</p>
                          <p className="text-xl font-semibold text-primary-700">{stats.avg.toFixed(1)}</p>
                          <p className="text-xs">{chartConfig?.unit}</p>
                        </CardBody>
                      </Card>
                      <Card>
                        <CardBody className="p-3">
                          <p className="text-xs text-default-500">Minimum</p>
                          <p className="text-xl font-semibold text-danger-700">{stats.min.toFixed(1)}</p>
                          <p className="text-xs">{chartConfig?.unit}</p>
                        </CardBody>
                      </Card>
                      <Card>
                        <CardBody className="p-3">
                          <p className="text-xs text-default-500">Maximum</p>
                          <p className="text-xl font-semibold text-warning-700">{stats.max.toFixed(1)}</p>
                          <p className="text-xs">{chartConfig?.unit}</p>
                        </CardBody>
                      </Card>
                      <Card>
                        <CardBody className="p-3">
                          <p className="text-xs text-default-500">Max - Min</p>
                          <p className="text-xl font-semibold text-sky-800">{(stats.max - stats.min).toFixed(1)}</p>
                          <p className="text-xs">{chartConfig?.unit}</p>
                        </CardBody>
                      </Card>
                      <Card>
                        <CardBody className="p-3">
                          <p className="text-xs text-default-500">Std Dev</p>
                          <p className="text-xl font-semibold">{stats.stdDev.toFixed(1)}</p>
                          <p className="text-xs">{chartConfig?.unit}</p>
                        </CardBody>
                      </Card>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs selectedKey={selectedTab} onSelectionChange={setSelectedTab as any} className="mb-4">
              <Tab key="chart" title="Chart View">
                {chartConfig && (
                  <ChartContainer
                    config={chartConfig}
                    onBrushChange={handleBrushChange}
                    onDownloadCSV={handleDownloadCSV}
                    sensor={{
                      id: currentSensor._id,
                      mac: currentSensor.mac,
                      displayName: currentSensor.displayName,
                    }}
                    onDisplayNameChange={handleDisplayNameChange}
                    onToggleStar={handleToggleStar}
                    isStarred={currentSensor.starred}
                  />
                )}
              </Tab>
              {/* <Tab key="table" title="Table Viewss">
                <Card>
                  <CardBody>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Sensor Readings</h3>
                      <div className="flex items-center gap-2">
                        <Dropdown>
                          <DropdownTrigger>
                            <Button
                              variant="flat"
                              size="sm"
                              endContent={<Icon icon="lucide:chevron-down" width={16} />}
                            >
                              {groupBy === "none"
                                ? "No Grouping"
                                : groupBy === "hourly"
                                  ? "Group by Hour"
                                  : groupBy === "daily"
                                    ? "Group by Day"
                                    : "Group by Week"}
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu
                            aria-label="Group By Options"
                            onAction={(key) => handleGroupByChange(key as any)}
                          >
                            <DropdownItem key="none">No Grouping</DropdownItem>
                            <DropdownItem key="hourly">Group by Hour</DropdownItem>
                            <DropdownItem key="daily">Group by Day</DropdownItem>
                            <DropdownItem key="weekly">Group by Week</DropdownItem>
                          </DropdownMenu>
                        </Dropdown>

                        <Button
                          size="sm"
                          variant="light"
                          onPress={handleDownloadCSV}
                          startContent={<Icon icon="lucide:download" width={16} />}
                        >
                          Export CSV
                        </Button>
                      </div>
                    </div>

                    <div className="p-4 h-[600px]">
                      <TableView config={chartConfig as ChartConfig} onDownloadCSV={handleDownloadCSV} />
                    </div>
                  </CardBody>
                </Card>
              </Tab> */}
              <Tab key="analytics" title="Analytics">
                <Card>
                  <CardBody>
                    <Tabs aria-label="Analytics tabs" color="primary" variant="underlined" className="mb-4">
                      <Tab key="distribution" title="Distribution">
                        <div className="h-[400px] mt-4">
                          {chartConfig && <DistributionChart config={chartConfig} />}
                        </div>
                      </Tab>
                      <Tab key="trend" title="Trend Analysis">
                        <div className="h-[400px] mt-4">
                          {chartConfig && <TrendAnalysisChart config={chartConfig} />}
                        </div>
                      </Tab>
                      <Tab key="anomaly" title="Anomaly Detection">
                        <div className="h-[400px] mt-4">
                          {chartConfig && <AnomalyDetectionChart config={chartConfig} />}
                        </div>
                      </Tab>
                      <Tab key="correlation" title="Correlation">
                        <div className="h-[400px] mt-4">
                          {chartConfig && <CorrelationAnalysisChart config={chartConfig} />}
                        </div>
                      </Tab>
                    </Tabs>
                  </CardBody>
                </Card>
              </Tab>

              <Tab key="multichart" title="Multi-Chart View">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="shadow-sm">
                    <CardBody className="p-3">
                      <h3 className="text-sm font-medium mb-2 text-primary-600">Value Distribution</h3>
                      <div className="h-[250px]">
                        {chartConfig && <DistributionChart config={chartConfig} compact />}
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="shadow-sm">
                    <CardBody className="p-3">
                      <h3 className="text-sm font-medium mb-2 text-secondary-600">Trend Analysis</h3>
                      <div className="h-[250px]">
                        {chartConfig && <TrendAnalysisChart config={chartConfig} compact />}
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="shadow-sm">
                    <CardBody className="p-3">
                      <h3 className="text-sm font-medium mb-2 text-danger-600">Anomaly Detection</h3>
                      <div className="h-[250px]">
                        {chartConfig && <AnomalyDetectionChart config={chartConfig} compact />}
                      </div>
                    </CardBody>
                  </Card>

                  <Card className="shadow-sm">
                    <CardBody className="p-3">
                      <h3 className="text-sm font-medium mb-2 text-success-600">Correlation Analysis</h3>
                      <div className="h-[250px]">
                        {chartConfig && <CorrelationAnalysisChart config={chartConfig} compact />}
                      </div>
                    </CardBody>
                  </Card>
                </div>
              </Tab>
            </Tabs>
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
    </div>
  );
};
