import {
  addToast,
  Button,
  Card,
  Input,
  Tab,
  Tabs
} from '@heroui/react';
import { Icon } from '@iconify/react';
import React from 'react';
import { ChartConfig, MultiSeriesConfig } from '../../types/sensor';
import { LineChart } from './line-chart';
import { TableView } from '../analytics/table-view';

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
  onToggleStar?: () => void;
  isStarred?: boolean;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({
  config,
  isMultiSeries = false,
  onBrushChange,
  onDownloadCSV,
  sensor,
  onDisplayNameChange,
  onToggleStar,
  isStarred = false
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [displayName, setDisplayName] = React.useState(sensor?.displayName || '');
  const [activeTab, setActiveTab] = React.useState('chart');

  const handleDisplayNameSubmit = () => {
    if (onDisplayNameChange) {
      onDisplayNameChange(displayName);
      addToast({
        title: 'Display Name Updated',
        description: `Sensor ${sensor?.mac} display name updated successfully`
      });
    }
    setIsEditing(false);
  };

  const handleToggleStar = () => {
    if (onToggleStar) {
      onToggleStar();
      addToast({
        title: isStarred ? 'Removed from favorites' : 'Added to favorites',
        description: `Sensor ${sensor?.mac} ${isStarred ? 'removed from' : 'added to'} favorites`
      });
    }
  };

  const handleDownloadCSV = () => {
    if (onDownloadCSV) {
      onDownloadCSV();
      addToast({
        title: 'Data exported',
        description: 'Sensor data has been exported as CSV'
      });
    }
  };

  const handleShowDetails = () => {
    if (sensor) {
      const url = new URL(`/dashboard/analytics/${sensor.id}`, window.location.origin);
      url.searchParams.set('solo', 'true');
      window.open(url.toString(), '_blank');
    }
  };

  if (!config || (isMultiSeries && (!('series' in config) || (config as MultiSeriesConfig).series.length === 0))) {
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
                <Icon icon={isStarred ? 'lucide:star' : 'lucide:star'} className={isStarred ? 'text-warning fill-warning' : 'text-default-400'} />
              </Button>

              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={handleDownloadCSV}
                startContent={<Icon icon="lucide:download" width={16} />}
              >
                Export Data
              </Button>

              <Button
                size="sm"
                variant="flat"
                color="primary"
                onPress={handleShowDetails}
                startContent={<Icon icon="lucide:maximize-2" width={16} />}
              >
                Show Details
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 h-[calc(100%-64px)]">
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={setActiveTab as any}
          className="mb-4"
          variant="underlined"
          color="primary"
        >
          <Tab key="chart" title="Chart View">
            <div className="h-[calc(100%-48px)]">
              <LineChart config={config} isMultiSeries={isMultiSeries} onBrushChange={onBrushChange} />
            </div>
          </Tab>
          <Tab key="table" title="Table View">
            <div className="h-[calc(100%-48px)]">
              <TableView config={config as ChartConfig} onDownloadCSV={onDownloadCSV} />
            </div>
          </Tab>
        </Tabs>
      </div>
    </Card>
  );
};
