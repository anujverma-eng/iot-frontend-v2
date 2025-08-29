import { Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import React from "react";

interface LiveDataLoadingProps {
  sensorName?: string;
  className?: string;
}

export const LiveDataLoading: React.FC<LiveDataLoadingProps> = ({
  sensorName,
  className = ""
}) => {
  console.log('[LiveDataLoading] 🎭 Component rendered:', {
    sensorName,
    className,
    timestamp: new Date().toISOString()
  });
  
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md mx-auto p-6"
      >
        {/* Animated connection icon */}
        <div className="relative mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 mx-auto mb-2"
          >
            <Icon 
              icon="lucide:radio" 
              className="w-full h-full text-primary-500" 
            />
          </motion.div>
          
          {/* Pulse effect */}
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute inset-0 w-16 h-16 mx-auto bg-primary-100 rounded-full"
          />
        </div>

        {/* Loading text */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-primary-600">
            Connecting to Live Data
          </h3>
          <p className="text-default-600 text-sm">
            {sensorName ? (
              <>Waiting for live readings from <span className="font-medium">{sensorName}</span></>
            ) : (
              "Establishing real-time connection..."
            )}
          </p>
          
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <Spinner size="sm" color="primary" />
            <span className="text-xs text-default-500">
              This usually takes just a few seconds
            </span>
          </div>
        </div>

        {/* Optional decorative elements */}
        <div className="flex justify-center gap-1 mt-6">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: [1, 1.5, 1],
                backgroundColor: ["#e2e8f0", "#3b82f6", "#e2e8f0"]
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity, 
                delay: i * 0.2 
              }}
              className="w-2 h-2 rounded-full bg-default-300"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};
