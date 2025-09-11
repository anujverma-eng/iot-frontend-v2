// src/pages/OnboardingPage.tsx
import { Button, Card } from "@heroui/react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";
import React from "react";
import { FullScreenLoader } from "../components/Loader";
import { OnboardingModal } from "../components/onboarding-modal";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { Navigate } from "react-router-dom";
import { fetchMyInvitations, selectMyInvitations, selectMyInvitationsLoading } from "../store/invitesSlice";
import { InviteStatus } from "../api/types";

export default function OnboardingPage() {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile);
  const myInvitations = useAppSelector((s) => s.invites.myInvitations.rows);
  const myInvitationsLoading = useAppSelector((s) => s.invites.myInvitations.loading);
  const hasFetchedInvitations = React.useRef(false);

  // Helper functions for invitation filtering
  const isPending = (status: InviteStatus) => {
    return [InviteStatus.CREATED, InviteStatus.SENT, InviteStatus.DELIVERED].includes(status);
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  // Filter to only show actionable invitations (pending and not expired)
  const actionableInvitations = myInvitations.filter(invitation => 
    isPending(invitation.status) && !isExpired(invitation.expiresAt)
  );

  // Reset fetch flag when user changes
  React.useEffect(() => {
    hasFetchedInvitations.current = false;
  }, [profile.data?.user?.id]);

  // Check for pending invitations on mount
  React.useEffect(() => {
    const membershipsCount = profile.data?.memberships?.length ?? 0;
    if (profile.loaded && membershipsCount === 0 && !myInvitationsLoading && !hasFetchedInvitations.current) {
      hasFetchedInvitations.current = true;
      dispatch(fetchMyInvitations({}));
    }
  }, [dispatch, profile.loaded, profile.data?.memberships?.length]);

  // Redirect to dashboard if user already has an organization
  if (profile.loaded && (profile.data?.memberships?.length ?? 0) > 0) {
    return <Navigate to="/dashboard/home" replace />;
  }

  // Check for pending invitations
  const hasPendingInvitations = actionableInvitations && actionableInvitations.length > 0;
  
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  const handleSuccess = async () => {
    setIsOpen(false);
    setIsLoading(true);
    try {
      // await dispatch(fetchProfile());
      setSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking for invitations
  if (!profile.loaded || (profile.loaded && (profile.data?.memberships?.length ?? 0) === 0 && myInvitationsLoading)) {
    return <FullScreenLoader show aria-label="Loading..." />;
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-content1 to-content2 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <motion.div
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12 min-h-screen flex flex-col items-center justify-center">
        <motion.div className="text-center mb-8 md:mb-16 space-y-6">
          <motion.div
            className="inline-flex relative"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Icon icon="lucide:cloud" className="text-6xl text-primary absolute -top-1 -right-1 opacity-30" />
            <Icon icon="lucide:cloud" className="text-6xl text-primary animate-spin-slow" />
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Industrial IoT Made Simple
          </h1>
          <p className="text-lg md:text-xl text-foreground-600 max-w-3xl mx-auto">
            Monitor machinery health, analyze sensor data, and optimize operations through our browser-based platform.
            Connect your Bluetooth-enabled devices in minutes.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-4xl grid md:grid-cols-3 gap-6 mb-12"
        >
          {[
            {
              icon: "lucide:wifi",
              title: "Remote Monitoring",
              description: "Access real-time sensor data from anywhere",
            },
            {
              icon: "lucide:activity",
              title: "Health Tracking",
              description: "Monitor machinery health and get instant alerts",
            },
            {
              icon: "lucide:bar-chart",
              title: "Smart Analytics",
              description: "Analyze trends with drag-and-drop dashboards",
            },
          ].map((feature, index) => (
            <Card key={index} className="p-6 text-center space-y-4" isHoverable>
              <Icon icon={feature.icon} className="text-4xl text-primary mx-auto" />
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-foreground-600">{feature.description}</p>
            </Card>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          {hasPendingInvitations ? (
            <div className="space-y-6">
              <Card className="p-6 max-w-lg mx-auto">
                <div className="text-center space-y-4">
                  <Icon icon="lucide:mail" className="text-4xl text-primary mx-auto" />
                  <h3 className="text-xl font-semibold">You have pending invitations!</h3>
                  <p className="text-foreground-600">
                    You've been invited to join {actionableInvitations.length} organization{actionableInvitations.length > 1 ? 's' : ''}. 
                    Review and accept your invitations to get started.
                  </p>
                  <Button
                    size="lg"
                    color="primary"
                    className="w-full"
                    onPress={() => window.location.assign('/invitations')}
                    startContent={<Icon icon="lucide:mail-open" className="text-xl" />}
                  >
                    Review Invitations ({actionableInvitations.length})
                  </Button>
                </div>
              </Card>
              
              <div className="text-center">
                <p className="text-sm text-foreground-500 mb-3">
                  Don't want to join? Create your own organization instead.
                </p>
                <Button
                  size="lg"
                  variant="bordered"
                  color="primary"
                  className="font-medium text-lg px-8"
                  onPress={() => setIsOpen(true)}
                  startContent={<Icon icon="lucide:plus" className="text-xl" />}
                >
                  Create My Organization
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="lg"
              color="primary"
              className="font-medium text-lg px-8"
              onPress={() => setIsOpen(true)}
              startContent={<Icon icon="lucide:plus" className="text-xl" />}
            >
              Get Started with MultiGage Cloud
            </Button>
          )}
        </motion.div>
      </div>

      <OnboardingModal isOpen={isOpen} onClose={() => setIsOpen(false)} onSuccess={handleSuccess} />

      <FullScreenLoader show={isLoading} />

      {/* Success Animation */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <Card className="p-8 text-center space-y-6 max-w-md mx-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
              >
                <Icon icon="lucide:check-circle" className="text-6xl text-success mx-auto" />
              </motion.div>
              <h2 className="text-2xl font-semibold">Welcome Aboard!</h2>
              <p className="text-foreground-600">
                Your organization has been successfully created. You'll receive an email with next steps.
              </p>
              <Button
                color="primary"
                onPress={() => {
                  setSuccess(false);
                  window.location.assign("/dashboard/home");
                  return;
                }}
              >
                Get Started
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
