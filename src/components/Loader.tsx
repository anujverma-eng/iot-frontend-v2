// src/components/Loader.tsx
import { CircularProgress } from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";

export function FullScreenLoader({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          role="alert"
          aria-label="Loading application"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.8 }}
            className="relative"
          >
            <CircularProgress
              size="lg"
              color="primary"
              className="w-16 h-16"
              aria-label="Loading spinner"
            />
            <motion.div
              className="absolute inset-0"
              initial={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
            >
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* -------------------------------------------------------------- */
/*  One gateway icon + short dotted beam to the cloud             */
/* -------------------------------------------------------------- */
function Gateway({
  xOffset,
  top,
  cloudTop,
  desync,
}: {
  xOffset: number; // ± px from box centre
  top: number; // y position (px) inside box
  cloudTop: number; // y of cloud centre
  desync: number; // phase offset for packet dots
}) {
  const beamH = top - cloudTop - 20; // vertical distance (≈ 80 px)

  return (
    <div className="absolute left-1/2" style={{ transform: `translateX(${xOffset}px)`, top }}>
      {/* gateway icon */}
      <div className="relative flex justify-center">
        <Icon icon="lucide:router" className="text-3xl text-primary drop-shadow" />
        <motion.span
          className="absolute -right-1 -top-1 block w-1.5 h-1.5 rounded-full bg-success"
          animate={{ scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: desync }}
        />
      </div>

      {/* dotted beam (4 packet dots) */}
      {[0, 1, 2, 3].map((pkt) => (
        <motion.span
          key={pkt}
          className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full"
          style={{ bottom: 18 }} // start just above the router
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: -beamH, opacity: [0, 1, 0] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            delay: desync + pkt * 0.25,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
