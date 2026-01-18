// src/components/OrganizationSettings.tsx
import React, { useState } from "react";
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
  Tooltip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSettings } from "../hooks/useSettings";
import { usePermissions } from "../hooks/usePermissions";
import { offlineDetectionService } from "../services/offlineDetectionService";
import { PermissionWrapper } from "./PermissionWrapper";
import { PermissionButton } from "./PermissionButton";
import { getPermissionValue } from "../constants/permissions";
import { extractErrorMessage } from "../utils/errorUtils";

// Timeout options
const TIMEOUT_OPTIONS = [
  // { value: 1, label: '1 minutes', description: 'Quick response detection ( for internal testing)' },
  { value: 5, label: "5 minutes", description: "Quick response detection" },
  { value: 10, label: "10 minutes", description: "Balanced monitoring" },
  { value: 30, label: "30 minutes", description: "Standard intervals" },
  { value: 60, label: "1 hour", description: "Extended tolerance" },
  { value: 300, label: "5 hours", description: "Long-term monitoring" },
];

// Validation schema for organization name
const orgNameSchema = z.object({
  name: z
    .string()
    .min(2, "Organization name must be at least 2 characters long")
    .max(100, "Organization name must be less than 100 characters"),
});

type OrgNameFormData = z.infer<typeof orgNameSchema>;

interface OrganizationSettingsProps {
  currentOrgName?: string;
  canRenameOrg?: boolean;
  currentRole?: string;
  onOrgRenamed?: (newName: string) => void;
}

export const OrganizationSettings: React.FC<OrganizationSettingsProps> = ({
  currentOrgName = "",
  canRenameOrg = false,
  currentRole,
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
  const [updateError, setUpdateError] = useState("");

  // Modal controls
  const { isOpen: isRenameModalOpen, onOpen: onRenameModalOpen, onClose: onRenameModalClose } = useDisclosure();

  // Permission checks
  const canViewSettings = hasPermission(getPermissionValue("SETTINGS", "VIEW"));
  const canUpdateOfflineTime = hasPermission(getPermissionValue("SETTINGS", "UPDATE_SENSOR_OFFLINE_TIME"));
  const canRenameOrganization = hasPermission(getPermissionValue("SETTINGS", "RENAME_ORG")) && canRenameOrg;

  // Form setup for rename
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrgNameFormData>({
    resolver: zodResolver(orgNameSchema),
    defaultValues: {
      name: currentOrgName,
    },
  });

  // Helper function to get user-friendly error titles
  const getErrorTitle = (errorType: string | undefined): string => {
    switch (errorType) {
      case "SETTINGS_NOT_FOUND":
        return "Settings Not Found";
      case "API_ERROR":
        return "Server Error";
      case "CREATE_ERROR":
        return "Failed to Create Settings";
      case "UPDATE_ERROR":
        return "Failed to Update Settings";
      case "UNKNOWN_ERROR":
        return "Unexpected Error";
      default:
        return "Settings Error";
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
      setUpdateError("");

      // Call the parent callback and wait for it to complete
      if (onOrgRenamed) {
        await onOrgRenamed(data.name.trim());
      }

      // Only close modal if the operation was successful
      onRenameModalClose();
    } catch (error: any) {
      setUpdateError(extractErrorMessage(error, "Failed to update organization name"));
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleOpenRenameModal = () => {
    reset({ name: currentOrgName });
    setUpdateError("");
    onRenameModalOpen();
  };

  const selectedTimeoutOption = TIMEOUT_OPTIONS.find((option) => option.value === sensorSettings.offlineTimeoutMinutes);

  if (!canViewSettings) {
    return (
      <div className="relative">
        <div className="filter blur-sm pointer-events-none">
          <Card className="shadow-sm">
            <CardBody className="gap-4">
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
              <p className="text-default-500">You don't have permission to view organization settings</p>
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
    <div className="space-y-4">
      {/* Organization Name and Role Section */}
      <div className="border border-default-200 rounded-lg divide-y divide-default-200">
        {/* Organization Name */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Icon icon="lucide:building" className="h-5 w-5 text-primary" />
            <p className="font-medium">{currentOrgName}</p>
          </div>
          <PermissionWrapper permissions={[getPermissionValue("SETTINGS", "RENAME_ORG")]}>
            <PermissionButton
              permission={getPermissionValue("SETTINGS", "RENAME_ORG")}
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

        {/* Role */}
        <div className="flex items-center gap-3 p-4">
          <Icon icon="lucide:user-check" className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium capitalize">{currentRole || "Member"}</p>
            <p className="text-sm text-default-500">Your role in this organization. Roles can be updated on the Team page</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          color={errorType === "SETTINGS_NOT_FOUND" ? "warning" : "danger"}
          variant="flat"
          title={getErrorTitle(errorType)}
          description={errorMessage}
          startContent={
            <Icon
              icon={errorType === "SETTINGS_NOT_FOUND" ? "lucide:info" : "lucide:alert-circle"}
              className="w-5 h-5"
            />
          }
          endContent={
            <Button size="sm" variant="flat" onPress={clearError} isIconOnly>
              <Icon icon="lucide:x" className="w-4 h-4" />
            </Button>
          }
        />
      )}

      {/* Sensor Monitoring Settings */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Sensors</h2>
        
        <div className="flex flex-col gap-4 border border-default-200 p-4 rounded-lg">
          <div>
            <h3 className="font-semibold text-foreground mb-3">Offline detection after:</h3>
            
            <PermissionWrapper permissions={[getPermissionValue("SETTINGS", "UPDATE_SENSOR_OFFLINE_TIME")]}>
              <Select
                placeholder="Select timeout duration"
                selectedKeys={[sensorSettings.offlineTimeoutMinutes.toString()]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  if (value && canUpdateOfflineTime) handleSensorTimeoutChange(value);
                }}
                className="w-full"
                size="md"
                isDisabled={!canUpdateOfflineTime}
                renderValue={() => {
                  if (selectedTimeoutOption) {
                    return `${selectedTimeoutOption.label}`;
                  }
                  return "Select timeout duration";
                }}
              >
                {TIMEOUT_OPTIONS.map((option) => (
                  <SelectItem key={option.value.toString()}>{option.label}</SelectItem>
                ))}
              </Select>
            </PermissionWrapper>
          </div>

          <ul className="text-sm text-default-600 space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-default-400">•</span>
              <span>Mark sensors as offline if no data is received for the selected duration</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-default-400">•</span>
              <span>Sensors connected to multiple gateways stay online if connected to at least one gateway</span>
            </li>
          </ul>

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
        </div>
      </div>

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
              <Button variant="light" onPress={onRenameModalClose} isDisabled={isUpdatingName}>
                Cancel
              </Button>
              <Button type="submit" color="primary" isLoading={isUpdatingName}>
                {isUpdatingName ? "Renaming..." : "Rename Organization"}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
};
