// src/components/register-form.tsx
import { Input, Button, Checkbox, Link, Select, SelectItem, addToast, InputOtp } from "@heroui/react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import React from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { ControllerRenderProps, Control, FieldPath } from "react-hook-form";
import { login, register } from "../store/authSlice";
import { emailSchema, passwordSchema } from "../lib/validation";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import type { SubmitHandler } from "react-hook-form";
import { motion } from "framer-motion";
import { start } from "../store/confirmationSlice";
import { ConfirmBlock } from "./ConfirmBlock";

/* ---------- constants ---------- */
const countryPhoneCodes = [
  { code: "+1", label: "United States" },
  { code: "+44", label: "United Kingdom" },
] as const;

/* ---------- schema ---------- */
const schema = z
  .object({
    fullName: z.string().min(2, "Full name required"),
    // organization: z.string().optional(),
    email: emailSchema,
    phoneCode: z.enum(countryPhoneCodes.map((c) => c.code) as [string, ...string[]]),
    phone: z.string().optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    accept: z.literal(true, { errorMap: () => ({ message: "You must accept the terms" }) }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type FormValues = z.infer<typeof schema>;

export function RegisterForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const confirm = useAppSelector((s) => s.confirmation.flow === "signup");
  const [step, setStep] = React.useState<"form" | "code">("form");

  const nextUrl = searchParams.get('next');

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      fullName: "",
      // organization: "",
      email: "",
      phoneCode: "+1",
      phone: "",
      password: "",
      confirmPassword: "",
      accept: false,
    },
    resolver: zodResolver(schema),
  } as any); // Explicitly cast to ensure compatibility

  /* ---------- submit ---------- */
  const onSubmit: SubmitHandler<FormValues> = async (data: FormValues) => {
    try {
      await dispatch(register({ email: data.email, password: data.password })).unwrap();
      addToast({ title: "Account created", description: "Check your inbox to verify your email.", color: "success" });
      dispatch(start({ flow: "signup", email: data.email }));
      setStep("code");
    } catch (e: any) {
      addToast({
        title: "Registration failed",
        description: e.message ?? "Unknown error",
        color: "danger",
      });
    }
  };

  const handleCodeOk = async () => {
    // 2nd step – sign‑in automatically
    const email = watch("email");
    const password = watch("password");
    try {
      await dispatch(login({ email, password })).unwrap();
      
      // Handle post-auth navigation
      if (nextUrl) {
        navigate(decodeURIComponent(nextUrl));
      } else {
        // Let AuthBootstrap handle postAuth logic to avoid conflicts
        // Default navigation will be handled by PrivateRoute
      }
    } catch (e: any) {
      addToast({ title: "Login failed", description: e.message, color: "danger" });
    }
  };

  // const handleVerifyOTP = async () => {
  //   try {
  //     // Mock OTP verification
  //     if (otpValue === "123456") {
  //       // Demo correct OTP
  //       addToast({
  //         title: "Success",
  //         description: "Account created successfully",
  //         color: "success",
  //       });
  //       // Redirect to dashboard
  //       window.location.href = "/dashboard";
  //     } else {
  //       addToast({
  //         title: "Invalid Code",
  //         description: "Please enter the correct verification code",
  //         color: "danger",
  //       });
  //     }
  //   } catch (error) {
  //     addToast({
  //       title: "Verification Failed",
  //       description: "Please try again",
  //       color: "danger",
  //     });
  //   }
  // };

  if(step==='code' && confirm) {
    return (
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
        <ConfirmBlock onSuccess={handleCodeOk}/>
      </motion.div>
    );
  }
  
  // if (showOTP) {
  //   return (
  //     <motion.div
  //       initial={{ opacity: 0, y: 20 }}
  //       animate={{ opacity: 1, y: 0 }}
  //       transition={{ duration: 0.3 }}
  //       className="py-4 flex flex-col gap-4"
  //     >
  //       <div className="flex flex-col gap-2">
  //         <h2 className="text-xl font-semibold text-foreground">Verify Your Email</h2>
  //         <p className="text-default-500">Enter the 6-digit code sent to your email</p>
  //       </div>

  //       <div className="flex flex-col gap-4">
  //         <InputOtp
  //           length={6}
  //           value={otpValue}
  //           onValueChange={setOtpValue}
  //           classNames={{
  //             input: "w-12 h-12 text-lg",
  //             base: "gap-2",
  //           }}
  //         />

  //         <Button color="primary" className="w-full" onPress={handleVerifyOTP} isDisabled={otpValue.length !== 6}>
  //           Verify Code
  //         </Button>

  //         <p className="text-center text-default-500 text-sm">
  //           Didn't receive the code?{" "}
  //           <Button variant="light" className="p-0" onPress={() => setOtpValue("")}>
  //             Resend
  //           </Button>
  //         </p>
  //       </div>
  //     </motion.div>
  //   );
  // }

  /* ---------- UI ---------- */
  return (
    <form onSubmit={handleSubmit(onSubmit as SubmitHandler<FormValues>)} className="flex flex-col gap-5 py-4" autoComplete="on">
      {/* --- name ---------------------------------- */}
      <Controller
        control={control}
        name="fullName"
        render={({ field }) => (
          <Input
            {...field}
            name="fullName"
            label="Full Name"
            isRequired
            autoComplete="name"
            validationState={errors.fullName ? "invalid" : undefined}
            errorMessage={errors.fullName?.message}
            startContent={<Icon icon="lucide:user" className="text-default-400" width={20} />}
            placeholder="John Doe"
          />
        )}
      />

      {/* --- email & phone ---------------------------------------- */}
      {/* <div className="grid gap-4 lg:grid-cols-2"> */}
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Input
            {...field}
            type="email"
            name="email"
            label="Email"
            isRequired
            autoComplete="email"
            validationState={errors.email ? "invalid" : undefined}
            errorMessage={errors.email?.message}
            startContent={<Icon icon="lucide:mail" className="text-default-400" width={20} />}
            placeholder="example@example.com"
          />
        )}
      />
{/* 
      <Controller
        control={control}
        name="organization"
        render={({ field }) => (
          <Input
            {...field}
            label="Organization (optional)"
            startContent={<Icon icon="lucide:building" className="text-default-400" width={20} />}
            placeholder="Your organization name"
          />
        )}
      /> */}

      {/* <div className="flex gap-2">
          <Controller
            name="phoneCode"
            control={control}
            render={({ field }) => (
              <Select
                {...field}
                label="Code"
                className="w-20 shrink-0"
              >
                {countryPhoneCodes.map(({ code, label }) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </Select>
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field }) => (
              <Input
                {...field}
                type="tel"
                label="Phone (optional)"
                className="flex-1"
              />
            )}
          />
        </div> */}

      {/* --- password --------------------------------------------- */}
      {/* <div className="grid gap-4 lg:grid-cols-2"> */}
      <PasswordInput control={control} name="password" label="Password" error={errors.password?.message} />
      <PasswordInput
        control={control}
        name="confirmPassword"
        label="Confirm Password"
        error={errors.confirmPassword?.message}
      />
      {/* </div> */}

      {/* --- terms ------------------------------------------------- */}
      <Controller
        control={control}
        name="accept"
        render={({ field }) => (
          <Checkbox
            isSelected={field.value}
            onValueChange={field.onChange}
            validationState={errors.accept ? "invalid" : undefined}
          >
            I agree to the{" "}
            <Link as={RouterLink} to="/terms" color="primary">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link as={RouterLink} to="/privacy" color="primary">
              Privacy Policy
            </Link>
          </Checkbox>
        )}
      />

      {/* --- action ----------------------------------------------- */}
      <Button type="submit" color="primary" className="w-full" isLoading={isSubmitting}>
        Create Account
      </Button>

      {/* --- OAuth stubs ------------------------------------------ */}
      <DividerWithText text="or continue with" />

      <div className="flex gap-4">
        <OauthButton provider="google" />
        <OauthButton provider="microsoft" />
      </div>
    </form>
  );
}

