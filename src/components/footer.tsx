import React from "react";
import { Link } from "@heroui/react";
import { Icon } from "@iconify/react";

export const Footer = () => {
  const footerSections = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "#" },
        { name: "Pricing", href: "#" },
        { name: "Security", href: "#" },
        { name: "Enterprise", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { name: "About", href: "#" },
        { name: "Careers", href: "#" },
        { name: "Blog", href: "#" },
        { name: "Press", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Documentation", href: "#" },
        { name: "Support", href: "#" },
        { name: "API", href: "#" },
        { name: "Status", href: "#" },
      ],
    },
    {
      title: "Legal",
      links: [
        { name: "Privacy", href: "#" },
        { name: "Terms", href: "#" },
        { name: "Cookie Policy", href: "#" },
        { name: "Licenses", href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-background border-t border-divider">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="xl:grid xl:grid-cols-5 xl:gap-8">
          <div className="xl:col-span-1">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:cloud" className="text-primary text-2xl" />
              <span className="font-bold text-xl">Motionics</span>
            </div>
            <p className="mt-4 text-sm text-default-600">
              Advanced metrology and machinery diagnostics solutions
            </p>
            <div className="mt-6 flex space-x-6">
              {[
                { icon: "logos:twitter", href: "#" },
                { icon: "logos:linkedin-icon", href: "#" },
                { icon: "logos:github-icon", href: "#" },
              ].map((social) => (
                <Link
                  key={social.icon}
                  href={social.href}
                  className="text-default-400 hover:text-default-500 transition-colors"
                >
                  <Icon icon={social.icon} className="h-6 w-6" />
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:col-span-4 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              {footerSections.slice(0, 2).map((section) => (
                <div key={section.title} className="mt-12 md:mt-0">
                  <h3 className="text-sm font-semibold text-default-900">{section.title}</h3>
                  <ul className="mt-4 space-y-4">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          color="foreground"
                          className="text-sm text-default-600 hover:text-primary transition-colors"
                        >
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              {footerSections.slice(2).map((section) => (
                <div key={section.title} className="mt-12 md:mt-0">
                  <h3 className="text-sm font-semibold text-default-900">{section.title}</h3>
                  <ul className="mt-4 space-y-4">
                    {section.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          color="foreground"
                          className="text-sm text-default-600 hover:text-primary transition-colors"
                        >
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-divider pt-8">
          <p className="text-sm text-default-500">
            © {new Date().getFullYear()} Motionics, LLC. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};