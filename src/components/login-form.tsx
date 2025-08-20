// src/components/login-form.tsx
import { Button, Input, Link, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../hooks/useAppDispatch";
import { login } from "../store/authSlice";
import { start } from "../store/confirmationSlice";
import { ConfirmBlock } from "./ConfirmBlock";

export function LoginForm() {
  const dispatch = useAppDispatch();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isVisible, setIsVisible] = React.useState(false);
  const status = useAppSelector((s) => s.auth.status);
  const confirm = useAppSelector((s) => s.confirmation.flow === "signup");
  const [needsCode, setNeedsCode] = React.useState(false);

  // const { toast } = useToast();
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
    } catch (err) {
      const message =
        (typeof err === "string" && err) || (err as { message?: string })?.message || "Incorrect username or password";

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

  const afterCode=()=>{ setNeedsCode(false); handleLogin(new Event('submit') as any); };

  if(needsCode && confirm){
    return <ConfirmBlock onSuccess={afterCode}/>;
  }

  return (
    <div className="py-4 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-foreground">Welcome Back</h2>
        <p className="text-default-500">Access your IoT dashboard and monitor your devices</p>
      </div>

      <form onSubmit={handleLogin} className="flex flex-col gap-4" autoComplete="on">
        <Input
          type="email"
          name="email"
          label="Email"
          placeholder="Enter your email"
          value={email}
          onValueChange={setEmail}
          isRequired
          autoComplete="email"
          startContent={<Icon className="text-default-400" icon="lucide:mail" width={20} />}
        />

        <Input
          name="password"
          label="Password"
          placeholder="Enter your password"
          value={password}
          onValueChange={setPassword}
          isRequired
          autoComplete="current-password"
          endContent={
            <button type="button" onClick={() => setIsVisible(!isVisible)}>
              <Icon className="text-default-400" icon={isVisible ? "lucide:eye" : "lucide:eye-off"} width={20} />
            </button>
          }
          type={isVisible ? "text" : "password"}
        />

        <div className="flex justify-between items-center">
          <Link as={RouterLink} to="/forgot-password" color="primary" size="sm">
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          color="primary"
          className="w-full"
          isLoading={status === "loading"}
          isDisabled={status === "loading"}
        >
          Sign In
        </Button>
      </form>
    </div>
  );
}
