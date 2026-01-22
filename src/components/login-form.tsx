// src/components/login-form.tsx
import { Button, Input, Link, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { login } from "../store/authSlice";
import { start, clear } from "../store/confirmationSlice";
import { ConfirmBlock } from "./ConfirmBlock";
import { UserService } from "../api/user.service";

export function LoginForm() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isVisible, setIsVisible] = React.useState(false);

  const status = useAppSelector((s) => s.auth.status);
  const confirmationState = useAppSelector((s) => s.confirmation);
  const confirm = confirmationState.flow === "signup";
  const emailVerification = confirmationState.flow === "email-change";
  const [needsCode, setNeedsCode] = React.useState(false);

  const nextUrl = searchParams.get("next");

  const validateForm = () => {
    if (!email) {
      addToast({
        title: "Email Required",
        description: "Please enter your email address",
        color: "warning",
      });
      return false;
    }
    if (!password) {
      addToast({
        title: "Password Required",
        description: "Please enter your password",
        color: "warning",
      });
      return false;
    }
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await dispatch(login({ email, password })).unwrap();

      if (nextUrl) {
        navigate(decodeURIComponent(nextUrl));
      } else {
        const postAuth = localStorage.getItem("postAuth");
        if (postAuth) {
          try {
            const parsed = JSON.parse(postAuth);
            if (parsed.kind === "invite" && parsed.token) {
              localStorage.removeItem("postAuth");
              navigate(`/invites/${parsed.token}?intent=${parsed.intent || "accept"}`);
              return;
            }
          } catch (err) {
            console.error("Failed to parse postAuth:", err);
          }
          localStorage.removeItem("postAuth");
        }
        // Default navigation handled by PrivateRoute
      }
    } catch (err) {
      const message =
        (typeof err === "string" && err) ||
        (err as { message?: string })?.message ||
        "Incorrect username or password";

      if (message === "ACCOUNT_NOT_CONFIRMED") {
        dispatch(start({ flow: "signup", email }));
        setNeedsCode(true);
        return;
      }

      addToast({
        title: "Login Failed",
        description: message,
        color: "danger",
      });
    }
  };

  const afterCode = () => {
    setNeedsCode(false);
    handleLogin(new Event("submit") as any);
  };

  // Signup verification flow
  if (needsCode && confirm) {
    return <ConfirmBlock onSuccess={afterCode} />;
  }

  // Pending email change flow
  if (emailVerification && confirmationState.pendingEmail) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-[28px] border border-warning-200 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-warning-800/40 dark:bg-black/30">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-warning-100 dark:bg-warning-900/30">
              <Icon icon="lucide:mail-check" className="h-5 w-5 text-warning-700 dark:text-warning-300" />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-foreground">Email Verification Required</h2>
              <p className="mt-1 text-sm text-default-600">
                You have a pending email verification. Please verify your new email address before signing in.
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-warning-200/70 bg-warning-50 p-4 dark:border-warning-800/30 dark:bg-warning-900/10">
            <p className="text-sm text-warning-800 dark:text-warning-200">
              New email: <strong>{confirmationState.pendingEmail}</strong>
            </p>
            <p className="mt-2 text-sm text-warning-700 dark:text-warning-300">
              Please check your inbox and verify your new address to complete the change.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button size="sm" color="primary" onPress={() => navigate("/profile")}>
                Complete Verification
              </Button>

              <Button
                size="sm"
                variant="light"
                color="danger"
                onPress={async () => {
                  try {
                    await UserService.cancelEmailChange();
                    dispatch(clear());
                    addToast({
                      title: "Email Change Cancelled",
                      description: "Your email change has been cancelled",
                      color: "warning",
                    });
                  } catch (error) {
                    dispatch(clear());
                    addToast({
                      title: "Email Change Cancelled",
                      description: "Email change cancelled. Please check your email status.",
                      color: "warning",
                    });
                  }
                }}
              >
                Cancel Email Change
              </Button>
            </div>
          </div>

          <p className="mt-4 text-center text-sm text-default-500">
            Or continue by completing verification first.
          </p>
        </div>
      </div>
    );
  }

  // Main login UI (redesigned)
  return (
    <div className="w-full max-w-md -mt-6">
      <div className="rounded-[32px] bg-white/80 p-7 backdrop-blur dark:bg-black/30">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-primary/10">
            <Icon icon="lucide:user" className="h-6 w-6 text-primary" />
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-medium text-foreground">
            Welcome back
          </h2>

          <p className="mt-2 text-sm text-default-600">
            Sign in to your LiveAccess Portal
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-divider bg-background/60 px-3 py-1 text-xs text-default-600">
            <Icon icon="lucide:shield-check" className="h-4 w-4 text-primary" />
            Secure sign-in
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="mt-7 flex flex-col gap-4" autoComplete="on">
          <Input
            type="email"
            name="email"
            label="Email"
            placeholder="name@company.com"
            value={email}
            onValueChange={setEmail}
            isRequired
            autoComplete="email"
            variant="bordered"
            startContent={<Icon className="text-default-400" icon="lucide:mail" width={20} />}
            classNames={{
              inputWrapper: "bg-background/60 backdrop-blur",
            }}
          />

          <Input
            name="password"
            label="Password"
            placeholder="Enter your password"
            value={password}
            onValueChange={setPassword}
            isRequired
            autoComplete="current-password"
            variant="bordered"
            endContent={
              <button
                type="button"
                onClick={() => setIsVisible(!isVisible)}
                className="rounded-md p-1 text-default-400 hover:text-default-600"
                aria-label={isVisible ? "Hide password" : "Show password"}
              >
                <Icon icon={isVisible ? "lucide:eye" : "lucide:eye-off"} width={20} />
              </button>
            }
            startContent={<Icon className="text-default-400" icon="lucide:key-round" width={20} />}
            type={isVisible ? "text" : "password"}
            classNames={{
              inputWrapper: "bg-background/60 backdrop-blur",
            }}
          />

          <div className="flex items-center justify-between">
            <Link as={RouterLink} to="/forgot-password" color="primary" size="sm">
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            color="primary"
            className="mt-1 w-full font-medium"
            size="lg"
            isLoading={status === "loading"}
            isDisabled={status === "loading"}
          >
            Login
          </Button>
        </form>
      </div>
    </div>
  );
}