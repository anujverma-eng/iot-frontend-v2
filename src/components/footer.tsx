import React from "react";
import { Link } from "@heroui/react";
import { Icon } from "@iconify/react";

export const Footer = () => {
  const columns = [
    {
      title: "Quick Links",
      links: [
        { name: "Login / Sign up", href: "/login" },
        { name: "Features", href: "#features" },
        { name: "How it Works", href: "#howitworks" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Contact", href: "https://motionics.com/sales-or-product-questions" },
      ],
    },
    {
      title: "Motionics",
      links: [
        { name: "Website", href: "https://motionics.com" },
        { name: "Store", href: "https://store.motionics.com" },
        { name: "Gallery", href: "https://motionics.com/gallery" },
      ],
    },
  ];

  const social = [
    { icon: "simple-icons:linkedin", href: "https://linkedin.com/company/motionics" },
    { icon: "simple-icons:instagram", href: "https://instagram.com/motionicsllc" },
    { icon: "simple-icons:facebook", href: "https://facebook.com/motionics" },
    { icon: "simple-icons:x", href: "https://x.com/motionics" },
    { icon: "simple-icons:youtube", href: "https://youtube.com/@motionicsllc" },
  ];

  const legal = [
    { name: "info@motionics.com", href: "mailto:info@motionics.com" },
    { name: "(205) 264-1896" },
  ];

  return (
    <footer className="bg-background">
      {/* Outer padding that gives the “card on page” feel */}
      <div className="px-4 pb-10 pt-14 sm:px-6 lg:px-8">
        {/* The card container */}
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[32px] border border-divider bg-background/80 p-8 shadow-sm backdrop-blur sm:p-10">
            {/* Top row */}
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              {/* Brand + description + social */}
              <div>
                <div className="flex items-center gap-3">
                  <a
                    href="https://live.motionics.com"
                  >
                    <img
                      src="https://motionics.com/downloads/images/liveaccess-by-motionics-logo.png"
                      alt="LiveAccess by Motionics"
                      className="h-16 w-auto cursor-pointer"
                    />
                  </a>
                </div>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-default-600">
                  LiveAccess is a secure cloud platform giving teams instant remote access
                  to live data and historical readings.
                </p>

                <div className="mt-6 flex items-center gap-4">
                  {social.map((s) => (
                    <Link
                      key={s.icon}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-default-500 transition-colors hover:text-primary"
                      aria-label={s.icon}
                    >
                      <Icon icon={s.icon} className="h-5 w-5" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Columns */}
              <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
                {columns.map((col) => (
                  <div key={col.title}>
                    <h3 className="text-sm font-semibold text-default-900">{col.title}</h3>
                    <ul className="mt-4 space-y-3">
                      {col.links.map((l) => {
                        const isExternal = l.href.startsWith("http");
                        return (
                          <li key={l.name}>
                            <Link
                              href={l.href}
                              target={isExternal ? "_blank" : undefined}
                              rel={isExternal ? "noopener noreferrer" : undefined}
                              color="foreground"
                              className="text-sm text-default-600 transition-colors hover:text-primary"
                            >
                              {l.name}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="my-10 h-px w-full bg-divider" />

            {/* Bottom row */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-default-500">
                © {new Date().getFullYear()} Motionics, LLC. All rights reserved.
              </p>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                {legal.map((l) => (
                  <Link
                    key={l.name}
                    href={l.href}
                    color="foreground"
                    className="text-sm text-default-600 underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {l.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};