import { TopNavbar } from "./navbar";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <>
      {/* <TopNavbar /> */}
      {children}
    </>
  );
}