/* ---------------------------------------------------------------- *\
   Helper sub‑components
\* ---------------------------------------------------------------- */

function DividerWithText({ text }: { text: string }) {
  return (
    <div className="relative flex items-center gap-4 py-4">
      <div className="flex-1 border-t" />
      <span className="text-default-600 text-xs">{text}</span>
      <div className="flex-1 border-t" />
    </div>
  );
}

function OauthButton({ provider }: { provider: "google" | "microsoft" }) {
  const logos: Record<string, string> = {
    google: "logos:google-icon",
    microsoft: "logos:microsoft-icon",
  };

  return (
    <Button
      variant="flat"
      className="flex-1"
      startContent={<Icon icon={logos[provider]} width={20} />}
      onClick={() => addToast({ title: "Not implemented", color: "warning" })}
    >
      {provider[0].toUpperCase() + provider.slice(1)}
    </Button>
  );
}

/** Re‑usable eye‑toggle password field */
function PasswordInput<TFieldValues extends FormValues, TName extends FieldPath<TFieldValues>>({
  control,
  name,
  label,
  error,
}: {
  control: Control<TFieldValues>;
  name: TName;
  label: string;
  error?: string;
}) {
  const [visible, setVisible] = React.useState(false);

  // Determine autocomplete value based on field name
  const getAutoComplete = (fieldName: string) => {
    if (fieldName === 'password') return 'new-password';
    if (fieldName === 'confirmPassword') return 'new-password';
    return 'current-password';
  };

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }: { field: ControllerRenderProps<TFieldValues, TName> }) => (
        <Input
          {...field}
          name={name as string}
          value={(field?.value as string) ?? ""}
          type={visible ? "text" : "password"}
          label={label}
          isRequired
          autoComplete={getAutoComplete(name as string)}
          validationState={error ? "invalid" : undefined}
          errorMessage={error}
          startContent={<Icon icon="lucide:lock" className="text-default-400" width={20} />}
          endContent={
            <button type="button" onClick={() => setVisible(!visible)}>
              <Icon icon={visible ? "lucide:eye" : "lucide:eye-off"} className="text-default-400" width={20} />
            </button>
          }
        />
      )}
    />
  );
}
