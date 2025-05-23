import React from "react";
import { Card, CardBody } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

interface StatsCardProps {
  title: string;
  value: number;
  icon: string;
  color?: "primary" | "success" | "warning" | "danger";
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  icon,
  color = "primary" 
}) => {
  return (
    <Card className="w-full">
      <CardBody>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-4"
        >
          <div className={`p-3 rounded-medium bg-${color}-100`}>
            <Icon 
              icon={icon} 
              className={`w-6 h-6 text-${color}-500`} 
            />
          </div>
          <div>
            <p className="text-small text-default-500">{title}</p>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-semibold"
            >
              {value.toLocaleString()}
            </motion.p>
          </div>
        </motion.div>
      </CardBody>
    </Card>
  );
};
