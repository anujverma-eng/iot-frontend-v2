// src/pages/Dashboard.tsx
import { motion } from 'framer-motion';
import { Card, CardBody, Progress } from "@heroui/react";
import { Icon } from "@iconify/react";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-default-50 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold text-foreground">
            Industrial Monitoring Dashboard
          </h1>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            whileHover={{ y: -5 }}
            className="col-span-1"
          >
            <Card className="h-full border border-default-200/50 shadow-sm">
              <CardBody>
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary-500/20">
                    <Icon icon="lucide:activity" className="text-primary-500" width={24} />
                  </div>
                  <div>
                    <p className="text-default-500">Active Sensors</p>
                    <h2 className="text-3xl font-bold">142</h2>
                  </div>
                </div>
                <Progress 
                  value={75} 
                  classNames={{ 
                    track: "bg-primary-500/10", 
                    indicator: "bg-gradient-to-r from-primary-500 to-primary-300" 
                  }}
                />
              </CardBody>
            </Card>
          </motion.div>

          {/* Add more dashboard components with similar motion effects */}
        </div>
      </div>
    </div>
  );
}