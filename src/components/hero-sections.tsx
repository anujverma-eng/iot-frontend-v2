import React from "react";
import { Button } from "@heroui/react";
import { motion } from "framer-motion";
import { Icon } from "@iconify/react";
import { isLinearGradient } from "html2canvas/dist/types/css/types/image";

export const HeroSection = () => {
  const features = [
    {
      title: "Live Monitoring",
      description:
        "View live measurement data in real time from anywhere in the world",
      icon: "lucide:radio",
    },
    {
      title: "Smart Notifications",
      description:
        "Recieve instant alerts for custom tolerance thresholds and device status",
      icon: "lucide:bell-ring",
    },
    {
      title: "Historical Insight",
      description:
        "Track and analyze data trends over time with comprehensive historical logging",
      icon: "lucide:line-chart",
    },
    {
      title: "Multi-Gauge Connectivity",
      description:
        "Simultaneously monitor live readings from multiple gauges and gateways",
      icon: "lucide:network",
    },
    {
      title: "Team Access",
      description:
        "Collaborate with users and roles for shared visibility across your teams and projects",
      icon: "lucide:users",
    },
    {
      title: "Multi-Orgaization Access",
      description:
        "Create separate organizations to manage data across multiple projects and companies",
      icon: "lucide:building",
    },
  ];

  return (
    <>
      {/* HERO */}
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
                <span className="block text-black">View live</span>
                <span className="block text-black">measurements</span>
                <span className="block text-black">
                  from <span className="text-primary">anywhere</span>
                </span>
              </h1>

              <p className="mt-6 text-lg text-gray-600 dark:text-gray-400">
                Stay connected to your measurements with remote access to
                <br />
                real-time data. Available on desktop, tablet and mobile.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Button
                  as="a"
                  href="/login"
                  color="primary"
                  size="lg"
                  className="font-medium"
                  endContent={<Icon icon="lucide:arrow-right" />}
                >
                  Get Started
                </Button>

                <Button
                  as="a"
                  href="#features"
                  variant="bordered"
                  size="lg"
                  className="font-medium"
                >
                  Learn more
                </Button>
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
                    src="https://motionics.com/downloads/images/motionics-liveaccess-hero.png"
                    alt="IoT Dashboard"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section
        id="features"
        className="relative py-16 lg:py-24"
        style={{
          background: "linear-gradient(180deg, #f8f8f8, #ffffff)"
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Centered title/description */}
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">
              LiveAccess Features
            </h2>
            <p className="mt-3 text-lg text-gray-600 dark:text-gray-400">
              The secure online platform built for Motionics wireless gauges
            </p>
          </div>
<br></br>
          {/* Cards */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, idx) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: 0.05 * idx }}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-black/20"
              >
                <div className="flex flex-col items-start">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon icon={feature.icon} className="text-2xl text-primary" />
                  </div>

                  <h3 className="mt-4 text-lg font-semibold text-black">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
                <br></br>
                <br></br>
        </div>
                <br></br>
                <br></br>
            {/* HOW IT WORKS */}
                <section
                  id="howitworks"
                  className="bg-white relative py-16 lg:py-24"
                >
                  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    {/* Centered heading */}
                    <div className="mx-auto max-w-3xl text-center">
                      <motion.h2
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.5 }}
                        className="text-3xl font-bold tracking-tight text-primary sm:text-4xl"
                      >
                        How LiveAccess Works
                      </motion.h2>

                      <motion.p
                        initial={{ opacity: 0, y: 14 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.5, delay: 0.08 }}
                        className="mt-3 text-lg text-gray-600 dark:text-gray-400"
                      >
                       Turn your measurement data into actionable insights today
                      </motion.p>
                    </div>

                    {/* Content */}
                    <div className="mt-12 grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
                      {/* Left image card */}
                      <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.2 }}
                        transition={{ duration: 0.6 }}
                        className="mx-auto w-full max-w-lg"
                      >
                        <div className="rounded-3xl bg-white p-4">
                          <img
                            src="https://motionics.com/downloads/images/pexels-cadis-ioan-2087170528-33041003.jpg"
                            alt="LiveAccess dashboard preview"
                            className="w-full max-h-[450px] rounded-2xl object-cover"
                          />
                        </div>
                      </motion.div>

                      {/* Right steps */}
                      <div className="relative">
                        {/* Vertical dotted line */}
                        <div
                          className="absolute left-[18px] top-2 hidden h-[calc(100%-8px)] w-px border-l-2 border-dashed border-gray-200 dark:border-gray-800 sm:block"
                          aria-hidden="true"
                        />

                        <div className="space-y-10">
                          {[
                            {
                              step: "Step 1",
                              title: "Connect to the LiveAccess Portal",
                              desc: "Pair sensors securely through the Motionics LiveAccess Gateway to start streaming.",
                            },
                            {
                              step: "Step 2",
                              title: "View your data from anywhere",
                              desc: "Open LiveAccess on desktop, tablet or mobile to instantly see your field measurements in real-time. Add Team members for shared access.",
                            },
                            {
                              step: "Step 3",
                              title: "Set up notification alerts",
                              desc: "Enable triggers for gauge connectivity, battery status and custom tolerance thresholds",
                            },
                          ].map((item, idx) => (
                            <motion.div
                              key={item.title}
                              initial={{ opacity: 0, y: 16 }}
                              whileInView={{ opacity: 1, y: 0 }}
                              viewport={{ once: true, amount: 0.2 }}
                              transition={{ duration: 0.5, delay: 0.06 * idx }}
                              className="flex gap-4"
                            >
                              {/* Icon */}
                              <div className="relative flex h-10 w-10 flex-none items-center justify-center">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                                  <span className="text-l font-medium">
                                  {idx + 1}
                                </span>
                                </div>
                              </div>

                              {/* Text */}
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                  {item.step}
                                </p>
                                <h3 className="mt-1 text-lg font-semibold text-black">
                                  {item.title}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                                  {item.desc}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
        {/* Full-width CTA band */}
        <div className="mt-14 w-full bg-primary">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="max-w-3xl">
              <p className="text-3xl font-semibold tracking-tight text-white sm:text-3xl">
              Your worksite. Always in sight.
              </p>
              <p className="mt-3 text-lg text-white/90">
                Discover a new level of productivity with LiveAccess
              </p>
            </div>

            <Button
              as="a"
              href="/login"
              size="lg"
              className="bg-white font-medium text-primary hover:bg-white/90"
              endContent={<Icon icon="lucide:arrow-right" />}
            >
              Get Started
            </Button>
          </div>
        </div>
      </section>
    </>
  );
};