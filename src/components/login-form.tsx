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

  const nextUrl = searchParams.get('next');

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
      
      // Handle post-auth navigation
      if (nextUrl) {
        navigate(decodeURIComponent(nextUrl));
      } else {
        // Check for postAuth in localStorage
        const postAuth = localStorage.getItem('postAuth');
        if (postAuth) {
          try {
            const parsed = JSON.parse(postAuth);
            if (parsed.kind === 'invite' && parsed.token) {
              localStorage.removeItem('postAuth');
              navigate(`/invites/${parsed.token}?intent=${parsed.intent || 'accept'}`);
              return;
            }
          } catch (e) {
            console.error('Failed to parse postAuth:', e);
          }
          localStorage.removeItem('postAuth');
        }
        // Default navigation will be handled by PrivateRoute
      }
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

  // Show confirmation block for signup verification
  if(needsCode && confirm){
    return <ConfirmBlock onSuccess={afterCode}/>;
  }

  // Show email verification reminder if user has pending email change
  if(emailVerification && confirmationState.pendingEmail){
    return (
      <div className="py-4 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold text-foreground">Email Verification Required</h2>
          <p className="text-default-500">
            You have a pending email verification. Please verify your new email address before signing in.
          </p>
        </div>
        
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon icon="lucide:mail-check" className="h-5 w-5 text-warning-600" />
            <p className="font-medium text-warning-800">Pending Email Verification</p>
          </div>
          <p className="text-sm text-warning-700 mb-3">
            New email: <strong>{confirmationState.pendingEmail}</strong>
          </p>
          <p className="text-sm text-warning-700 mb-4">
            Please check your email and verify your new address to complete the change.
          </p>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              color="primary"
              onPress={() => navigate('/profile')}
            >
              Complete Verification
            </Button>
            <Button
              size="sm"
              variant="light"
              color="danger"
              onPress={async () => {
                try {
                  // Cancel the email change process
                  await UserService.cancelEmailChange();
                  
                  dispatch(clear());
                  addToast({
                    title: 'Email Change Cancelled',
                    description: 'Your email change has been cancelled',
                    color: 'warning'
                  });
                } catch (error) {
                  // Even if cancellation fails, clear the state
                  dispatch(clear());
                  addToast({
                    title: 'Email Change Cancelled',
                    description: 'Email change cancelled. Please check your email status.',
                    color: 'warning'
                  });
                }
              }}
            >
              Cancel Email Change
            </Button>
          </div>
        </div>

        <p className="text-center text-default-500 text-sm">
          Or continue with your current email address by completing the verification first.
        </p>
      </div>
    );
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
