import React from "react";
import { Icon } from "@iconify/react";

const features = [
  {
    icon: "lucide:wifi",
    title: "Real-Time Monitoring",
    description:
      "Remotely view live readings from your desktop, tablet or mobile",
  },
  {
    icon: "lucide:bell",
    title: "Smart Alerts",
    description:
      "Set customizable tolerance thresholds and receive instant notifications.",
  },
  {
    icon: "lucide:chart",
    title: "Historical Analysis",
    description:
      "Track data trends over time with comprehensive historical logging.",
  },
  {
    icon: "lucide:shield",
    title: "Secure Gateway",
    description:
      "Connect sensors securely through the MultiGage Cloud Gateway.",
  },
  {
    icon: "lucide:smartphone",
    title: "Mobile Access",
    description:
      "Access your data on-the-go with iOS and Android mobile apps.",
  },
  {
    icon: "lucide:plug",
    title: "Easy Integration",
    description:
      "Seamlessly integrate with existing systems using our open APIs.",
  },
];

export function FeaturesSection() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-white mb-6">
        Why Choose Motionics IoT Platform?
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => (
          <div 
            key={index}
            className="flex items-start space-x-4 p-4 rounded-lg bg-white/10 backdrop-blur-sm"
          >
            <div className="p-2 rounded-lg bg-primary-500/20">
              <Icon icon={feature.icon} className="text-primary-400" width={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-white/80 text-sm">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-6 rounded-lg bg-white/10 backdrop-blur-sm">
        <h3 className="text-xl font-semibold text-white mb-4">
          Trusted by Industry Leaders
        </h3>
        <div className="flex flex-wrap gap-8 justify-center items-center opacity-70">
          <Icon icon="logos:tesla" width={100} />
          <Icon icon="logos:siemens" width={100} />
          <Icon icon="logos:ge" width={60} />
          <Icon icon="logos:boeing" width={100} />
        </div>
      </div>
    </div>
  );
}