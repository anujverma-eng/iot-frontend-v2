import { Chip, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { clsx, type ClassValue } from "clsx";
import { motion } from "framer-motion";
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
  // {
  //   name: "Overview",
  //   icon: "lucide:layout-dashboard",
  //   path: "/dashboard",
  //   badge: "New",
  // },
  {
    name: "Home",
    icon: "lucide:home",
    path: "/dashboard/home",
  },
  // {
  //   name: "Dashboard",
  //   icon: "lucide:bar-chart-2",
  //   path: "/dashboard/panel",
  // },
  // {
  //   name: "Monitoring",
  //   icon: "lucide:activity",
  //   path: "/dashboard/monitoring",
  //   badge: "Live",
  // },
  {
    name: "Sensors",
    icon: "lucide:cpu",
    path: "/dashboard/sensors",
  },
  {
    name: "Gateways",
    icon: "lucide:router",
    path: "/dashboard/gateways",
  },
];

interface DashboardSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const DashboardSidebar = ({ isOpen, onToggle, className }: DashboardSidebarProps) => {
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const { pathname } = useLocation();
  const pendingMyInvitationsCount = useAppSelector(selectPendingMyInvitationsCount);

  // Create dynamic appPages with live invitation count
  const appPages = [
      {
    name: "Notifications",
    icon: "lucide:bell-ring",
    path: "/dashboard/notifications",
  },
    // {
    //   name: "Reports",
    //   icon: "lucide:file-text",
    //   path: "/dashboard/reports",
    // },
    {
      name: "Team",
      icon: "lucide:users",
      path: "/dashboard/team",
      badge: pendingMyInvitationsCount > 0 ? pendingMyInvitationsCount.toString() : undefined,
    },
    {
      name: "Settings",
      icon: "lucide:settings",
      path: "/dashboard/settings",
    },
  ];
  return (
    <>
      <div
        onClick={onToggle}
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />
      {/* rail */}
      <motion.aside
        initial={false}
        /* ✨ 1A – do TWO things when we change state
         - translate on mobile
         - resize on desktop
  ------------------------------------------------------------------------- */
        animate={{
          x: isDesktop ? 0 : isOpen ? 0 : "-100%", // slide in/out on mobile
          width: isDesktop
            ? isOpen
              ? "16rem"
              : "4.5rem" // rail vs drawer on desktop
            : "16rem", // mobile drawer width
        }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        /* ✨ 1B – an attribute to let the navbar know when we are in rail mode */
        data-collapsed={!isDesktop || !isOpen ? true : undefined}
        className={cn(
          "box-border",
          "fixed top-0 left-0 z-50 flex h-screen flex-col shadow-md",
          /* glass effect only for the wide drawer */
          isOpen ? "bg-white/80 dark:bg-zinc-900/70 backdrop-blur-md" : "bg-[#353f8b]",
          className
        )}
      >
        {/* ─── brand bar ───────── */}
        <div 
          className="flex flex-col items-center justify-center bg-[#353f8b]/100 rounded-br-lg overflow-hidden relative"
          style={{ height: "5.5rem" }}
        >
          {/* Full logo - only visible when expanded, fades AFTER collapse completes */}
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center"
            initial={false}
            animate={{
              opacity: isOpen ? 1 : 0,
            }}
            transition={{ 
              duration: 0.2, 
              ease: [0.4, 0, 0.2, 1],
              // When expanding: wait for sidebar to open first
              // When collapsing: fade out immediately
              delay: isOpen ? 0.25 : 0,
            }}
          >
            <img
              src="https://motionics.com/wp-content/uploads/2019/07/Motionics-logo-2.png"
              alt="Motionics"
              className="h-10 w-auto mb-1"
            />
            <span className="text-white/90 text-xs font-medium tracking-wide">IOT Platform</span>
          </motion.div>
          
          {/* Collapsed icon - fades in ONLY after collapse completes */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={false}
            animate={{
              opacity: isOpen ? 0 : 1,
            }}
            transition={{ 
              duration: 0.2, 
              ease: [0.4, 0, 0.2, 1],
              // When collapsing: wait for sidebar to close first (300ms)
              // When expanding: fade out immediately
              delay: isOpen ? 0 : 0.3,
            }}
          >
            <Icon icon="lucide:cloud" className="h-7 w-7 text-white/90" />
          </motion.div>
        </div>

        {/* ─── navigation links ────────────────────────────────── */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto py-4 px-2">
          {/* primary links */}
          {sidebarItems.map((i) => (
            <NavItem key={i.path} item={i} isOpen={isOpen} active={pathname.startsWith(i.path)} onSelect={onToggle} />
          ))}

          {/* section label - opacity controlled */}
          <p 
            className={cn(
              "mt-4 mb-1 px-4 text-[10px] font-semibold tracking-wide text-default-400 whitespace-nowrap",
              isOpen ? "opacity-100" : "opacity-0"
            )}
            style={{
              transition: "opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            MANAGEMENT
          </p>

          {/* secondary links */}
          {appPages.map((i) => (
            <NavItem key={i.path} item={i} isOpen={isOpen} active={pathname.startsWith(i.path)} onSelect={onToggle} />
          ))}

          {/* spacer */}
          <div className="flex-1" />

          {/* collapse / expand - styled like NavItem */}
          <Tooltip content={isOpen ? "Collapse" : "Expand"} placement="right" isDisabled={isOpen}>
            <button
              onClick={onToggle}
              className={cn(
                "relative flex items-center rounded-lg py-2.5 px-3 gap-3 w-full",
                isOpen 
                  ? "text-default-600 hover:bg-default-100" 
                  : "text-white hover:bg-white/10"
              )}
            >
              {/* Icon */}
              <Icon
                icon={isOpen ? "lucide:panel-left-close" : "lucide:panel-left-open"}
                className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isOpen ? "text-default-500" : "text-white/100"
                )}
              />
              
              {/* Text */}
              <span 
                className={cn(
                  "whitespace-nowrap flex-1 text-left text-sm",
                  isOpen ? "opacity-100" : "opacity-0"
                )}
                style={{
                  transition: "opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              >
                Collapse sidebar
              </span>
            </button>
          </Tooltip>
        </nav>
      </motion.aside>
    </>
  );
};

function NavItem({
  item,
  isOpen,
  active,
  onSelect,
}: {
  item: SidebarItem;
  isOpen: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  const { pathname } = useLocation();
  const isActive = pathname.startsWith(item.path);
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;

  return (
    <Tooltip content={item.name} placement="right" isDisabled={isOpen}>
      <Link
        to={item.path}
        className={cn(
          "relative flex items-center rounded-lg py-2.5 px-3 gap-3",
          active 
            ? "bg-primary/15 text-primary-400" 
            : isOpen 
              ? "text-default-600 hover:bg-default-100" 
              : "text-white hover:bg-white/10",
          // Active indicator pill
          active && "before:absolute before:inset-y-1 before:w-1.5 before:rounded-r-lg",
          active && (isOpen ? "before:left-0 before:bg-primary" : "before:left-1 before:bg-white/100")
        )}
        onClick={() => {
          if (!isDesktop || isOpen) {
            // onSelect();
          }
        }}
      >
        {/* Icon - always visible */}
        <Icon
          icon={item.icon}
          className={cn(
            "h-5 w-5 flex-shrink-0",
            isActive ? "text-primary-400" : isOpen ? "text-default-500" : "text-white/100"
          )}
        />
        
        {/* Text - space preserved, opacity controlled */}
        <span
          className={cn(
            "whitespace-nowrap flex-1",
            isActive ? "font-medium" : "",
            isOpen ? "opacity-100" : "opacity-0"
          )}
          style={{
            transition: "opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {item.name}
        </span>
        
        {/* Badge - opacity controlled */}
        {item.badge && (
          <Chip
            size="sm"
            variant="flat"
            color={item.badge === "Live" ? "success" : "primary"}
            className={cn(
              "animate-pulse flex-shrink-0",
              isOpen ? "opacity-100" : "opacity-0"
            )}
            style={{
              transition: "opacity 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
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
