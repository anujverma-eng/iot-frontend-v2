import { Chip, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { clsx, type ClassValue } from "clsx";
import { motion } from "framer-motion";
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import { useAppSelector } from "../hooks/useAppDispatch";
import { selectPendingMyInvitationsCount } from "../store/invitesSlice";

interface SidebarItem {
  name: string;
  icon: string;
  path: string;
  badge?: string;
}

const sidebarItems: SidebarItem[] = [
  { name: "Home", icon: "lucide:home", path: "/dashboard/home" },
  { name: "Sensors", icon: "lucide:cpu", path: "/dashboard/sensors" },
  { name: "Gateways", icon: "lucide:router", path: "/dashboard/gateways" },
];

interface DashboardSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const DashboardSidebar = ({
  isOpen,
  onToggle,
  className,
}: DashboardSidebarProps) => {
  // Keeps behavior identical to your current approach
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const { pathname } = useLocation();
  const pendingMyInvitationsCount = useAppSelector(selectPendingMyInvitationsCount);

  const appPages: SidebarItem[] = [
    { name: "Notifications", icon: "lucide:bell-ring", path: "/dashboard/notifications" },
    {
      name: "Team",
      icon: "lucide:users",
      path: "/dashboard/team",
      badge: pendingMyInvitationsCount > 0 ? pendingMyInvitationsCount.toString() : undefined,
    },
    { name: "Settings", icon: "lucide:settings", path: "/dashboard/settings" },
  ];

  return (
    <>
      {/* mobile overlay */}
      <div
        onClick={onToggle}
        className={cn(
          "fixed inset-0 z-40 bg-[#020420]/60 backdrop-blur-sm transition-opacity lg:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />

      <motion.aside
        initial={false}
        animate={{
          x: isDesktop ? 0 : isOpen ? 0 : "-100%",
          width: isDesktop ? (isOpen ? "15rem" : "4.5rem") : "16rem",
        }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        data-collapsed={!isDesktop || !isOpen ? true : undefined}
        className={cn(
          "fixed top-0 left-0 z-50 flex h-screen flex-col box-border",
          // 1px divider, no shadow
          "border-r border-[#293278]/10 dark:border-white/10",
          // Background states
          isOpen
            ? "bg-[#293278] dark:bg-zinc-900"
            : "bg-[#293278]",
          className
        )}
      >
        {/* Brand */}
        <div className={cn("relative flex items-center justify-center", isOpen ? "h-20" : "h-20", "bg-none overflow-hidden")}>
          {/* Expanded logo */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center mt-3"
            initial={false}
            animate={{
              x: isOpen ? 0 : -56,     // move left when collapsing
              opacity: isOpen ? 1 : 0, // fade as it exits
            }}
            transition={{ duration: 0.6, ease: [0.5, 0, 0.1, 1] }}
          >
            <img
              src="https://motionics.com/downloads/images/liveaccess-by-motionics-logo-white.png"
              alt="LiveAccess by Motionics"
              className="h-10 w-auto"
            />
          </motion.div>

          {/* Collapsed mark */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center mt-3"
            initial={false}
            animate={{
              x: isOpen ? 56 : 0,      // move right when expanding
              opacity: isOpen ? 0 : 1, // fade as it exits/enters
            }}
            transition={{ duration: 0.5, ease: [0.5, 0, 0.1, 1] }}
          >
            <img
              src="https://motionics.com/downloads/images/liveaccess-node-logomark-white-web.png"
              alt="LiveAccess node"
              className="h-9 w-auto"
            />
          </motion.div>
        </div>

        {/* Links scroll area */}
        <div className="flex-1 overflow-y-auto">
          <nav className="flex flex-col gap-1 px-2 py-3">
            {sidebarItems.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                isOpen={isOpen}
                active={pathname.startsWith(item.path)}
              />
            ))}

            {/* Only render label when expanded so it doesn't push content down */}
            {isOpen && (
              <p className="mt-5 mb-1 px-3 text-[10px] font-semibold tracking-wider text-default-400">
                MANAGEMENT
              </p>
            )}

            {appPages.map((item) => (
              <NavItem
                key={item.path}
                item={item}
                isOpen={isOpen}
                active={pathname.startsWith(item.path)}
              />
            ))}
          </nav>
        </div>
      </motion.aside>
    </>
  );
};

function NavItem({
  item,
  isOpen,
  active,
}: {
  item: SidebarItem;
  isOpen: boolean;
  active: boolean;
}) {
  const isCollapsed = !isOpen;

  return (
    <Tooltip content={item.name} placement="right" isDisabled={isOpen}>
      <Link
        to={item.path}
        className={cn(
          "relative rounded-lg transition-colors",
          "flex items-center w-full",
          // Layout
          isOpen ? "gap-3 px-3 py-3 justify-start" : "p-3 justify-center",
          // Colors
          isCollapsed
            ? "text-white hover:bg-black/50"
            : "text-white hover:bg-black/50",
          // Active background
          active && (isCollapsed ? "bg-black/50" : "bg-black/50" ),
          // Active indicator (optional): keep it thin and not affecting centering
          active &&
          (isOpen
            ? "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[6px] before:rounded-l-lg before:bg-primary"
            : "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[6px] before:rounded-l-lg before:bg-primary")
        )}
      >
        <Icon
          icon={item.icon}
          className={cn(
            "h-5 w-5 flex-shrink-0",active
          ? "text-white"
          : isOpen
          ? "text-white"
          : "text-white"
      )}
        />

        {/* Remove from layout when collapsed */}
        {isOpen && (
          <span className={cn("flex-1 whitespace-nowrap text-sm", active ? "font-medium" : "")}>
            {item.name}
          </span>
        )}

        {/* Remove badge from layout when collapsed */}
        {isOpen && item.badge && (
          <Chip size="sm" variant="flat" color="primary" className="flex-shrink-0">
            {item.badge}
          </Chip>
        )}
      </Link>
    </Tooltip>
  );
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}