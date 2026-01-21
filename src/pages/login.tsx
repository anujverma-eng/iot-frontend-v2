// src/pages/login.tsx
import { motion } from "framer-motion";
import { AuthTabs } from "../components/auth-tabs";

export function Login() {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Background image */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://motionics.com/downloads/images/login-page-bg-20.png')",
        }}
        aria-hidden="true"
      />

      {/* Optional subtle overlay for readability */}
      <div
        className="pointer-events-none absolute inset-0 bg-white/70 dark:bg-black/60"
        aria-hidden="true"
      />

      {/* Centered login */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <AuthTabs />
        </motion.div>
      </div>
    </div>
  );
}