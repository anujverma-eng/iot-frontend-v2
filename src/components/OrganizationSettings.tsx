// src/components/OrganizationSettings.tsx
import React, { useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Select,
  SelectItem,
  Divider,
  Chip,
  Button,
  Spinner,
  Alert,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import { Icon } from '@iconify/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSettings } from '../hooks/useSettings';
import { usePermissions } from '../hooks/usePermissions';
import { offlineDetectionService } from '../services/offlineDetectionService';
import { PermissionWrapper } from './PermissionWrapper';
import { PermissionButton } from './PermissionButton';
import { getPermissionValue } from '../constants/permissions';

// Timeout options
const TIMEOUT_OPTIONS = [
  { value: 1, label: '1 minutes', description: 'Quick response detection ( for internal testing)' },
  { value: 5, label: '5 minutes', description: 'Quick response detection' },
  { value: 10, label: '10 minutes', description: 'Balanced monitoring' },
  { value: 30, label: '30 minutes', description: 'Standard intervals' },
  { value: 60, label: '1 hour', description: 'Extended tolerance' },
  { value: 300, label: '5 hours', description: 'Long-term monitoring' },
];

// Validation schema for organization name
const orgNameSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters long')
    .max(100, 'Organization name must be less than 100 characters'),
});

type OrgNameFormData = z.infer<typeof orgNameSchema>;

