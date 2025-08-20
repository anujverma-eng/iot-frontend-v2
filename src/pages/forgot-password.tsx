// src/pages/forgot-password.tsx 
import React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Card, CardBody, Input, InputOtp, Button, Link, addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { forgotPw } from "../store/authSlice";
import { confirmCode, start, tick, resendCode, clear } from "../store/confirmationSlice";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { emailSchema, passwordSchema } from "../lib/validation";

/* ---------- schema ---------- */
const schema = z.object({
  email: emailSchema,
  code: z.string().length(6, "Enter the 6‑digit code"),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});

type FormValues = z.infer<typeof schema>;

export function ForgotPassword() {
  const dispatch = useAppDispatch();
  const confirm = useAppSelector(s => s.confirmation);

  // Clear any existing state on initial load
  React.useEffect(() => {
    dispatch(clear());
  }, [dispatch]);

  const resetForm = useForm<FormValues>({
    defaultValues: {
      email: "",
      code: "",
      password: "",
      confirmPassword: "",
    },
    resolver: zodResolver(schema),
  });

  // Update form email when confirmation state changes
  React.useEffect(() => {
    if (confirm.email) {
      resetForm.setValue('email', confirm.email);
    }
  }, [confirm.email, resetForm]);

  // ───────────────────────── form setup
  const emailForm = useForm<{ email: string }>({
    defaultValues: {
      email: confirm.email ?? "",
    },
    resolver: zodResolver(z.object({ email: emailSchema })),
  });

  // ───────────────────────── local state
  const [sent, setSent] = React.useState(false);
  const [vis1, setVis1] = React.useState(false);
  const [vis2, setVis2] = React.useState(false);
  const [isSendingCode, setIsSendingCode] = React.useState(false);
  const [otpValue, setOtpValue] = React.useState("");

  // resend timer UI
  const [sec, setSec] = React.useState(0);
  React.useEffect(() => {
    if (!confirm.expiresAt) return;
    const id = setInterval(() => {
      dispatch(tick());
      setSec(Math.max(0, Math.ceil((confirm.expiresAt! - Date.now()) / 1000)));
    }, 1_000);
    return () => clearInterval(id);
  }, [confirm.expiresAt, dispatch]);

  // ───────────────────────── 1) send code
  const sendCode = async (data: { email: string }) => {
    try {
      setIsSendingCode(true);
      await dispatch(forgotPw(data.email)).unwrap();
      dispatch(start({ flow: "forgot", email: data.email }));
      resetForm.setValue("email", data.email);
      setSent(true);
      setOtpValue("");
      addToast({ title: "Code sent", description: "Check your inbox", color: "success" });
    } catch (err: any) {
      addToast({ title: "Error", description: err.message, color: "danger" });
    } finally {
      setIsSendingCode(false);
    }
  };

  // ───────────────────────── 2) save new password (+code)
  const save = async (data: FormValues) => {
    try {
      if (!confirm.email) {
        throw new Error("Session expired - please start the process again");
      }
      
      await dispatch(confirmCode({
        code: data.code,
        newPassword: data.password
      })).unwrap();

      addToast({ title: "Password updated", color: "success" });
      dispatch(clear());
      window.location.href = "/login";
    } catch (e: any) {
      addToast({
        title: "Failed",
        description: e.message || "Failed to reset password",
        color: "danger"
      });
      if (e.message.includes("expired")) {
        dispatch(clear());
        setSent(false);
      }
    }
  };

  // Handle OTP value change
  const handleOtpChange = (value: string) => {
    setOtpValue(value);
    resetForm.setValue("code", value);
  };

  // ───────────────────────── UI
  return (
    <div className="flex min-h-screen">
      {/* === unchanged hero / illustration column === */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary-600 to-primary-800">
        <div className="absolute inset-0">
          <motion.div
            animate={{
              backgroundPosition: ["0% 0%", "100% 100%"],
              opacity: [0.1, 0.3, 0.1],
            }}
            transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
            className="absolute inset-0 bg-[url('https://img.heroui.chat/image/ai?w=1000&h=1000&u=pattern')] bg-repeat opacity-10"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 flex flex-col justify-center p-12"
        >
          <h1 className="text-white text-4xl font-bold mb-4">Reset your password</h1>
          <p className="text-white/90 text-lg">
            We'll help you get back into your account securely and quickly.
          </p>

          <motion.div
            className="mt-12 grid grid-cols-2 gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Info icon="lucide:shield"  title="Secure"  text="Multi‑factor authentication" />
            <Info icon="lucide:clock"   title="Fast"    text="No lengthy forms"           />
          </motion.div>
        </motion.div>
      </div>

      {/* === right column card === */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-md">
          <CardBody className="gap-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              {!sent ? (
                <form onSubmit={emailForm.handleSubmit(sendCode)} className="flex flex-col gap-4">
                  <h2 className="text-2xl font-bold">Forgot password?</h2>
                  <p className="text-default-500">
                    Enter your email address and we'll send you a 6‑digit verification code to reset your password.
                  </p>

                  <Controller
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <Input
                        {...field}
                        type="email"
                        name="email"
                        label="E‑mail"
                        isRequired
                        autoComplete="email"
                        validationState={emailForm.formState.errors.email ? "invalid" : undefined}
                        errorMessage={emailForm.formState.errors.email?.message}
                        startContent={<Icon icon="lucide:mail" width={20} className="text-default-400" />}
                        placeholder="Enter your email address"
                      />
                    )}
                  />

                  <Button 
                    type="submit" 
                    color="primary" 
                    className="w-full"
                    isLoading={isSendingCode}
                  >
                    Send reset code
                  </Button>

                  <p className="text-center text-default-500 text-sm">
                    Remember it?&nbsp;
                    <Link as={RouterLink} to="/login" color="primary">Sign in</Link>
                  </p>
                </form>
              ) : (
                <form onSubmit={resetForm.handleSubmit(save)} className="flex flex-col gap-5">
                  <h2 className="text-2xl font-bold">Reset password</h2>
                  <p className="text-default-500">
                    Enter the 6‑digit code sent to your email and create a new password.
                  </p>

                  <InputOtp
                    length={6}
                    value={otpValue}
                    onValueChange={handleOtpChange}
                    classNames={{ input: "w-11 h-11 text-lg", base: "gap-2" }}
                    validationState={resetForm.formState.errors.code ? "invalid" : undefined}
                    errorMessage={resetForm.formState.errors.code?.message}
                  />

                  <Controller
                    control={resetForm.control}
                    name="password"
                    render={({ field }) => (
                      <Input
                        {...field}
                        name="password"
                        label="New password"
                        type={vis1 ? "text" : "password"}
                        isRequired
                        autoComplete="new-password"
                        validationState={resetForm.formState.errors.password ? "invalid" : undefined}
                        errorMessage={resetForm.formState.errors.password?.message}
                        startContent={<Icon icon="lucide:lock" width={20} className="text-default-400" />}
                        endContent={
                          <button type="button" onClick={() => setVis1(!vis1)}>
                            <Icon icon={vis1 ? "lucide:eye-off" : "lucide:eye"} width={20} className="text-default-400" />
                          </button>
                        }
                        placeholder="Create a new password"
                      />
                    )}
                  />

                  <Controller
                    control={resetForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <Input
                        {...field}
                        name="confirmPassword"
                        label="Confirm password"
                        type={vis2 ? "text" : "password"}
                        isRequired
                        autoComplete="new-password"
                        validationState={resetForm.formState.errors.confirmPassword ? "invalid" : undefined}
                        errorMessage={resetForm.formState.errors.confirmPassword?.message}
                        startContent={<Icon icon="lucide:lock" width={20} className="text-default-400" />}
                        endContent={
                          <button type="button" onClick={() => setVis2(!vis2)}>
                            <Icon icon={vis2 ? "lucide:eye-off" : "lucide:eye"} width={20} className="text-default-400" />
                          </button>
                        }
                        placeholder="Confirm your new password"
                      />
                    )}
                  />

                  <Button
                    type="submit"
                    color="primary"
                    className="w-full"
                    isLoading={resetForm.formState.isSubmitting}
                    isDisabled={resetForm.formState.isSubmitting}
                  >
                    Save new password
                  </Button>

                  <p className="text-center text-xs text-default-600">
                    {confirm.remaining === 0 ? (
                      "Resend limit reached"
                    ) : confirm.expiresAt ? (
                      `Resend in ${sec}s`
                    ) : (
                      <Button variant="light" size="sm" onPress={() => dispatch(resendCode())}>
                        Resend code ({confirm.remaining} left)
                      </Button>
                    )}
                  </p>
                </form>
              )}
            </motion.div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/* tiny helper for the hero bullet cards */
function Info({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="p-6 rounded-lg bg-white/10 backdrop-blur-sm">
      <Icon icon={icon} className="text-white mb-4" width={32} />
      <h3 className="text-white text-lg font-semibold mb-1">{title}</h3>
      <p className="text-white/80 text-sm">{text}</p>
    </div>
  );
}
