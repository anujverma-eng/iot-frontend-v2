// src/components/stats-card.tsx
import React from "react";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";

interface StatsCardProps {
  title: string;
  value: number;
  icon: string;
  color: "primary" | "secondary" | "success" | "warning" | "danger";
  decimals?: number;
  suffix?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  color,
  decimals = 0,
  suffix
}) => {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className={`rounded-full bg-${color}-100 p-3 dark:bg-${color}-500/20`}>
          <Icon icon={icon} className={`text-${color}-500`} width={24} />
        </div>
        <div className="flex flex-col">
          <span className="text-sm text-default-500">{title}</span>
          <span className="text-xl font-semibold">
            {value.toFixed(decimals)}
            {suffix && <span className="text-sm ml-1">{suffix}</span>}
          </span>
        </div>
      </CardBody>
    </Card>
  );
};