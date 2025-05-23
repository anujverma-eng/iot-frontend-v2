// src/components/onboarding-modal.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal, ModalContent, ModalBody, Button, Input, InputOtp } from "@heroui/react";
import { Icon } from "@iconify/react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { createOrg } from "../store/orgSlice";
import { addToast } from "@heroui/react";

type Step = "welcome" | "choice" | "create" | "join";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Add onSuccess prop
}

const createOrgSchema = z.object({
  orgName: z.string().min(2, "Organization name must be at least 2 characters"),
  emails: z.array(z.string().email("Invalid email address")).max(3, "Maximum 3 team members can be invited"),
});

const joinOrgSchema = z.object({
  inviteCode: z.string().length(6, "Invite code must be 6 characters"),
});

type CreateOrgFormValues = z.infer<typeof createOrgSchema>;
type JoinOrgFormValues = z.infer<typeof joinOrgSchema>;

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const dispatch = useAppDispatch();
  const [step, setStep] = React.useState<Step>("welcome");
  const [orgName, setOrgName] = React.useState("");
  const [emails, setEmails] = React.useState<string[]>([]);
  const [currentEmail, setCurrentEmail] = React.useState("");
  const [inviteCode, setInviteCode] = React.useState("");
  const [error, setError] = React.useState("");
  const [otpValue, setOtpValue] = React.useState("");

  const createForm = useForm<CreateOrgFormValues>({
    defaultValues: {
      orgName: "",
      emails: [],
    },
    resolver: zodResolver(createOrgSchema),
  });

  const joinForm = useForm<JoinOrgFormValues>({
    defaultValues: {
      inviteCode: "",
    },
    resolver: zodResolver(joinOrgSchema),
  });

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && currentEmail) {
      e.preventDefault();
      if (emails.length >= 3) {
        setError("Maximum 3 team members can be invited");
        return;
      }
      // if (!validateEmail(currentEmail)) {
      //   setError("Please enter a valid email address");
      //   return;
      // }
      if (emails.includes(currentEmail)) {
        setError("This email has already been added");
        return;
      }
      setEmails([...emails, currentEmail]);
      setCurrentEmail("");
      setError("");
    }
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter((e) => e !== email));
  };

  const handleCreateOrg = async (data: CreateOrgFormValues) => {
    try {
      await dispatch(createOrg(data.orgName)).unwrap();
      // TODO: Call invite API with data.emails and data.orgName
      addToast({
        title: "Success",
        description: "Organization created successfully",
        color: "success",
      });
      onSuccess();
    } catch (e: any) {
      addToast({
        title: "Error",
        description: e.message ?? "Failed to create organization",
        color: "danger",
      });
    }
  };

  const handleJoinOrg = async (data: JoinOrgFormValues) => {
    try {
      // TODO: Implement join organization API call
      onSuccess();
    } catch (e: any) {
      addToast({
        title: "Error",
        description: e.message ?? "Failed to join organization",
        color: "danger",
      });
    }
  };

  const renderStep = () => {
    // Add step indicators at the top of each step
    const stepIndicators = (
      <motion.div className="flex justify-center mb-6">
        {["welcome", "choice", "action"].map((s, i) => {
          const isActive =
            (s === "welcome" && step === "welcome") ||
            (s === "choice" && step === "choice") ||
            (s === "action" && (step === "create" || step === "join"));

          return (
            <div key={s} className="flex items-center">
              <div className={`w-3 h-3 rounded-full transition-colors ${isActive ? "bg-primary" : "bg-default-200"}`} />
              {i < 2 && <div className="w-8 h-[2px] bg-default-200" />}
            </div>
          );
        })}
      </motion.div>
    );

    switch (step) {
      case "welcome":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center space-y-6"
          >
            {stepIndicators}
            <div className="space-y-4">
              <Icon icon="lucide:gauge" className="text-6xl text-primary mx-auto" />
              <h2 className="text-2xl font-semibold">Welcome to MultiGage Cloud</h2>
              <p className="text-foreground-600">
                Connect your industrial sensors and start monitoring in real-time. Join thousands of companies already
                using MultiGage Cloud for their IoT needs.
              </p>
            </div>
            <Button color="primary" size="lg" className="w-full" onPress={() => setStep("choice")}>
              Get Started
            </Button>
          </motion.div>
        );

      case "choice":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {stepIndicators}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold">Join MultiGage Cloud</h2>
              <p className="text-foreground-600">Create a new organization or join an existing one</p>
            </div>
            <div className="grid gap-4">
              <Button
                size="lg"
                color="primary"
                className="w-full"
                onPress={() => setStep("create")}
                startContent={<Icon icon="lucide:plus-circle" />}
              >
                Create Organization
              </Button>
              <Button
                size="lg"
                variant="flat"
                className="w-full"
                onPress={() => setStep("join")}
                startContent={<Icon icon="lucide:users" />}
              >
                I Have an Invite Code
              </Button>
            </div>
          </motion.div>
        );

      case "create":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {stepIndicators}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Create Organization</h2>
              <motion.div
                className="relative h-32 rounded-xl flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Icon icon="lucide:factory" className="text-3xl text-primary" />
                <div className="absolute inset-0 flex items-center justify-center gap-4">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-8 h-8 bg-default-200 rounded-full flex items-center justify-center"
                      animate={{ y: [-30, -55, -30] }}
                      transition={{ delay: i * 0.2, repeat: Infinity, duration: 2.5 }}
                    >
                      <Icon icon="lucide:wifi" className="text-sm text-primary" />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
              <form onSubmit={createForm.handleSubmit(handleCreateOrg)} className="space-y-4">
                <Controller
                  control={createForm.control}
                  name="orgName"
                  render={({ field }) => (
                    <Input
                      {...field}
                      label="Organization Name"
                      placeholder="Enter organization name"
                      isRequired
                      validationState={createForm.formState.errors.orgName ? "invalid" : undefined}
                      errorMessage={createForm.formState.errors.orgName?.message}
                    />
                  )}
                />
                <div className="space-y-2">
                  <Input
                    label="Invite Team Members (Optional)"
                    placeholder="Enter email and press Enter"
                    value={createForm.watch("emails").length < 3 ? "" : undefined}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const email = (e.target as HTMLInputElement).value;
                        if (email && createForm.watch("emails").length < 3) {
                          createForm.setValue("emails", [...createForm.watch("emails"), email]);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                    description="You can invite up to 3 team members"
                    errorMessage={createForm.formState.errors.emails?.message}
                  />
                  <div className="flex flex-wrap gap-2">
                    {createForm.watch("emails").map((email) => (
                      <div key={email} className="bg-default-100 px-3 py-1 rounded-full flex items-center gap-2">
                        <span className="text-sm">{email}</span>
                        <button
                          type="button"
                          onClick={() => {
                            createForm.setValue(
                              "emails",
                              createForm.watch("emails").filter((e) => e !== email)
                            );
                          }}
                          className="text-default-400 hover:text-danger"
                        >
                          <Icon icon="lucide:x" className="text-sm" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="flat"
                    onPress={() => setStep("choice")}
                    startContent={<Icon icon="lucide:arrow-left" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    color="primary"
                    className="flex-1"
                    isLoading={createForm.formState.isSubmitting}
                  >
                    {createForm.watch("emails").length > 0 ? "Create & Invite Team" : "Create Organization"}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        );

      case "join":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {stepIndicators}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold">Join Organization</h2>
              <form onSubmit={joinForm.handleSubmit(handleJoinOrg)} className="space-y-4">
                <InputOtp
                  length={6}
                  value={otpValue}
                  onValueChange={(value) => {
                    setOtpValue(value);
                    joinForm.setValue("inviteCode", value);
                  }}
                  classNames={{ input: "w-11 h-11 text-lg", base: "gap-2" }}
                  validationState={joinForm.formState.errors.inviteCode ? "invalid" : undefined}
                  errorMessage={joinForm.formState.errors.inviteCode?.message}
                />
                <div className="flex gap-3">
                  <Button
                    variant="flat"
                    onPress={() => setStep("choice")}
                    startContent={<Icon icon="lucide:arrow-left" />}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    color="primary"
                    className="flex-1"
                    isLoading={joinForm.formState.isSubmitting}
                    isDisabled={otpValue.length !== 6}
                  >
                    Join Organization
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      isDismissable={false}
      backdrop="blur"
      motionProps={{
        variants: {
          enter: {
            y: 0,
            opacity: 1,
            transition: {
              duration: 0.3,
              ease: "easeOut",
            },
          },
          exit: {
            y: -20,
            opacity: 0,
            transition: {
              duration: 0.2,
              ease: "easeIn",
            },
          },
        },
      }}
    >
      <ModalContent>
        <ModalBody className="p-6">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
