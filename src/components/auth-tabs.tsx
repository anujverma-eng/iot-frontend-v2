// src/components/auth-tabs.tsx
import React from "react";
import { Card, CardBody, Tabs, Tab } from "@heroui/react";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";
import { motion } from "framer-motion";
import { fadeInUp } from "../animations";

export function AuthTabs() {
  return (
    <motion.div {...fadeInUp}>
      <Card className="w-full max-w-lg">
        <CardBody className="gap-4">
          <Tabs
            aria-label="Authentication options"
            color="primary"
            variant="underlined"
            classNames={{
              tabList: "gap-6 relative",
              cursor: "w-full bg-primary-500 h-[2px] bottom-0",
              tab: "max-w-fit px-0 h-12 text-lg group",
              tabContent: "group-data-[selected=true]:text-primary-500 transition-colors"
            }}
          >
            <Tab
              key="login"
              title={
                <div className="flex items-center space-x-2">
                  <span>Sign In</span>
                </div>
              }
            >
              <motion.div {...fadeInUp}>
                <LoginForm />
              </motion.div>
            </Tab>

            <Tab
              key="signup"
              title={
                <div className="flex items-center space-x-2">
                  <span>Create Account</span>
                </div>
              }
            >
              <motion.div {...fadeInUp}>
                <RegisterForm />
              </motion.div>
            </Tab>
            
          </Tabs>
        </CardBody>
      </Card>
    </motion.div>
  );
}
