import { addToast, Button, ButtonGroup, Card, Input, Tab, Tabs, Tooltip, useDisclosure, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import { ChartConfig, MultiSeriesConfig, VisualizationType } from "../../types/sensor";
import { TableView } from "../analytics/table-view";
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
  onDisplayNameChange?: (displayName: string) => void;
  onToggleStar?: (mac: string) => void;
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
  const chartRef = React.useRef<HTMLDivElement>(null);

  const memoizedConfig = React.useMemo(
    () => config, // same reference until series/type actually change
    [
      isMultiSeries
        ? (config as MultiSeriesConfig).series // track series array (object identity)
        : (config as ChartConfig).series,
      config.type, // track primitive sensor-type
    ]
  );

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

  // Update URL hash when visualization type changes
  React.useEffect(() => {
    if (sensor) {
      const hash = `#viz=${visualizationType}${showMovingAverage ? "&ma=true" : ""}${showDailyRange ? "&daily=true" : ""}`;
      window.history.replaceState(null, "", window.location.pathname + window.location.search + hash);
    }
  }, [visualizationType, showMovingAverage, showDailyRange, sensor]);

  // Add this in your component or in useEffect
  // React.useEffect(() => {
  //   console.log("Chart receiving new data:", {
  //     timestamp: new Date().toISOString(),
  //     isMultiSeries: !!isMultiSeries,
  //     seriesCount: isMultiSeries ? config?.series?.length : 1,
  //     dataPoints: isMultiSeries
  //       ? config?.series?.reduce((acc, s) => acc + (s.data?.length || 0), 0)
  //       : config?.series?.length || 0,
  //     dateRange: isMultiSeries && config?.series?.[0]?.data?.length
  //       ? {
  //           start: new Date(config.series[0].data[0].timestamp).toISOString(),
  //           end: new Date(config.series[0].data[config.series[0].data.length-1].timestamp).toISOString()
  //         }
  //       : config?.series?.length
  //         ? {
  //             start: new Date(config.series[0].timestamp).toISOString(),
  //             end: new Date(config.series[config.series.length-1].timestamp).toISOString()
  //           }
  //         : null
  //   });
  // }, [config, isMultiSeries]);

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
                {/* <Button isIconOnly size="sm" variant="light" onPress={handleToggleStar} className="text-warning">
                  <Icon
                    icon={isStarred ? "lucide:star" : "lucide:star"}
                    className={isStarred ? "text-warning fill-warning" : "text-default-400"}
                  />
                </Button> */}

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
                {/* <Button isIconOnly size="sm" variant="light" onPress={handleToggleStar} className="text-warning">
                  <Icon
                    icon={isStarred ? "lucide:star" : "lucide:star"}
                    className={isStarred ? "text-warning fill-warning" : "text-default-400"}
                  />
                </Button> */}

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

  const handleDownloadTypeToggle = () => {
    // This function is no longer needed
  };

  const handleDownload = async (type: "csv" | "png") => {
    if (type === "csv") {
      if (onDownloadCSV) {
        onDownloadCSV();
      } else {
        // Generate CSV data from config
        await downloadCSV();
      }
    } else {
      // Download chart as PNG
      await downloadPNG();
    }
  };

  const downloadCSV = async () => {
    try {
      let csvContent = "";
      
      if (isMultiSeries) {
        const multiConfig = config as MultiSeriesConfig;
        // Header
        csvContent = "Timestamp," + multiConfig.series.map(s => s.name).join(",") + "\n";
        
        // Assuming all series have the same timestamps, use first series as reference
        if (multiConfig.series.length > 0 && multiConfig.series[0].data) {
          multiConfig.series[0].data.forEach((dataPoint, index) => {
            const timestamp = new Date(dataPoint.timestamp).toISOString();
            const values = multiConfig.series.map(s => 
              s.data && s.data[index] ? s.data[index].value : ""
            ).join(",");
            csvContent += `${timestamp},${values}\n`;
          });
        }
      } else {
        const singleConfig = config as ChartConfig;
        csvContent = "Timestamp,Value\n";
        
        if (singleConfig.series && Array.isArray(singleConfig.series)) {
          singleConfig.series.forEach(dataPoint => {
            const timestamp = new Date(dataPoint.timestamp).toISOString();
            csvContent += `${timestamp},${dataPoint.value}\n`;
          });
        }
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const filename = sensor ? 
        `${sensor.displayName || sensor.mac}_data.csv` : 
        `sensor_data_${new Date().toISOString().split('T')[0]}.csv`;
      
      saveAs(blob, filename);
      
      addToast({
        title: "CSV Downloaded",
        description: "Chart data has been downloaded as CSV",
      });
    } catch (error) {
      console.error("Error downloading CSV:", error);
      addToast({
        title: "Download Failed",
        description: "Failed to download CSV data",
      });
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
            const filename = sensor ? 
              `${sensor.displayName || sensor.mac}_chart.png` : 
              `sensor_chart_${new Date().toISOString().split('T')[0]}.png`;
            
            saveAs(blob, filename);
            
            addToast({
              title: "Chart Downloaded",
              description: "Chart image has been downloaded as PNG",
            });
          }
        }, 'image/png');
      }
    } catch (error) {
      console.error("Error downloading PNG:", error);
      addToast({
        title: "Download Failed",
        description: "Failed to download chart image",
      });
    }
  };

  const renderChart = React.useCallback(() => {
    const cfg = memoizedConfig;
    if (isMultiSeries) {
      const multi = cfg as MultiSeriesConfig;
      return visualizationType === "area" ? (
        <AreaChart config={multi} isMultiSeries onBrushChange={onBrushChange} />
      ) : (
        <LineChart config={multi} isMultiSeries/>
      );
    }

    const singleConfig = cfg as ChartConfig;
    const enhancedConfig = {
      ...singleConfig,
      showMovingAverage,
      showDailyRange,
      visualizationType,
    };

    console.log({ enhancedConfig });
    switch (singleConfig.type) {
      case "temperature":
      case "humidity":
        switch (visualizationType) {
          case "area":
            return <AreaChart config={enhancedConfig} onBrushChange={onBrushChange} />;
          case "gauge":
            return <GaugeChart config={singleConfig} size="lg" />;
          default:
            return <LineChart config={enhancedConfig}/>;
        }

      case "pressure":
        switch (visualizationType) {
          case "candlestick":
            return <CandlestickChart config={enhancedConfig} onBrushChange={onBrushChange} />;
          default:
            return <PressureChart config={enhancedConfig} onBrushChange={onBrushChange} />;
        }

      case "battery":
        switch (visualizationType) {
          case "area":
            return <BatteryChart config={enhancedConfig} showHistory={true} />;
          default:
            return <BatteryChart config={enhancedConfig} showHistory={false} />;
        }

      case "motion":
        switch (visualizationType) {
          case "spark":
            return <SparkTimelineChart config={enhancedConfig} onBrushChange={onBrushChange} />;
          default:
            return <BarChart config={enhancedConfig} onBrushChange={onBrushChange} />;
        }

      case "light":
        switch (visualizationType) {
          case "heatmap":
            return <HeatmapChart config={enhancedConfig} />;
          default:
            return <LightChart config={enhancedConfig} onBrushChange={onBrushChange} />;
        }

      case "accelerometer":
        return (
          <div className="flex flex-col h-full">
            <LineChart config={enhancedConfig} />
          </div>
        );

      default:
        return (
          <GenericChart config={enhancedConfig} visualizationType={visualizationType} onBrushChange={onBrushChange} />
        );
    }
  }, [memoizedConfig, isMultiSeries, visualizationType, showMovingAverage, showDailyRange, onBrushChange]);

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
              {/* <Button isIconOnly size="sm" variant="light" onPress={handleToggleStar} className="text-warning">
                <Icon
                  icon={isStarred ? "lucide:star" : "lucide:star"}
                  className={isStarred ? "text-warning fill-warning" : "text-default-400"}
                />
              </Button> */}

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
                  <DropdownItem
                    key="png"
                    startContent={<Icon icon="lucide:image" width={16} />}
                    onPress={() => handleDownload("png")}
                  >
                    Download as PNG
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>

              {onOpenInNewTab && (
                <Button
                  size="sm"
                  variant="flat"
                  onPress={onOpenInNewTab}
                  startContent={<Icon icon="lucide:external-link" width={16} />}
                >
                  Show Details
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 h-[calc(100%-64px)] flex flex-col">
        {/* tab headers */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={setActiveTab as any}
          variant="underlined"
          color="primary"
          className="mb-4"
        >
          <Tab key="chart" title="Chart View" />
          <Tab key="table" title="Table View" />
        </Tabs>

        {/* tab bodies — one is shown at a time */}
        {activeTab === "chart" && (
          <div className="flex-1 overflow-auto rounded-lg bg-white dark:bg-content1" ref={chartRef}>
            {renderChart()}
          </div>
        )}

        {activeTab === "table" && (
          <div className="flex-1 overflow-auto">
            <TableView
              config={{
                ...config,
                series: (config as ChartConfig).series?.map((s: any) => ({
                  ...s,
                  data: s.data?.map((d: any) => ({
                    ...d,
                    value: typeof d.value === "number" ? Number(d.value).toFixed(4) : d.value,
                  })) ?? [],
                })) ?? [],
              }}
              onDownloadCSV={onDownloadCSV}
            />
          </div>
        )}
      </div>
    </Card>
  );
};
