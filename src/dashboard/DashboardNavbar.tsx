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
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { cn } from "../lib/utils";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { logout } from "../store/authSlice";

interface DashboardNavbarProps {
  onMenuToggle: () => void;
  className?: string;
}

export const DashboardNavbar = ({ onMenuToggle, className }: DashboardNavbarProps) => {
  const dispatch = useAppDispatch();
  const handleMenuAction = (key: React.Key) => key === "logout" && dispatch(logout());

  const profile = useAppSelector((s) => s.profile);
  const orgDetails = useAppSelector((s) => s.org);

  // show skeleton until both slices have loaded
  const isBusy = profile.loading || orgDetails.loading || !profile.loaded || !orgDetails.loaded;

  const userEmail = profile.data?.email ?? "";
  const orgName = orgDetails.data?.name ?? "";

  /* Avatar fallback: first letter of e‑mail or a user icon  */
  const avatarFallback =
    userEmail && !isBusy ? userEmail.charAt(0).toUpperCase() : <Icon icon="lucide:user" className="text-blue-400" />;

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

      <NavbarContent className="hidden sm:flex flex-1" justify="center">
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
      </NavbarContent>

      <NavbarContent justify="end" className="gap-3">
        {/* <Button isIconOnly variant="light" size="sm" className="text-default-500">
          <Icon icon="lucide:type" className="h-5 w-5" />
        </Button>
        <Button isIconOnly variant="light" size="sm" className="text-default-500">
          <Icon icon="lucide:sun" className="h-5 w-5" />
        </Button>
        <Button isIconOnly variant="light" size="sm" className="text-default-500">
          <Icon icon="lucide:layout-grid" className="h-5 w-5" />
        </Button> */}
        <Dropdown placement="bottom-end">
          <DropdownTrigger>
            <Button isIconOnly variant="light" size="sm" className="text-default-500" radius="full">
              <Icon icon="lucide:bell" className="h-5 w-5" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Notifications" className="w-80">
            <DropdownItem key="title" className="h-14 gap-2">
              <div className="flex justify-between w-full">
                <p className="font-semibold">Notifications</p>
                <Chip size="sm" variant="flat" color="primary">
                  8 New
                </Chip>
              </div>
            </DropdownItem>
            {/* Add notification items here */}
          </DropdownMenu>
        </Dropdown>

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
                  <p className="font-semibold truncate max-w-[14rem]">{orgName || "—"}</p>
                  <p className="font-normal text-default-500 text-tiny truncate max-w-[14rem]">{userEmail}</p>
                </div>
              )}
            </DropdownItem>
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
    </Navbar>
  );
};
