import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
  Divider,
  Chip,
  Button,
  Breadcrumbs,
  BreadcrumbItem,
  Spinner,
  Alert,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBreadcrumbNavigation } from '../hooks/useBreadcrumbNavigation';
import { useSettings } from '../hooks/useSettings';
import { offlineDetectionService } from '../services/offlineDetectionService';

// Timeout options
const TIMEOUT_OPTIONS = [
  { value: 1, label: '1 minutes', description: 'Quick response detection ( for internal testing)' },
  { value: 5, label: '5 minutes', description: 'Quick response detection' },
  { value: 10, label: '10 minutes', description: 'Balanced monitoring' },
  { value: 30, label: '30 minutes', description: 'Standard intervals' },
  { value: 60, label: '1 hour', description: 'Extended tolerance' },
  { value: 300, label: '5 hours', description: 'Long-term monitoring' },
];

// Helper function to get user-friendly error titles
const getErrorTitle = (errorType: string | undefined): string => {
  switch (errorType) {
    case 'SETTINGS_NOT_FOUND':
      return 'Settings Not Found';
    case 'API_ERROR':
      return 'Server Error';
    case 'CREATE_ERROR':
      return 'Failed to Create Settings';
    case 'UPDATE_ERROR':
      return 'Failed to Update Settings';
    case 'UNKNOWN_ERROR':
      return 'Unexpected Error';
    default:
      return 'Settings Error';
  }
};

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getPageBreadcrumb } = useBreadcrumbNavigation();
  
  // Use the new settings hook
  const {
    settings,
    sensorSettings,
    offlineTimeout,
    isLoaded,
    isLoading,
    error,
    errorMessage,
    errorType,
    hasBackendSettings,
    updateSensorSettings,
    resetSettings: resetSettingsWithSync,
    clearError,
  } = useSettings();

  const [hasChanges, setHasChanges] = useState(false);

  // Get breadcrumb items
  const breadcrumbItems = getPageBreadcrumb('Settings', 'lucide:settings');

  const handleSensorTimeoutChange = async (value: string) => {
    const timeoutMinutes = parseInt(value, 10);
    
    try {
      await updateSensorSettings({
        offlineTimeoutMinutes: timeoutMinutes,
      });
      
      // Notify offline detection service to update timeouts
      offlineDetectionService.updateTimeoutSettings();
      setHasChanges(false); // Settings are saved automatically
    } catch (error) {

      // The error will be shown in the UI via the error state
    }
  };

  const handleResetSettings = async () => {
    try {
      await resetSettingsWithSync();
      
      // Notify offline detection service to update timeouts with default settings
      offlineDetectionService.updateTimeoutSettings();
      setHasChanges(false);
    } catch (error) {

      // The error will be shown in the UI via the error state
    }
  };

  const selectedTimeoutOption = TIMEOUT_OPTIONS.find(
    option => option.value === sensorSettings.offlineTimeoutMinutes
  );

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Header with Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <Breadcrumbs className="mb-2">
          {breadcrumbItems.map((item, index) => (
            <BreadcrumbItem 
              key={index}
              onPress={item.action}
              className={index === 0 ? "cursor-pointer hover:text-primary transition-colors" : ""}
              title={index === 0 ? `Go back to ${item.label}` : undefined}
            >
              <Icon icon={item.icon} className="w-4 h-4 mr-1" />
              {item.label}
            </BreadcrumbItem>
          ))}
        </Breadcrumbs>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-default-500 mt-1">
              Configure your IoT platform preferences and monitoring settings
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Backend Status Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 text-default-500">
                <Spinner size="sm" />
                <span className="text-sm">Syncing...</span>
              </div>
            )}
            
            {hasBackendSettings && !isLoading && (
              <Chip size="sm" variant="flat" color="success" startContent={<Icon icon="lucide:cloud-upload" className="w-3 h-3" />}>
                Cloud Synced
              </Chip>
            )}
            
            {!hasBackendSettings && !isLoading && errorType !== 'SETTINGS_NOT_FOUND' && (
              <Chip size="sm" variant="flat" color="warning" startContent={<Icon icon="lucide:hard-drive" className="w-3 h-3" />}>
                Local Storage
              </Chip>
            )}

            {!hasBackendSettings && !isLoading && errorType === 'SETTINGS_NOT_FOUND' && (
              <Chip size="sm" variant="flat" color="default" startContent={<Icon icon="lucide:cloud-off" className="w-3 h-3" />}>
                Not Created Yet
              </Chip>
            )}
            
            {hasChanges && (
              <div className="flex gap-2">
                <Button
                  variant="flat"
                  onPress={handleResetSettings}
                  size="sm"
                  startContent={<Icon icon="lucide:rotate-ccw" className="w-4 h-4" />}
                >
                  Reset
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert
            color={errorType === 'SETTINGS_NOT_FOUND' ? 'warning' : 'danger'}
            variant="flat"
            title={getErrorTitle(errorType)}
            description={errorMessage}
            startContent={
              <Icon 
                icon={errorType === 'SETTINGS_NOT_FOUND' ? 'lucide:info' : 'lucide:alert-circle'} 
                className="w-5 h-5" 
              />
            }
            endContent={
              <Button
                size="sm"
                variant="flat"
                onPress={clearError}
                isIconOnly
              >
                <Icon icon="lucide:x" className="w-4 h-4" />
              </Button>
            }
          />
        )}
      </div>

      {/* Settings Sections */}
      <div className="grid gap-6">
        {/* Sensor Settings */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon icon="lucide:activity" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Sensor Monitoring</h2>
                <p className="text-sm text-default-500">
                  Configure how sensors are monitored and when they're marked as offline
                </p>
              </div>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="gap-6">
            {/* Offline Timeout Setting */}
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-foreground">Offline Detection</h3>
                  <p className="text-sm text-default-500 mt-1">
                    Mark sensors as offline if no data is received for the selected duration
                  </p>
                </div>
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  startContent={<Icon icon="lucide:clock" className="w-3 h-3" />}
                >
                  Current: {selectedTimeoutOption?.label}
                </Chip>
              </div>

              <Select
                label="Offline Timeout"
                placeholder="Select timeout duration"
                selectedKeys={[sensorSettings.offlineTimeoutMinutes.toString()]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value) handleSensorTimeoutChange(value);
                }}
                className="max-w-md"
                size="sm"
                renderValue={() => {
                  if (selectedTimeoutOption) {
                    return `${selectedTimeoutOption.label} - ${selectedTimeoutOption.description}`;
                  }
                  return "Select timeout duration";
                }}
              >
                {TIMEOUT_OPTIONS.map((option) => (
                  <SelectItem key={option.value.toString()}>
                    {option.label} - {option.description}
                  </SelectItem>
                ))}
              </Select>

              {/* Info Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="lucide:info" className="w-5 h-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-primary mb-1">How offline detection works</h4>
                    <ul className="text-sm text-default-600 space-y-1">
                      <li>• Sensors are marked offline if no data is received within the timeout period</li>
                      <li>• Gateway disconnections immediately mark dependent sensors offline</li>
                      <li>• Multi-gateway sensors stay online if at least one gateway is connected</li>
                      <li>• Changes apply immediately to all monitoring processes</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Future Settings Sections */}
        <Card className="shadow-sm opacity-60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-default-100 rounded-lg">
                <Icon icon="lucide:bell" className="w-5 h-5 text-default-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-default-400">Notifications</h2>
                <p className="text-sm text-default-400">
                  Configure alerts and notification preferences
                </p>
              </div>
              <Chip size="sm" variant="flat" color="default">
                Coming Soon
              </Chip>
            </div>
          </CardHeader>
        </Card>

        <Card className="shadow-sm opacity-60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-default-100 rounded-lg">
                <Icon icon="lucide:palette" className="w-5 h-5 text-default-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-default-400">Appearance</h2>
                <p className="text-sm text-default-400">
                  Customize theme, colors, and display preferences
                </p>
              </div>
              <Chip size="sm" variant="flat" color="default">
                Coming Soon
              </Chip>
            </div>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};
