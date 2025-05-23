import { Outlet, useLocation } from "react-router-dom";
import { TopNavbar } from "../components/navbar";

export default function RootLayout() {
  const { pathname } = useLocation();
  const isDashboard = pathname.startsWith("/dashboard");
  return (
    <div role="main" aria-label="Application root">
      {!isDashboard && <TopNavbar />}
      <Outlet />
    </div>
  );
}
