import { motion } from "framer-motion";
import React from "react";
import { DashboardNavbar } from "../dashboard/DashboardNavbar";
import { DashboardSidebar } from "../dashboard/DashboardSidebar";
import { useAppSelector } from "../hooks/useAppDispatch";
import { useUnknownSensorDiscovery } from "../hooks/useUnknownSensorDiscovery";
import { useLiveDataConnection } from "../hooks/useLiveDataConnection";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const profile = useAppSelector((s) => s.profile);

  // DISABLED: Unknown sensor auto-discovery to prevent API spam
  // useUnknownSensorDiscovery();

  // Initialize centralized live data connection
  useLiveDataConnection();

  if (profile.loaded && (profile.data?.memberships?.length ?? 0) === 0 && location.pathname !== "/onboarding") {
    return;
  }
  // const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(isDesktop ? false /* rail */ : false /* hidden */);

  // Add this useEffect to handle mobile detection
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1024px)"); // lg breakpoint
    setIsSidebarOpen(!mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setIsSidebarOpen(!e.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // If the page is "/dashboard/analytics", close the sidebar
  React.useEffect(() => {
    if (location.pathname.includes("/dashboard/sensors")) {
      // setIsSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ─── header ─────────────────────────────────────────────── */}
      <DashboardNavbar
        onMenuToggle={() => setIsSidebarOpen((o) => !o)}
        className={
          isSidebarOpen
            ? "lg:pl-64 bg-white/80 backdrop-blur-md border-b border-default-200"
            : "lg:pl-16 bg-white/80 backdrop-blur-md border-b border-default-200"
        }
      />

      {/* ─── body: sidebar  page content ───────────────────────── */}
      <div className="flex flex-1">
        <DashboardSidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen((o) => !o)} />

        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          aria-label="Main content"
          className={`
            flex-1 min-w-0
            pt-10 
            p-4 sm:p-6 lg:p-8
            transition-[margin] duration-200
            ${isSidebarOpen ? "lg:ml-64" : "lg:ml-16"}
          `}
        >
          <div className="mx-auto w-full max-w-full">
            {children}
          </div>
        </motion.main>
      </div>
    </div>
  );
};