interface OrganizationSettingsProps {
  currentOrgName?: string;
  canRenameOrg?: boolean;
  onOrgRenamed?: (newName: string) => void;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({
  currentOrgName = '',
  canRenameOrg = false,
  onOrgRenamed,
}) => {
  const { hasPermission } = usePermissions();
  const {
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
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [updateError, setUpdateError] = useState('');

  // Modal controls
  const { isOpen: isRenameModalOpen, onOpen: onRenameModalOpen, onClose: onRenameModalClose } = useDisclosure();

  // Permission checks
  const canViewSettings = hasPermission(getPermissionValue('SETTINGS', 'VIEW'));
  const canUpdateOfflineTime = hasPermission(getPermissionValue('SETTINGS', 'UPDATE_SENSOR_OFFLINE_TIME'));
  const canRenameOrganization = hasPermission(getPermissionValue('SETTINGS', 'RENAME_ORG')) && canRenameOrg;

  // Form setup for rename
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<OrgNameFormData>({
    resolver: zodResolver(orgNameSchema),
    defaultValues: {
      name: currentOrgName,
    }
  });

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

  const handleSensorTimeoutChange = async (value: string) => {
    if (!canUpdateOfflineTime) {
      return;
    }

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
    if (!canUpdateOfflineTime) {
      return;
    }

    try {
      await resetSettingsWithSync();
      
      // Notify offline detection service to update timeouts with default settings
      offlineDetectionService.updateTimeoutSettings();
      setHasChanges(false);
    } catch (error) {
      // The error will be shown in the UI via the error state
    }
  };

  const handleOrgNameUpdate = async (data: OrgNameFormData) => {
    try {
      setIsUpdatingName(true);
      setUpdateError('');
      
      // Call the parent callback and wait for it to complete
      if (onOrgRenamed) {
        await onOrgRenamed(data.name.trim());
      }
      
      // Only close modal if the operation was successful
      onRenameModalClose();
      
    } catch (error: any) {
      setUpdateError(error.message || 'Failed to update organization name');
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleOpenRenameModal = () => {
    reset({ name: currentOrgName });
    setUpdateError('');
    onRenameModalOpen();
  };

  const selectedTimeoutOption = TIMEOUT_OPTIONS.find(
    option => option.value === sensorSettings.offlineTimeoutMinutes
  );

  if (!canViewSettings) {
    return (
      <div className="relative">
        <div className="filter blur-sm pointer-events-none">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon icon="lucide:settings" className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Organization Settings</h2>
                  <p className="text-sm text-default-500">
                    Configure organization-level settings and preferences
                  </p>
                </div>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="gap-6">
              <div className="space-y-4">
                <div className="p-4 border border-default-200 rounded-lg">
                  <div className="h-6 bg-default-200 rounded mb-2"></div>
                  <div className="h-4 bg-default-100 rounded w-3/4"></div>
                </div>
                <div className="p-4 border border-default-200 rounded-lg">
                  <div className="h-6 bg-default-200 rounded mb-2"></div>
                  <div className="h-4 bg-default-100 rounded w-2/3"></div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center bg-background/50">
          <Card className="shadow-lg">
            <CardBody className="text-center p-6">
              <Icon icon="lucide:lock" className="w-12 h-12 mx-auto text-warning mb-3" />
              <h3 className="text-lg font-semibold mb-2">Permission Required</h3>
              <p className="text-default-500">
                You don't have permission to view organization settings
              </p>
              <Chip color="warning" variant="flat" className="mt-2">
                settings.view required
              </Chip>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization Name Section */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon icon="lucide:building" className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Organization Name</h2>
                <p className="text-sm text-default-500">
                  Manage your organization's display name
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="flex items-center justify-between p-4 border border-default-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Icon icon="lucide:building" className="h-5 w-5 text-default-400" />
              <div>
                <p className="font-medium">{currentOrgName}</p>
                <p className="text-sm text-default-500">Current organization name</p>
              </div>
            </div>
            <PermissionWrapper permissions={[getPermissionValue('SETTINGS', 'RENAME_ORG')]}>
              <PermissionButton
                permission={getPermissionValue('SETTINGS', 'RENAME_ORG')}
                size="sm"
                variant="light"
                color="primary"
                onPress={handleOpenRenameModal}
                startContent={<Icon icon="lucide:edit" className="h-4 w-4" />}
                lockedTooltip="You need 'settings.rename_org' permission to rename the organization"
                isDisabled={isUpdatingName}
                isLoading={isUpdatingName}
              >
                Rename
              </PermissionButton>
            </PermissionWrapper>
          </div>
        </CardBody>
      </Card>

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

      {/* Sensor Monitoring Settings */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between w-full">
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
              
              {hasChanges && canUpdateOfflineTime && (
                <PermissionButton
                  permission={getPermissionValue('SETTINGS', 'UPDATE_SENSOR_OFFLINE_TIME')}
                  variant="flat"
                  onPress={handleResetSettings}
                  size="sm"
                  startContent={<Icon icon="lucide:rotate-ccw" className="w-4 h-4" />}
                  lockedTooltip="You need 'settings.update_sensor_offline_time' permission to reset settings"
                >
                  Reset
                </PermissionButton>
              )}
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

            <PermissionWrapper permissions={[getPermissionValue('SETTINGS', 'UPDATE_SENSOR_OFFLINE_TIME')]}>
              <Select
                label="Offline Timeout"
                placeholder="Select timeout duration"
                selectedKeys={[sensorSettings.offlineTimeoutMinutes.toString()]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value && canUpdateOfflineTime) handleSensorTimeoutChange(value);
                }}
                className="max-w-md"
                size="sm"
                isDisabled={!canUpdateOfflineTime}
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
            </PermissionWrapper>

            {!canUpdateOfflineTime && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="lucide:lock" className="w-5 h-5 text-warning mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-warning mb-1">Permission Required</h4>
                    <p className="text-sm text-warning/80">
                      You need 'settings.update_sensor_offline_time' permission to modify offline detection settings.
                    </p>
                  </div>
                </div>
              </div>
            )}

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

      {/* Rename Organization Modal */}
      <Modal 
        isOpen={isRenameModalOpen} 
        onClose={onRenameModalClose} 
        placement="center"
        isDismissable={!isUpdatingName}
        hideCloseButton={isUpdatingName}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <Icon icon="lucide:edit" className="h-5 w-5" />
              Rename Organization
            </div>
          </ModalHeader>
          
          <form onSubmit={handleSubmit(handleOrgNameUpdate)}>
            <ModalBody className="space-y-4">
              <p className="text-sm text-default-500">
                Enter a new name for your organization. This will be visible to all members.
              </p>
              
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    label="Organization Name"
                    placeholder="Enter organization name"
                    variant="bordered"
                    startContent={<Icon icon="lucide:building" className="text-default-400" />}
                    isInvalid={!!errors.name}
                    errorMessage={errors.name?.message}
                  />
                )}
              />

              {updateError && (
                <div className="flex items-center gap-2 text-danger text-sm">
                  <Icon icon="lucide:x-circle" className="h-4 w-4" />
                  <span>{updateError}</span>
                </div>
              )}
            </ModalBody>
            
            <ModalFooter>
              <Button
                variant="light"
                onPress={onRenameModalClose}
                isDisabled={isUpdatingName}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="primary"
                isLoading={isUpdatingName}
              >
                {isUpdatingName ? 'Renaming...' : 'Rename Organization'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
};