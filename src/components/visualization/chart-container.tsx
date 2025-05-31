import {
  addToast,
  Button,
  ButtonGroup,
  Card,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tab,
  Tabs,
  Tooltip,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { ChartConfig, MultiSeriesConfig, VisualizationType } from "../../types/sensor";
import { AreaChart } from "./area-chart";
import { BarChart } from "./bar-chart";
import { BatteryChart } from "./battery-chart";
import { CandlestickChart } from "./candlestick-chart";
import { FFTChart } from "./fft-chart";
import { GaugeChart } from "./gauge-chart";
import { GenericChart } from "./generic-chart";
import { HeatmapChart } from "./heatmap-chart";
import { HistogramChart } from "./histogram-chart";
import { LightChart } from "./light-chart";
import { LineChart } from "./line-chart";
import { PressureChart } from "./pressure-chart";
import { SparkTimelineChart } from "./spark-timeline-chart";
import { AnalyticsView } from "../analytics/analytics-view";
import { TableView } from "../analytics/table-view";

/* ------------------------------------------------------------------ *
 *  1.  Ultra-cheap wrappers so React.memo can short-circuit re-renders
 * ------------------------------------------------------------------ */
const MemoizedLineChart = React.memo(LineChart);
const MemoizedAreaChart = React.memo(AreaChart);
const MemoizedGaugeChart = React.memo(GaugeChart);
const MemoizedHistogramChart = React.memo(HistogramChart);

interface ChartContainerProps {
  config: ChartConfig | MultiSeriesConfig;
  isMultiSeries?: boolean;
  onBrushChange?: (start: Date, end: Date) => void;
  onDownloadCSV?: () => void;
  sensor?: {
    id: string;
    mac: string;
    displayName?: string;
  };
  onDisplayNameChange?: (nickname: string) => void;
  onToggleStar?: () => void;
  isStarred?: boolean;
  onOpenInNewTab?: () => void;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  config,
  isMultiSeries = false,
  onBrushChange,
  onDownloadCSV,
  sensor,
  onDisplayNameChange,
  onToggleStar,
  isStarred = false,
  onOpenInNewTab,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [displayName, setDisplayName] = React.useState(sensor?.displayName || "");
  const [visualizationType, setVisualizationType] = React.useState<VisualizationType>("line");
  const [showMovingAverage, setShowMovingAverage] = React.useState(false);
  const [showDailyRange, setShowDailyRange] = React.useState(false);
  const [isFFTDrawerOpen, setIsFFTDrawerOpen] = React.useState(false);
  const [isHistogramPopoverOpen, setIsHistogramPopoverOpen] = React.useState(false);
  const [isZoomed, setIsZoomed] = React.useState(false);
  const [downloadType, setDownloadType] = React.useState<"csv" | "png">("csv");
  const chartRef = React.useRef<HTMLDivElement>(null);

  const ChartBox: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="h-[300px] border border-default-200 rounded-lg p-3 bg-white dark:bg-content1">
      <h3 className="text-sm font-medium mb-2 text-primary-600">{title}</h3>
      <div className="h-[250px]">{children}</div>
    </div>
  );
  
  const memoizedConfig = React.useMemo(
    () => config, // same reference until series/type actually change
    [
      isMultiSeries
        ? (config as MultiSeriesConfig).series // track series array (object identity)
        : (config as ChartConfig).series,
      config.type, // track primitive sensor-type
    ]
  );

  const memoizedSingle = !isMultiSeries ? (memoizedConfig as ChartConfig) : undefined;

  // Set default visualization type based on sensor type
  React.useEffect(() => {
    if (isMultiSeries) {
      setVisualizationType("line");
      return;
    }

    const singleConfig = config as ChartConfig;
    switch (singleConfig.type) {
      case "temperature":
      case "humidity":
        setVisualizationType("line");
        break;
      case "pressure":
        setVisualizationType("line");
        break;
      case "battery":
        setVisualizationType("gauge");
        break;
      case "motion":
        setVisualizationType("bar");
        break;
      case "light":
        setVisualizationType("area");
        break;
      case "accelerometer":
        setVisualizationType("line");
        break;
      default:
        setVisualizationType("line");
    }
  }, [config, isMultiSeries]);

  // Parse URL hash on component mount and when sensor changes
  React.useEffect(() => {
    if (window.location.hash && sensor) {
      try {
        // Fix: Add error handling and validation for URL hash parsing
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const vizType = hashParams.get("viz");

        // Only set visualization type if it's valid
        if (
          vizType &&
          typeof vizType === "string" &&
          ["line", "area", "bar", "gauge", "candlestick", "spark", "heatmap"].includes(vizType)
        ) {
          setVisualizationType(vizType as VisualizationType);
        }

        const ma = hashParams.get("ma");
        if (ma === "true") {
          setShowMovingAverage(true);
        }

        const daily = hashParams.get("daily");
        if (daily === "true") {
          setShowDailyRange(true);
        }
      } catch (e) {
        console.error("Error parsing URL hash:", e);
        // Don't throw the error, just log it
      }
    }
  }, [sensor, config]);

  const handleDisplayNameSubmit = () => {
    if (onDisplayNameChange) {
      onDisplayNameChange(displayName);
      addToast({
        title: "Display Name Updated",
        description: `Sensor ${sensor?.mac} display name updated successfully`,
      });
    }
    setIsEditing(false);
  };

  const handleToggleStar = () => {
    if (onToggleStar) {
      onToggleStar();
      addToast({
        title: isStarred ? "Removed from favorites" : "Added to favorites",
        description: `Sensor ${sensor?.mac} ${isStarred ? "removed from" : "added to"} favorites`,
      });
    }
  };

  // Update URL hash when visualization type changes
  React.useEffect(() => {
    if (sensor) {
      const hash = `#viz=${visualizationType}${showMovingAverage ? "&ma=true" : ""}${showDailyRange ? "&daily=true" : ""}`;
      window.history.replaceState(null, "", window.location.pathname + window.location.search + hash);
    }
  }, [visualizationType, showMovingAverage, showDailyRange, sensor]);

  // Add error handling for when config is null
  if (!config) {
    return (
      <Card className="w-full h-full border border-default-200 shadow-md">
        <div className="p-4 border-b border-divider bg-default-50">
          {sensor && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      size="sm"
                      value={displayName}
                      onValueChange={setDisplayName}
                      placeholder="Enter Display Name"
                      className="w-48"
                      autoFocus
                    />
                    <Button size="sm" color="primary" onPress={handleDisplayNameSubmit}>
                      Save
                    </Button>
                    <Button size="sm" variant="flat" onPress={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-primary-600">{sensor.displayName || sensor.mac}</h3>
                    <Button isIconOnly size="sm" variant="light" onPress={() => setIsEditing(true)}>
                      <Icon icon="lucide:edit-3" width={16} className="text-primary-500" />
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button isIconOnly size="sm" variant="light" onPress={handleToggleStar} className="text-warning">
                  <Icon
                    icon={isStarred ? "lucide:star" : "lucide:star"}
                    className={isStarred ? "text-warning fill-warning" : "text-default-400"}
                  />
                </Button>

                {onOpenInNewTab && (
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={onOpenInNewTab}
                    startContent={<Icon icon="lucide:external-link" width={16} />}
                  >
                    Open in new tab
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 h-[calc(100%-64px)] flex items-center justify-center">
          <div className="text-center">
            <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-2 mx-auto" width={48} height={48} />
            <p className="text-default-500">No data available for this sensor</p>
          </div>
        </div>
      </Card>
    );
  }

  // Ensure we have data before rendering charts
  if (!config || (isMultiSeries && (!config.series || config.series.length === 0))) {
    return (
      <Card className="w-full h-full border border-default-200 shadow-md">
        <div className="p-4 border-b border-divider bg-default-50">
          {sensor && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      size="sm"
                      value={displayName}
                      onValueChange={setDisplayName}
                      placeholder="Enter Display Name"
                      className="w-48"
                      autoFocus
                    />
                    <Button size="sm" color="primary" onPress={handleDisplayNameSubmit}>
                      Save
                    </Button>
                    <Button size="sm" variant="flat" onPress={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-medium text-primary-600">{sensor.displayName || sensor.mac}</h3>
                    <Button isIconOnly size="sm" variant="light" onPress={() => setIsEditing(true)}>
                      <Icon icon="lucide:edit-3" width={16} className="text-primary-500" />
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button isIconOnly size="sm" variant="light" onPress={handleToggleStar} className="text-warning">
                  <Icon
                    icon={isStarred ? "lucide:star" : "lucide:star"}
                    className={isStarred ? "text-warning fill-warning" : "text-default-400"}
                  />
                </Button>

                {onOpenInNewTab && (
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={onOpenInNewTab}
                    startContent={<Icon icon="lucide:external-link" width={16} />}
                  >
                    Open in new tab
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 h-[calc(100%-64px)] flex items-center justify-center">
          <div className="text-center">
            <Icon icon="lucide:bar-chart-2" className="text-default-300 mb-2 mx-auto" width={48} height={48} />
            <p className="text-default-500">No data available for this sensor</p>
          </div>
        </div>
      </Card>
    );
  }

  const handleVisualizationTypeChange = (type: VisualizationType) => {
    setVisualizationType(type);
    // URL hash is updated by the useEffect
  };

  const handleToggleMovingAverage = () => {
    setShowMovingAverage(!showMovingAverage);
  };

  const handleToggleDailyRange = () => {
    setShowDailyRange((prev) => !prev);
  };

  const handleToggleFFTDrawer = () => {
    setIsFFTDrawerOpen(!isFFTDrawerOpen);
  };

  const handleToggleHistogramPopover = () => {
    setIsHistogramPopoverOpen(!isHistogramPopoverOpen);
  };

  const handleResetZoom = () => {
    setIsZoomed(false);
    if (onBrushChange) {
      // Reset to original time range
      const singleConfig = config as ChartConfig;
      const startTimestamp = singleConfig.series[0]?.timestamp;
      const endTimestamp = singleConfig.series[singleConfig.series.length - 1]?.timestamp;
      if (startTimestamp && endTimestamp) {
        onBrushChange(new Date(startTimestamp), new Date(endTimestamp));
      }
    }
  };

  const handleDownloadTypeToggle = () => {
    setDownloadType(downloadType === "csv" ? "png" : "csv");
  };

  const handleDownload = () => {
    if (downloadType === "csv") {
      if (onDownloadCSV) {
        onDownloadCSV();
      }
    } else {
      // Download chart as PNG
      if (chartRef.current) {
        // In a real implementation, we would use dom-to-image or html2canvas
        addToast({
          title: "Chart downloaded",
          description: "Chart image has been downloaded as PNG",
        });
      }
    }
  };

  const handleZoomChange = (isZoomed: boolean) => {
    setIsZoomed(isZoomed);
  };

  // Render visualization options based on sensor type
  const renderVisualizationOptions = () => {
    if (isMultiSeries) {
      return (
        <ButtonGroup size="sm" variant="flat">
          <Button
            className={visualizationType === "line" ? "border-b-2 border-primary" : ""}
            onPress={() => handleVisualizationTypeChange("line")}
          >
            Line
          </Button>
          <Button
            className={visualizationType === "area" ? "border-b-2 border-primary" : ""}
            onPress={() => handleVisualizationTypeChange("area")}
          >
            Area
          </Button>
        </ButtonGroup>
      );
    }

    const singleConfig = config as ChartConfig;

    switch (singleConfig.type) {
      case "temperature":
      case "humidity":
        return (
          <div className="flex items-center gap-2">
            <ButtonGroup size="sm" variant="flat">
              <Button
                className={visualizationType === "line" ? "border-b-2 border-primary" : ""}
                onPress={() => handleVisualizationTypeChange("line")}
              >
                Line
              </Button>
              <Button
                className={visualizationType === "area" ? "border-b-2 border-primary" : ""}
                onPress={() => handleVisualizationTypeChange("area")}
              >
                Area
              </Button>
              <Button
                className={visualizationType === "gauge" ? "border-b-2 border-primary" : ""}
                onPress={() => handleVisualizationTypeChange("gauge")}
              >
                Gauge
              </Button>
            </ButtonGroup>

            <Tooltip content="Show daily range">
              <Button
                isIconOnly
                size="sm"
                variant={showDailyRange ? "solid" : "flat"}
                color={showDailyRange ? "primary" : "default"}
                onPress={handleToggleDailyRange}
                isDisabled={visualizationType === "gauge"}
              >
                <Icon icon="lucide:calendar-days" width={16} />
              </Button>
            </Tooltip>

            <Tooltip content="Show histogram">
              <Button isIconOnly size="sm" variant="flat" onPress={handleToggleHistogramPopover}>
                <Icon icon="lucide:bar-chart-2" width={16} />
              </Button>
            </Tooltip>
          </div>
        );

      case "pressure":
        return (
          <div className="flex items-center gap-2">
            <ButtonGroup size="sm" variant="flat">
              <Button
                className={visualizationType === "line" ? "border-b-2 border-primary" : ""}
                onPress={() => handleVisualizationTypeChange("line")}
              >
                Line
              </Button>
              <Button
                className={visualizationType === "candlestick" ? "border-b-2 border-primary" : ""}
                onPress={() => handleVisualizationTypeChange("candlestick")}
              >
                Candlestick
              </Button>
            </ButtonGroup>
          </div>
        );

      case "battery":
        return (
          <ButtonGroup size="sm" variant="flat">
            <Button
              className={visualizationType === "gauge" ? "border-b-2 border-primary" : ""}
              onPress={() => handleVisualizationTypeChange("gauge")}
            >
              Gauge
            </Button>
            <Button
              className={visualizationType === "area" ? "border-b-2 border-primary" : ""}
              onPress={() => handleVisualizationTypeChange("area")}
            >
              History
            </Button>
          </ButtonGroup>
        );

      case "motion":
        return (
          <div className="flex items-center gap-2">
            <ButtonGroup size="sm" variant="flat">
              <Button
                className={visualizationType === "bar" ? "border-b-2 border-primary" : ""}
                onPress={() => handleVisualizationTypeChange("bar")}
              >
                Bar
              </Button>
              <Button
                className={visualizationType === "spark" ? "border-b-2 border-primary" : ""}
                onPress={() => handleVisualizationTypeChange("spark")}
              >
                Timeline
              </Button>
            </ButtonGroup>
          </div>
        );

      case "light":
        return (
          <ButtonGroup size="sm" variant="flat">
            <Button
              className={visualizationType === "area" ? "border-b-2 border-primary" : ""}
              onPress={() => handleVisualizationTypeChange("area")}
            >
              Area
            </Button>
            <Button
              className={visualizationType === "heatmap" ? "border-b-2 border-primary" : ""}
              onPress={() => handleVisualizationTypeChange("heatmap")}
            >
              Heatmap
            </Button>
          </ButtonGroup>
        );

      case "accelerometer":
        return (
          <div className="flex items-center gap-2">
            <ButtonGroup size="sm" variant="flat">
              <Button
                className={visualizationType === "line" ? "border-b-2 border-primary" : ""}
                onPress={() => handleVisualizationTypeChange("line")}
              >
                Line
              </Button>
            </ButtonGroup>

            <Tooltip content="Show FFT analysis">
              <Button
                isIconOnly
                size="sm"
                variant={isFFTDrawerOpen ? "solid" : "flat"}
                color={isFFTDrawerOpen ? "primary" : "default"}
                onPress={handleToggleFFTDrawer}
              >
                <Icon icon="lucide:activity" width={16} />
              </Button>
            </Tooltip>
          </div>
        );

      default:
        return (
          <ButtonGroup size="sm" variant="flat">
            <Button
              className={visualizationType === "line" ? "border-b-2 border-primary" : ""}
              onPress={() => handleVisualizationTypeChange("line")}
            >
              Line
            </Button>
            <Button
              className={visualizationType === "area" ? "border-b-2 border-primary" : ""}
              onPress={() => handleVisualizationTypeChange("area")}
            >
              Area
            </Button>
            <Button
              className={visualizationType === "bar" ? "border-b-2 border-primary" : ""}
              onPress={() => handleVisualizationTypeChange("bar")}
            >
              Bar
            </Button>
            <Button
              className={visualizationType === "gauge" ? "border-b-2 border-primary" : ""}
              onPress={() => handleVisualizationTypeChange("gauge")}
            >
              Gauge
            </Button>
          </ButtonGroup>
        );
    }
  };

  const renderChart = React.useCallback(() => {
    const cfg = memoizedConfig;

    if (isMultiSeries) {
      const multi = cfg as MultiSeriesConfig;
      return visualizationType === "area" ? (
        <AreaChart config={multi} isMultiSeries onBrushChange={onBrushChange} onZoomChange={handleZoomChange} />
      ) : (
        <LineChart config={multi} isMultiSeries onBrushChange={onBrushChange} onZoomChange={handleZoomChange} />
      );
    }

    const singleConfig = cfg as ChartConfig;
    const enhancedConfig = {
      ...singleConfig,
      showMovingAverage,
      showDailyRange,
      visualizationType,
    };

    switch (singleConfig.type) {
      case "temperature":
      case "humidity":
        switch (visualizationType) {
          case "area":
            return <AreaChart config={enhancedConfig} onBrushChange={onBrushChange} onZoomChange={handleZoomChange} />;
          case "gauge":
            return <GaugeChart config={singleConfig} size="lg" />;
          default:
            return <LineChart config={enhancedConfig} onBrushChange={onBrushChange} onZoomChange={handleZoomChange} />;
        }

      case "pressure":
        switch (visualizationType) {
          case "candlestick":
            return (
              <CandlestickChart config={enhancedConfig} onBrushChange={onBrushChange} onZoomChange={handleZoomChange} />
            );
          default:
            return <PressureChart config={enhancedConfig} onBrushChange={onBrushChange} />;
        }

      case "battery":
        switch (visualizationType) {
          case "area":
            return <BatteryChart config={enhancedConfig} showHistory={true} onZoomChange={handleZoomChange} />;
          default:
            return <BatteryChart config={enhancedConfig} showHistory={false} onZoomChange={handleZoomChange} />;
        }

      case "motion":
        switch (visualizationType) {
          case "spark":
            return (
              <SparkTimelineChart
                config={enhancedConfig}
                onBrushChange={onBrushChange}
                onZoomChange={handleZoomChange}
              />
            );
          default:
            return <BarChart config={enhancedConfig} onBrushChange={onBrushChange} onZoomChange={handleZoomChange} />;
        }

      case "light":
        switch (visualizationType) {
          case "heatmap":
            return <HeatmapChart config={enhancedConfig} onZoomChange={handleZoomChange} />;
          default:
            return <LightChart config={enhancedConfig} onBrushChange={onBrushChange} onZoomChange={handleZoomChange} />;
        }

      case "accelerometer":
        return (
          <div className="flex flex-col h-full">
            <LineChart config={enhancedConfig} onBrushChange={onBrushChange} onZoomChange={handleZoomChange} />
            {isFFTDrawerOpen && (
              <div className="mt-4 h-64 border-t border-divider pt-4">
                <div className="text-sm font-medium mb-2">FFT Analysis</div>
                <FFTChart config={enhancedConfig} />
              </div>
            )}
          </div>
        );

      default:
        return (
          <GenericChart
            config={enhancedConfig}
            visualizationType={visualizationType}
            onBrushChange={onBrushChange}
            onZoomChange={handleZoomChange}
          />
        );
    }
  }, [
    memoizedConfig,
    isMultiSeries,
    visualizationType,
    showMovingAverage,
    showDailyRange,
    isFFTDrawerOpen,
    onBrushChange,
    handleZoomChange,
  ]);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [activeTab, setActiveTab] = React.useState("chart");

  return (
    <Card className="w-full h-full border border-default-200 shadow-md">
      <div className="p-4 border-b border-divider bg-default-50">
        {sensor && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    size="sm"
                    value={displayName}
                    onValueChange={setDisplayName}
                    placeholder="Enter Display Name"
                    className="w-48"
                    autoFocus
                  />
                  <Button size="sm" color="primary" onPress={handleDisplayNameSubmit}>
                    Save
                  </Button>
                  <Button size="sm" variant="flat" onPress={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-medium text-primary-600">{sensor.displayName || sensor.mac}</h3>
                  <Button isIconOnly size="sm" variant="light" onPress={() => setIsEditing(true)}>
                    <Icon icon="lucide:edit-3" width={16} className="text-primary-500" />
                  </Button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button isIconOnly size="sm" variant="light" onPress={handleToggleStar} className="text-warning">
                <Icon
                  icon={isStarred ? "lucide:star" : "lucide:star"}
                  className={isStarred ? "text-warning fill-warning" : "text-default-400"}
                />
              </Button>

              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={onOpen}
                startContent={<Icon icon="lucide:maximize-2" width={16} />}
              >
                Show Details
              </Button>

              {onOpenInNewTab && (
                <Button
                  size="sm"
                  variant="flat"
                  onPress={onOpenInNewTab}
                  startContent={<Icon icon="lucide:external-link" width={16} />}
                >
                  Open in new tab
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 h-[calc(100%-64px)]">
        <div className="flex justify-between items-center mb-4 px-4">
          <div className="flex items-center">{renderVisualizationOptions()}</div>

          <div className="flex items-center gap-2">
            {isZoomed && (
              <Button
                size="sm"
                variant="flat"
                color="secondary"
                onPress={handleResetZoom}
                startContent={<Icon icon="lucide:zoom-out" width={16} />}
              >
                Reset Zoom
              </Button>
            )}

            <Tooltip content={`Download as ${downloadType.toUpperCase()}`}>
              <Button size="sm" variant="light" color="primary" isIconOnly onPress={handleDownload}>
                <Icon icon={downloadType === "csv" ? "lucide:download" : "lucide:image"} width={16} />
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="h-[calc(100%-48px)] px-4 overflow-auto rounded-lg bg-white dark:bg-content1" ref={chartRef}>
          {renderChart()}
        </div>

        {isHistogramPopoverOpen && (
          <div
            className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50"
            onClick={() => setIsHistogramPopoverOpen(false)}
          >
            <div className="bg-content1 p-4 rounded-lg w-full max-w-2xl shadow-lg" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-primary-600">Value Distribution</h3>
                <Button isIconOnly size="sm" variant="light" onPress={() => setIsHistogramPopoverOpen(false)}>
                  <Icon icon="lucide:x" width={16} />
                </Button>
              </div>
              <div className="h-64">
                <HistogramChart config={config as ChartConfig} />
              </div>
            </div>
          </div>
        )}
      </div>

      {isOpen && (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" scrollBehavior="inside">
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1 border-b border-divider">
                  <h2 className="text-xl font-semibold text-primary-600">
                    {sensor?.displayName || sensor?.mac || "Sensor Details"}
                  </h2>
                </ModalHeader>
                <ModalBody className="p-0">
                  <Tabs
                    selectedKey={activeTab}
                    onSelectionChange={setActiveTab as any}
                    color="primary"
                    className="w-full"
                  >
                    <Tab key="chart" title="Chart View" />
                    {!isMultiSeries && <Tab key="table" title="Table View" />}
                    {!isMultiSeries && <Tab key="analytics" title="Analytics" />}
                    {!isMultiSeries && <Tab key="multi" title="Multi-Chart View" />}
                  </Tabs>

                  <div className="h-[600px] overflow-auto">
                    {activeTab === "chart" && <div className="p-4 h-full flex flex-col">{renderChart()}</div>}

                    {activeTab === "table" && memoizedSingle && (
                      <TableView config={memoizedSingle} onDownloadCSV={onDownloadCSV} />
                    )}

                    {activeTab === "analytics" && memoizedSingle && <AnalyticsView config={memoizedSingle} />}

                    {activeTab === "multi" && memoizedSingle && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                        <ChartBox title="Line Chart">
                          <MemoizedLineChart config={memoizedSingle} />
                        </ChartBox>

                        <ChartBox title="Area Chart">
                          <MemoizedAreaChart config={memoizedSingle} />
                        </ChartBox>

                        <ChartBox title="Gauge Chart">
                          <MemoizedGaugeChart config={memoizedSingle} />
                        </ChartBox>

                        <ChartBox title="Histogram">
                          <MemoizedHistogramChart config={memoizedSingle} />
                        </ChartBox>
                      </div>
                    )}
                  </div>
                </ModalBody>
                <ModalFooter className="border-t border-divider">
                  <Button color="danger" variant="light" onPress={onClose}>
                    Close
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      )}
    </Card>
  );
};
