import React from "react";
import { Button } from "@heroui/react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";

export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden bg-background py-20 lg:py-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col justify-center"
          >
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="block text-primary">IoT Cloud Platform</span>
              <span className="mt-2 block">for Industrial Monitoring</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-400">
              Connect your Bluetooth-enabled sensors to the Internet for real-time
              data tracking, historical analysis, and smart alerting with
              Motionics' MultiGage Cloud platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button
                color="primary"
                size="lg"
                className="font-medium"
                endContent={<Icon icon="lucide:arrow-right" />}
              >
                Get Started
              </Button>
              <Button
                variant="bordered"
                size="lg"
                className="font-medium"
                startContent={<Icon icon="lucide:play" />}
              >
                Watch Demo
              </Button>
            </div>
            <div className="mt-12 flex items-center gap-8">
              {[
                { number: "1M+", label: "Active Sensors" },
                { number: "50+", label: "Countries" },
                { number: "99.9%", label: "Uptime" },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-col"
                >
                  <span className="text-3xl font-bold text-primary">
                    {stat.number}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {stat.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="relative lg:mt-0"
          >
            <div className="relative mx-auto max-w-3xl">
              <div className="relative">
                <img
                  src="https://img.heroui.chat/image/dashboard?w=800&h=600&u=1"
                  alt="IoT Dashboard"
                  className="w-full rounded-xl shadow-2xl"
                />
                <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-gray-900/10" />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
};