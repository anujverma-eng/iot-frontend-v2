import React from "react";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

interface StatsCardProps {
  title: string;
  value: number;
  icon: string;
  color?: "primary" | "success" | "warning" | "danger" | "secondary";
  decimals?: number;
  suffix?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color = "primary",
  decimals = 0,
  suffix = ""
}) => {
  return (
    <Card className="w-full">
      <CardBody className="flex gap-4">
        <div className={`rounded-lg bg-${color}-100 p-3 dark:bg-${color}-500/20`}>
          <Icon icon={icon} className={`h-6 w-6 text-${color}-500`} />
        </div>
        <div className="flex flex-col gap-1">
          <motion.span 
            className="text-sm text-default-600"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {title}
          </motion.span>
          <motion.span 
            className="text-2xl font-semibold"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {value.toLocaleString(undefined, {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals
            })}
            {suffix && <span className="text-sm ml-1">{suffix}</span>}
          </motion.span>
        </div>
      </CardBody>
    </Card>
  );
};