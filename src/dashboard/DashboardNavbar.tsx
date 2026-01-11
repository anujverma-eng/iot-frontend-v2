import React from "react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  Input,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Avatar,
  Chip,
  Skeleton,
  Tooltip,
  useDisclosure,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { cn } from "../lib/utils";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { logout } from "../store/authSlice";
import { selectIsLiveMode, selectIsConnecting, toggleLiveMode } from "../store/liveDataSlice";
import { selectIsCompareMode } from "../store/telemetrySlice";
import { selectActiveOrgName, selectActiveOrgStatus } from "../store/activeOrgSlice";
import { OrgSelector } from "../components/OrgSelector";
import { CreateOrganizationModal } from "../components/CreateOrganizationModal";
import { canUserCreateOrganization } from "../utils/organizationUtils";
import { useNavigate } from "react-router-dom";
import { PermissionButton } from "../components/PermissionButton";
import { getPermissionValue } from "../constants/permissions";

interface DashboardNavbarProps {
  onMenuToggle: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const DashboardNavbar = ({ onMenuToggle, className, style }: DashboardNavbarProps) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const {
    isOpen: isCreateOrgModalOpen,
    onOpen: onCreateOrgModalOpen,
    onClose: onCreateOrgModalClose,
  } = useDisclosure();

  const handleMenuAction = (key: React.Key) => {
    if (key === "logout") {
      dispatch(logout());
    } else if (key === "settings") {
      navigate("/dashboard/settings");
    } else if (key === "create_org") {
      onCreateOrgModalOpen();
    } else if (key === "profile_page") {
      navigate("/dashboard/profile");
    }
  };

  const profile = useAppSelector((s) => s.profile);
  const activeOrgName = useAppSelector(selectActiveOrgName);
  const activeOrgStatus = useAppSelector(selectActiveOrgStatus);
  const isLiveMode = useAppSelector(selectIsLiveMode);
  const isConnecting = useAppSelector(selectIsConnecting);
  const isCompareMode = useAppSelector(selectIsCompareMode);

  // Check if user can create organization
  const memberships = profile.data?.memberships || [];
  const userCanCreateOrg = canUserCreateOrganization(memberships);

  // show skeleton until profile has loaded and org is ready
  const isBusy = profile.loading || !profile.loaded || activeOrgStatus === "resolving";

  const userEmail = profile.data?.user.email ?? "";

  /* Avatar fallback: first letter of e‑mail or a user icon  */
  const avatarFallback =
    userEmail && !isBusy ? userEmail.charAt(0).toUpperCase() : <Icon icon="lucide:user" className="text-blue-400" />;

  const handleLiveModeToggle = () => {
    dispatch(toggleLiveMode({ enable: !isLiveMode }));
  };

