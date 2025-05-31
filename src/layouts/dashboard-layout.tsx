import { motion } from "framer-motion";
import React from "react";
import { DashboardNavbar } from "../dashboard/DashboardNavbar";
import { DashboardSidebar } from "../dashboard/DashboardSidebar";
import { useAppSelector } from "../hooks/useAppDispatch";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const profile = useAppSelector((s) => s.profile);

  if (profile.loaded && !profile.data?.orgId && location.pathname !== "/onboarding") {
    return;
  }
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

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
    if (location.pathname.includes("/dashboard/analytics")) {
      setIsSidebarOpen(false);
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
            flex-1 p-4 sm:p-6 lg:p-8 pt-20
            transition-[margin] duration-200
            ${isSidebarOpen ? "lg:ml-64" : "lg:ml-16"}
          `}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
};
