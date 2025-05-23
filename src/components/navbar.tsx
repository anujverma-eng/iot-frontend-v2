import {
  Button,
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import React from "react";
import { useLocation } from "react-router-dom";
import { useAppSelector, useAppDispatch } from "../hooks/useAppDispatch";
import { logout } from "../store/authSlice";

export const TopNavbar = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const location = useLocation();
  const isAuthPage = ["/login", "/register", "/forgot-password"].includes(location.pathname);
  const { status } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  const menuItems = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Platform", href: "/platform" },
    { name: "Solutions", href: "/solutions" },
    { name: "Pricing", href: "/pricing" },
  ];

  const handleLogout = () => {
    dispatch(logout());
  };

  return (
    <Navbar
      isBordered
      isBlurred={false}
      className="bg-background/70 backdrop-blur-md backdrop-saturate-150 border-b border-divider sticky top-0 z-50"
      maxWidth="2xl"
    >
      <NavbarContent justify="start" className="gap-4">
        <NavbarMenuToggle aria-label={isMenuOpen ? "Close menu" : "Open menu"} className="sm:hidden" />
        <NavbarBrand>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <Icon icon="lucide:cloud" className="text-primary text-2xl" />
            <p className="font-bold text-inherit text-xl">Motionics</p>
          </motion.div>
        </NavbarBrand>
      </NavbarContent>

      <NavbarContent className="hidden sm:flex gap-6" justify="center">
        {menuItems.map((item, index) => (
          <NavbarItem key={item.name}>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Link color="foreground" href={item.href} className="hover:text-primary transition-colors font-medium">
                {item.name}
              </Link>
            </motion.div>
          </NavbarItem>
        ))}
      </NavbarContent>

      <NavbarContent justify="end" className="gap-4">
        {status === "auth" ? (
          <NavbarItem>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <Button
                color="danger"
                variant="flat"
                startContent={<Icon icon="lucide:log-out" />}
                onPress={handleLogout}
                className="font-medium"
              >
                Log Out
              </Button>
            </motion.div>
          </NavbarItem>
        ) : !isAuthPage && (
          <>
            <NavbarItem className="hidden sm:flex">
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <Button as={Link} color="default" variant="flat" href="/login" className="font-medium">
                  Login
                </Button>
              </motion.div>
            </NavbarItem>
            <NavbarItem>
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                <Button as={Link} color="primary" href="/login" variant="solid" className="font-medium">
                  Sign Up
                </Button>
              </motion.div>
            </NavbarItem>
          </>
        )}
      </NavbarContent>

      <NavbarMenu className="bg-background/95 backdrop-blur-md backdrop-saturate-150">
        {menuItems.map((item, index) => (
          <NavbarMenuItem key={`${item.name}-${index}`}>
            <Link color="foreground" className="w-full font-medium" href={item.href} size="lg">
              {item.name}
            </Link>
          </NavbarMenuItem>
        ))}

        {status === "auth" ? (
          <NavbarMenuItem className="mt-4">
            <Button
              color="danger"
              variant="flat"
              startContent={<Icon icon="lucide:log-out" />}
              onPress={handleLogout}
              className="w-full font-medium"
            >
              Log Out
            </Button>
          </NavbarMenuItem>
        ) : !isAuthPage && (
          <NavbarMenuItem className="mt-4">
            <div className="flex flex-col gap-2">
              <Button as={Link} color="default" variant="flat" href="/login" className="w-full font-medium">
                Login
              </Button>
              <Button as={Link} color="primary" href="/login" variant="solid" className="w-full font-medium">
                Sign Up
              </Button>
            </div>
          </NavbarMenuItem>
        )}
      </NavbarMenu>
    </Navbar>
  );
};