  return (
    <Navbar
      isBordered={false}
      isBlurred
      className={cn(
        "top-0 w-full z-40 bg-background/70 backdrop-blur-xl h-16 border-none shadow-md",
        "lg:pl-64",
        "[data-collapsed=true]&:lg:pl-16",
        "max-lg:pl-0",
        className
      )}
      style={style}
      maxWidth="full"
    >
      <NavbarContent justify="start">
        <Button
          isIconOnly
          variant="light"
          size="sm"
          onPress={onMenuToggle}
          className="transition-transform hover:scale-105 active:scale-95"
        >
          <Icon icon="lucide:menu" className="h-5 w-5" />
        </Button>
      </NavbarContent>

      {/* <NavbarContent className="hidden sm:flex flex-1" justify="center">
        <Input
          classNames={{
            base: "max-w-full sm:max-w-[30rem] h-10",
            mainWrapper: "h-full",
            input: "text-small",
            inputWrapper:
              "h-full font-normal bg-default-100/50 dark:bg-default-100/20 hover:bg-default-100/70 dark:hover:bg-default-100/30 group-data-[focused=true]:bg-default-100 dark:group-data-[focused=true]:bg-default-100/30",
          }}
          placeholder="Search [CTRL + K]"
          size="sm"
          startContent={<Icon icon="lucide:search" className="text-default-400" />}
          type="search"
        />
      </NavbarContent> */}

      <NavbarContent justify="end" className="gap-3">
        {/* Organization Selector */}
        <OrgSelector />

        {/* Real-time mode indicator */}
        {/* Live mode controls - Hidden in compare mode */}
        {!isCompareMode && (
          <>
            <Tooltip
              content={
                isConnecting
                  ? "Connecting to live data..."
                  : isLiveMode
                    ? "Live mode is active - Click to disable"
                    : "Live mode is disabled - Click to enable"
              }
            >
              <PermissionButton
                permission={getPermissionValue('SENSORS', 'LIVE')}
                isIconOnly
                size="sm"
                variant="flat"
                color={isLiveMode ? "success" : "default"}
                onPress={handleLiveModeToggle}
                isLoading={isConnecting}
                className={cn("transition-all duration-200", isLiveMode && "animate-pulse")}
                lockedTooltip="You need 'sensors.live' permission to control live mode"
              >
                {isConnecting ? (
                  <Icon icon="lucide:loader-2" className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon icon={isLiveMode ? "lucide:radio" : "lucide:wifi-off"} className="h-4 w-4" />
                )}
              </PermissionButton>
            </Tooltip>

            {/* Live mode status chip */}
            <Chip
              size="sm"
              variant="flat"
              color={isLiveMode ? "success" : "default"}
              startContent={<Icon icon={isLiveMode ? "lucide:activity" : "lucide:pause"} className="h-3 w-3" />}
              className={cn("transition-all duration-200", isLiveMode && "animate-pulse")}
            >
              {isConnecting ? "Connecting..." : isLiveMode ? "LIVE" : "OFFLINE"}
            </Chip>
          </>
        )}
        {/* <Button isIconOnly variant="light" size="sm" className="text-default-500">
          <Icon icon="lucide:type" className="h-5 w-5" />
        </Button>
        <Button isIconOnly variant="light" size="sm" className="text-default-500">
          <Icon icon="lucide:sun" className="h-5 w-5" />
        </Button>
        <Button isIconOnly variant="light" size="sm" className="text-default-500" radius="full">
          <Icon icon="lucide:layout-grid" className="h-5 w-5" />
        </Button> */}
        <Button 
          isIconOnly 
          variant="light" 
          size="sm" 
          className="text-default-500" 
          radius="full"
          onPress={() => navigate('/dashboard/notifications')}
        >
          <Icon icon="lucide:bell" className="h-5 w-5" />
        </Button>

        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Avatar isBordered as="button" size="sm" className="transition-transform">
              {avatarFallback}
            </Avatar>
            {/* {isBusy ? (
              <Skeleton className="rounded-full w-8 h-8" />
            ) : (
            )} */}
          </DropdownTrigger>
          <DropdownMenu aria-label="Profile Actions" variant="flat" onAction={handleMenuAction}>
            <DropdownItem
              key="profile"
              className="h-14 bg-blue-100 gap-2 cursor-default pointer-events-none opacity-100"
              isDisabled={true}
            >
              {isBusy ? (
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ) : (
                <div className="flex flex-col">
                  <p className="font-semibold truncate max-w-[14rem]">{activeOrgName || "—"}</p>
                  <p className="font-normal text-default-500 text-tiny truncate max-w-[14rem]">{userEmail}</p>
                </div>
              )}
            </DropdownItem>
            {userCanCreateOrg ? (
              <DropdownItem key="create_org" color="primary" startContent={<Icon icon="lucide:plus" />}>
                <span className="relative z-10 font-medium">Create Organization</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12" />
              </DropdownItem>
            ) : null}
            <DropdownItem key="profile_page" startContent={<Icon icon="lucide:user" />}>
              My Profile
            </DropdownItem>
            <DropdownItem key="settings" startContent={<Icon icon="lucide:settings" />}>
              Settings
            </DropdownItem>
            <DropdownItem key="billing" startContent={<Icon icon="lucide:credit-card" />}>
              Billing
            </DropdownItem>
            <DropdownItem key="help" startContent={<Icon icon="lucide:help-circle" />}>
              Help & Feedback
            </DropdownItem>
            <DropdownItem key="logout" color="danger" startContent={<Icon icon="lucide:log-out" />}>
              Log Out
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </NavbarContent>

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={isCreateOrgModalOpen}
        onClose={onCreateOrgModalClose}
        onSuccess={() => {
          // You can add toast notification here
        }}
      />
    </Navbar>
  );
};
