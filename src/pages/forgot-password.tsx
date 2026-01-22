// src/pages/forgot-password.tsx
import React from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Input, InputOtp, Button, Link, addToast } from "@heroui/react";
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
const schema = z
  .object({
    email: emailSchema,
    code: z.string().length(6, "Enter the 6-digit code"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

export function ForgotPassword() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const confirm = useAppSelector((s) => s.confirmation);

  // Clear any existing state on initial load
  React.useEffect(() => {
    dispatch(clear());
  }, [dispatch]);

  const resetForm = useForm<FormValues>({
    defaultValues: { email: "", code: "", password: "", confirmPassword: "" },
    resolver: zodResolver(schema),
  });

  // Update form email when confirmation state changes
  React.useEffect(() => {
    if (confirm.email) resetForm.setValue("email", confirm.email);
  }, [confirm.email, resetForm]);

  const emailForm = useForm<{ email: string }>({
    defaultValues: { email: confirm.email ?? "" },
    resolver: zodResolver(z.object({ email: emailSchema })),
  });

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
    }, 1000);
    return () => clearInterval(id);
  }, [confirm.expiresAt, dispatch]);

  // 1) send code
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

  // 2) save new password (+code)
  const save = async (data: FormValues) => {
    try {
      if (!confirm.email) throw new Error("Session expired - please start the process again");

      await dispatch(
        confirmCode({
          code: data.code,
          newPassword: data.password,
        })
      ).unwrap();

      addToast({ title: "Password updated", color: "success" });
      dispatch(clear());
      navigate("/login");
    } catch (e: any) {
      addToast({
        title: "Failed",
        description: e.message || "Failed to reset password",
        color: "danger",
      });

      if (typeof e?.message === "string" && e.message.toLowerCase().includes("expired")) {
        dispatch(clear());
        setSent(false);
      }
    }
  };

  const handleOtpChange = (value: string) => {
    setOtpValue(value);
    resetForm.setValue("code", value);
  };

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background image */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('https://motionics.com/downloads/images/login-page-bg-20.png')",
        }}
        aria-hidden="true"
      />

      {/* Subtle overlay for readability */}
      <div className="pointer-events-none absolute inset-0 bg-white/70 dark:bg-black/60" aria-hidden="true" />

      {/* Centered card */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 -mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <div className="rounded-[32px] bg-white/80 p-7 backdrop-blur
                          border border-divider
                          shadow-lg shadow-black/5
                          dark:bg-black/30 dark:border-white/10 dark:shadow-black/30">
            {/* Header */}
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-primary/10">
                <Icon icon="lucide:key-round" className="h-6 w-6 text-primary" />
              </div>

              <h2 className="mt-4 text-2xl font-semibold tracking-medium text-foreground">
                {sent ? "Reset your password" : "Forgot your password?"}
              </h2>

              <p className="mt-2 -mb-2 text-sm text-default-600">
                {!sent
                  ? "We'll send a 6-digit code to reset your password"
                  : "Enter the 6-digit code and create a new password"}
              </p>

              {/* <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-divider bg-background/60 px-3 py-1 text-xs text-default-600">
                <Icon icon="lucide:shield-check" className="h-4 w-4 text-primary" />
                Secure reset
              </div> */}
            </div>

            {!sent ? (
              <form onSubmit={emailForm.handleSubmit(sendCode)} className="mt-7 flex flex-col gap-4" autoComplete="on">
                <Controller
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <Input
                      {...field}
                      type="email"
                      name="email"
                      label="Email"
                      placeholder="name@company.com"
                      isRequired
                      autoComplete="email"
                      variant="bordered"
                      validationState={emailForm.formState.errors.email ? "invalid" : undefined}
                      errorMessage={emailForm.formState.errors.email?.message}
                      startContent={<Icon icon="lucide:mail" width={20} className="text-default-400" />}
                      classNames={{ inputWrapper: "bg-background/60 backdrop-blur" }}
                    />
                  )}
                />

                <Button type="submit" color="primary" size="lg" className="mt-1 w-full font-medium" isLoading={isSendingCode}>
                  Send reset code
                </Button>

                <p className="text-center text-m text-default-500">
                  Back to {" "}
                  <Link as={RouterLink} to="/login" color="primary">
                    Login
                  </Link>
                </p>
              </form>
            ) : (
              <form onSubmit={resetForm.handleSubmit(save)} className="mt-7 flex flex-col gap-4" autoComplete="on">
              <div className="flex justify-center">
                <InputOtp
                  length={6}
                  value={otpValue}
                  onValueChange={handleOtpChange}
                  classNames={{
                    base: "gap-2",
                    input: "w-11 h-11 text-lg text-center",
                  }}
                  validationState={resetForm.formState.errors.code ? "invalid" : undefined}
                  errorMessage={resetForm.formState.errors.code?.message}
                />
              </div>
                <Controller
                  control={resetForm.control}
                  name="password"
                  render={({ field }) => (
                    <Input
                      {...field}
                      name="password"
                      label="New password"
                      placeholder="Create a new password"
                      type={vis1 ? "text" : "password"}
                      isRequired
                      autoComplete="new-password"
                      variant="bordered"
                      validationState={resetForm.formState.errors.password ? "invalid" : undefined}
                      errorMessage={resetForm.formState.errors.password?.message}
                      startContent={<Icon icon="lucide:lock" width={20} className="text-default-400" />}
                      endContent={
                        <button
                          type="button"
                          onClick={() => setVis1(!vis1)}
                          className="rounded-md p-1 text-default-400 hover:text-default-600"
                          aria-label={vis1 ? "Hide password" : "Show password"}
                        >
                          <Icon icon={vis1 ? "lucide:eye" : "lucide:eye-off"} width={20} />
                        </button>
                      }
                      classNames={{ inputWrapper: "bg-background/60 backdrop-blur" }}
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
                      placeholder="Re-enter your new password"
                      type={vis2 ? "text" : "password"}
                      isRequired
                      autoComplete="new-password"
                      variant="bordered"
                      validationState={resetForm.formState.errors.confirmPassword ? "invalid" : undefined}
                      errorMessage={resetForm.formState.errors.confirmPassword?.message}
                      startContent={<Icon icon="lucide:lock" width={20} className="text-default-400" />}
                      endContent={
                        <button
                          type="button"
                          onClick={() => setVis2(!vis2)}
                          className="rounded-md p-1 text-default-400 hover:text-default-600"
                          aria-label={vis2 ? "Hide password" : "Show password"}
                        >
                          <Icon icon={vis2 ? "lucide:eye" : "lucide:eye-off"} width={20} />
                        </button>
                      }
                      classNames={{ inputWrapper: "bg-background/60 backdrop-blur" }}
                    />
                  )}
                />

                <Button
                  type="submit"
                  color="primary"
                  size="lg"
                  className="mt-1 w-full font-medium"
                  isLoading={resetForm.formState.isSubmitting}
                  isDisabled={resetForm.formState.isSubmitting}
                >
                  Save new password
                </Button>

                <div className="text-center text-xs text-default-600">
                  {confirm.remaining === 0 ? (
                    "Resend limit reached"
                  ) : confirm.expiresAt ? (
                    `Resend in ${sec}s`
                  ) : (
                    <Button variant="light" size="sm" onPress={() => dispatch(resendCode())}>
                      Resend code ({confirm.remaining} left)
                    </Button>
                  )}
                </div>

                <p className="text-center text-m text-default-500">
                  Back to{" "}
                  <Link as={RouterLink} to="/login" color="primary">
                    sign in
                  </Link>
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}