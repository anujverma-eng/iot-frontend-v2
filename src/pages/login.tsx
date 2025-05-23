// src/pages/login.tsx
import { motion } from "framer-motion";
import { AuthTabs } from "../components/auth-tabs";
import { FeaturesSection } from "../components/features-section";

export function Login() {
  return (
    <div className="min-h-screen bg-background">

      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Left side - Features */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary-600 to-primary-800 p-12">
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[url('https://img.heroui.chat/image/dashboard?w=1000&h=1000&u=5')] opacity-10 bg-cover bg-center" />
          </div>
          <div className="relative z-10">
            <FeaturesSection />
          </div>
        </div>

        {/* Right side - Auth Tabs */}
        <div className="flex-1 flex items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <AuthTabs />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
