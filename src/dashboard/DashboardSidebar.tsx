import { Button, Chip, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { clsx, type ClassValue } from "clsx";
import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { twMerge } from "tailwind-merge";

interface SidebarItem {
  name: string;
  icon: string;
  path: string;
  badge?: string;
}

const sidebarItems: SidebarItem[] = [
  {
    name: "Overview",
    icon: "lucide:layout-dashboard",
    path: "/dashboard",
    badge: "New",
  },
  {
    name: "Analytics",
    icon: "lucide:bar-chart-2",
    path: "/dashboard/analytics",
  },
  {
    name: "Monitoring",
    icon: "lucide:activity",
    path: "/dashboard/monitoring",
    badge: "Live",
  },
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

const appPages = [
  {
    name: "Reports",
    icon: "lucide:file-text",
    path: "/dashboard/reports",
  },
  {
    name: "Alerts",
    icon: "lucide:bell",
    path: "/dashboard/alerts",
    badge: "5",
  },
  {
    name: "Settings",
    icon: "lucide:settings",
    path: "/dashboard/settings",
  },
];

interface DashboardSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
}

export const DashboardSidebar = ({ isOpen, onToggle, className }: DashboardSidebarProps) => {
  const { pathname } = useLocation();
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
        animate={{
          width: isOpen ? "16rem" : "4.5rem",
          transition: { duration: 0.25, ease: "easeInOut" },
        }}
        className={cn(
          `fixed top-0 left-0 z-50 flex h-screen flex-col
           ${isOpen ? "bg-white/80 dark:bg-zinc-900/70" : "bg-[#353f8b]/100"}
           backdrop-blur-md shadow-md`,
          isOpen ? "lg:w-64" : "lg:w-16",
          className
        )}
      >
        {/* ─── brand bar ───────── */}

        <>
          {isOpen ? (
            <div className="flex h-28 flex-col items-center justify-center bg-[#353f8b]/100 rounded-br-lg">
              <img
                src="https://motionics.com/wp-content/uploads/2019/07/Motionics-logo-2.png"
                alt="Motionics"
                className="h-11 w-auto mb-3"
              />
              <span className="text-white/90 text-sm font-medium tracking-wide">IOT Platform</span>
            </div>
          ) : (
            <div className="flex h-18 flex-col items-center justify-center p-6">
            <Icon icon="lucide:cloud" className="h-6 w-6 text-white/90" />
            </div>
          )}
        </>

        {/* ─── navigation links ────────────────────────────────── */}
        <nav className={cn("flex flex-1 flex-col gap-1 overflow-y-auto py-4 ", isOpen ? "px-3" : "items-center px-3")}>
          {/* primary links */}
          {sidebarItems.map((i) => (
            <NavItem key={i.path} item={i} isOpen={isOpen} active={pathname.startsWith(i.path)} />
          ))}

          {/* section label */}
          {isOpen && (
            <p className="mt-6 mb-1 px-4 text-[10px] font-semibold tracking-wide text-default-400">MANAGEMENT</p>
          )}

          {/* secondary links */}
          {appPages.map((i) => (
            <NavItem key={i.path} item={i} isOpen={isOpen} active={pathname.startsWith(i.path)} />
          ))}

          {/* spacer */}
          <div className="flex-1" />

          {/* collapse / expand */}
          <Tooltip content={isOpen ? "Collapse" : "Expand"} placement="right" isDisabled={isOpen}>
            <Button
              onPress={onToggle} // ← NOW TOGGLES
              variant="light"
              size="sm"
              className="w-full justify-start gap-2 rounded-lg"
              startContent={
                <Icon
                  icon={isOpen ? "lucide:panel-left-close" : "lucide:panel-left-open"}
                  className="h-5 w-5 text-default-500"
                />
              }
            >
              {isOpen && "Collapse sidebar"}
            </Button>
          </Tooltip>
        </nav>
      </motion.aside>
    </>
  );
};

function NavItem({ item, isOpen, active }: { item: SidebarItem; isOpen: boolean; active: boolean }) {
  const pill =
    active &&
    `before:absolute before:inset-y-1 before:w-1.5 before:rounded-r-lg ${
      isOpen ? "before:left-0 before:bg-primary" : "before:left-1 before:bg-white/100"
    }`;
  const { pathname } = useLocation();
  const isActive = pathname.startsWith(item.path);
  return (
    <motion.div key={item.name} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
      <Tooltip content={item.name} placement="right" isDisabled={isOpen}>
        <Button
          as={Link}
          to={item.path}
          variant="light"
          color={isActive ? "primary" : "default"}
          className={cn(
            "relative overflow-hidden rounded-lg py-2 transition",
            isOpen ? "w-full justify-start gap-3 px-3" : "w-12 justify-center",
            active ? "bg-primary/15 text-primary-400" : isOpen ? "text-default-600" : "text-white",
            !isOpen && "justify-center px-2",
            pill
          )}
          startContent={
            <Icon
              icon={item.icon}
              className={`h-5 w-5 flex-shrink-0 transition-transform duration-200
                    ${isActive ? "text-primary-400" : isOpen ? "text-default-500" : "text-white/100"}
                    group-hover:scale-110`}
            />
          }
          endContent={
            item.badge && isOpen ? (
              <Chip
                size="sm"
                variant="flat"
                color={item.badge === "Live" ? "success" : "primary"}
                className="animate-pulse"
              >
                {item.badge}
              </Chip>
            ) : null
          }
        >
          {isOpen && <span className={`${isActive ? "font-medium" : ""}`}>{item.name}</span>}
        </Button>
      </Tooltip>
    </motion.div>
  );
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
