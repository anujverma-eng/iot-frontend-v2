import React, { useEffect } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Chip,
  Spinner,
  addToast,
  Breadcrumbs,
  BreadcrumbItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { useBreadcrumbNavigation } from "../hooks/useBreadcrumbNavigation";
import { OrganizationPreferences } from "../components/OrganizationPreferences";
import { OrganizationSettings } from "../components/OrganizationSettings";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { fetchProfile } from "../store/profileSlice";
import { selectActiveOrgId, selectActiveOrgName, selectActiveOrgStatus, setOrgName } from "../store/activeOrgSlice";
import { OrgService } from "../api/org.service";
import { UserRole } from "../types/User";
import { motion } from "framer-motion";
import { useBreakpoints } from "../hooks/use-media-query";
import { extractErrorMessage, extractErrorStatus } from "../utils/errorUtils";

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { getPageBreadcrumb } = useBreadcrumbNavigation();
  const profile = useAppSelector((state) => state.profile);

  // Get currently active organization from activeOrg slice
  const activeOrgId = useAppSelector(selectActiveOrgId);
  const activeOrgName = useAppSelector(selectActiveOrgName);
  const activeOrgStatus = useAppSelector(selectActiveOrgStatus);

  // Get current organization membership details from profile
  const userMemberships = profile.data?.memberships || [];
  const currentOrgMembership = userMemberships.find((m) => m.orgId === activeOrgId);

  // Check if user can rename the organization
  const canRenameOrg = currentOrgMembership?.role === UserRole.OWNER || currentOrgMembership?.role === UserRole.ADMIN;

  // Get breadcrumb items
  const breadcrumbItems = getPageBreadcrumb("Settings", "lucide:settings");

  // Load profile data on mount
  useEffect(() => {
    if (!profile.loaded) {
      dispatch(fetchProfile());
    }
  }, [dispatch, profile.loaded]);

  const { isMobile } = useBreakpoints();

  // Handle organization rename callback
  const handleOrgRenamed = async (newName: string) => {
    try {
      if (!activeOrgId) {
        const error = new Error("No organization selected");
        addToast({
          title: "Error",
          description: error.message,
          color: "danger",
        });
        throw error;
      }

      await OrgService.updateName(activeOrgId, {
        name: newName.trim(),
      });

      // Update both profile data AND activeOrg slice
      await dispatch(fetchProfile()).unwrap();
      dispatch(setOrgName(newName.trim()));

      addToast({
        title: "Organization Renamed",
        description: `Organization name updated to "${newName}"`,
        color: "success",
      });
    } catch (error: any) {
      console.error("Organization rename error:", error);

      let errorMessage = "Failed to update organization name";

      // Handle specific error cases
      const status = extractErrorStatus(error);
      if (status === 403) {
        errorMessage = "Access denied. You don't have permission to rename this organization.";
      } else if (status === 400) {
        // Handle validation errors (these have a special structure)
        const validationData = error.response?.data?.data;
        if (validationData?.name) {
          errorMessage = validationData.name[0];
        } else {
          errorMessage = extractErrorMessage(error, "Validation failed");
        }
      } else {
        errorMessage = extractErrorMessage(error, errorMessage);
      }

      addToast({
        title: "Rename Failed",
        description: errorMessage,
        color: "danger",
      });

      throw new Error(errorMessage);
    }
  };

  if (profile.loading || !profile.loaded || activeOrgStatus === "resolving") {
    return (
      <div className="flex justify-center items-center min-h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 max-w-8xl mx-auto">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-2xl sm:text-3xl font-bold ${
                isMobile
                  ? "mb-3 px-1" // Mobile: reduced margin and padding
                  : "mb-4 sm:mb-6 px-2 sm:px-0" // Desktop: normal spacing
              }`}
            >
              Settings
            </motion.h1>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="grid gap-4">
        {/* Organization Preferences Section */}

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Organization</h2>
              <p className="text-sm text-default-500">To manage a different organization, use the organization selector in the top navigation bar</p>
            </div>
          </div>
          <Chip size="sm" variant="flat" color="primary">
            Managing settings for: <strong className="ml-1">{activeOrgName}</strong>
          </Chip>
        </div>
        {/* Organization Settings (Rename + Sensor Monitoring) */}
        <OrganizationSettings
          currentOrgName={activeOrgName || ""}
          canRenameOrg={canRenameOrg}
          currentRole={currentOrgMembership?.role || "MEMBER"}
          onOrgRenamed={handleOrgRenamed}
        />

        {/* Current Organization Info */}
        {/* <div className="flex items-center justify-between p-2 border border-default-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon icon="lucide:building" className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium text-primary">{activeOrgName}</p>
                  <p className="text-sm text-default-500">Current organization name</p>
                </div>
              </div>
              <Chip
                color="primary"
                size="sm"
                variant="flat"
                startContent={<Icon icon="lucide:check-circle" className="h-3 w-3" />}
              >
                Active
              </Chip>
            </div> */}

        {/* User Role Section */}
        {/* <div className="flex items-center justify-between p-2 border border-default-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Icon icon="lucide:user-check" className="h-5 w-5 text-default-400" />
                <div>
                  <p className="font-medium">{currentOrgMembership?.role || "MEMBER"}</p>
                  <p className="text-sm text-default-500">Your role in this organization</p>
                </div>
              </div>
              <Chip
                color={currentOrgMembership?.role === UserRole.OWNER ? "success" : "primary"}
                size="sm"
                variant="flat"
              >
                {currentOrgMembership?.role === UserRole.OWNER ? "Full Access" : "Limited Access"}
              </Chip>
            </div> */}

        {/* Personal Organization Preferences (for multi-org users) */}
        {/* <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <Icon icon="lucide:users" className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Multi-Organization Preferences</h2>
                <p className="text-sm text-default-500">Manage how you interact with multiple organizations</p>
              </div>
            </div>
          </CardHeader>
          <Divider />
          <CardBody className="gap-6">
            <OrganizationPreferences />
          </CardBody>
        </Card> */}
        {/* <OrganizationPreferences /> */}
        {/* Permission Notice */}
        {!canRenameOrg && (
          <Card className="shadow-sm border border-warning/20">
            <CardBody>
              <div className="flex items-center gap-3 text-warning">
                <Icon icon="lucide:info" className="h-5 w-5" />
                <div>
                  <p className="font-medium">Limited Access</p>
                  <p className="text-sm">
                    You need OWNER or ADMIN role to rename this organization. Contact your organization administrator
                    for access.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Future Settings Sections */}
        {/* <Card className="shadow-sm opacity-60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-default-100 rounded-lg">
                <Icon icon="lucide:bell" className="w-5 h-5 text-default-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-default-400">Notifications</h2>
                <p className="text-sm text-default-400">Configure alerts and notification preferences</p>
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
                <p className="text-sm text-default-400">Customize theme, colors, and display preferences</p>
              </div>
              <Chip size="sm" variant="flat" color="default">
                Coming Soon
              </Chip>
            </div>
          </CardHeader>
        </Card> */}
      </div>
    </div>
  );
};
