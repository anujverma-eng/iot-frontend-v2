// src/store/confirmationSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";

import type { RootState } from ".";
import { AuthClient } from "../lib/auth/cognitoClient";

export type Flow = "signup" | "forgot" | "email-change";
interface ConfirmationState {
  flow: Flow | null;
  email: string | null;
  expiresAt: number | null; // 60″ cooldown
  remaining: number; // 3 attempts
  pendingEmail?: string; // for email-change flow, stores the new email being verified
}
const initial: ConfirmationState = { flow: null, email: null, expiresAt: null, remaining: 3, pendingEmail: undefined };

const KEY = 'iot.confirm.ctx';

function load(): ConfirmationState {
  try { 
    return JSON.parse(sessionStorage.getItem(KEY)!) ?? initial; 
  } catch { 
    return initial; 
  }
}

function save(s: ConfirmationState) {
  sessionStorage.setItem(KEY, JSON.stringify(s));
}

/* ––––– helpers ––––– */
export const resendCode = createAsyncThunk("confirmation/resend", async (_: void, { getState }) => {
  const { email, flow, pendingEmail } = (getState() as RootState).confirmation;
  if (!email || !flow) throw new Error("NO_CONTEXT");
  
  if (flow === "signup") await AuthClient.resendConfirmation(email);
  else if (flow === "forgot") await AuthClient.forgotPassword(email);
  else if (flow === "email-change" && pendingEmail) {
    // Import UserService here to avoid circular dependencies
    const { UserService } = await import("../api/user.service");
    await UserService.requestEmailChange(pendingEmail);
  }
});

export const confirmCode = createAsyncThunk<void, { code: string; newPassword?: string }, { state: RootState }>(
  "confirmation/confirm",
  async ({ code, newPassword }, { getState }) => {
    const { flow, email, pendingEmail } = getState().confirmation;
    if (!email || !flow) throw new Error("NO_CONTEXT");

    if (flow === "signup") await AuthClient.confirmSignUp(email, code);
    else if (flow === "forgot" && newPassword) await AuthClient.confirmForgot(email, code, newPassword);
    else if (flow === "email-change" && pendingEmail) {
      const { UserService } = await import("../api/user.service");
      await UserService.verifyEmailChange(code);
    }
    else throw new Error("MISSING_PASSWORD");
  }
);

/* ––––– slice ––––– */
const confirmationSlice = createSlice({
  name: "confirmation",
  initialState: load(),
  reducers: {
    start(_, a: PayloadAction<{ flow: Flow; email: string; pendingEmail?: string }>) {
      const s: ConfirmationState = {
        flow: a.payload.flow,
        email: a.payload.email,
        expiresAt: Date.now() + 60_000,
        remaining: 3,
        pendingEmail: a.payload.pendingEmail,
      };
      save(s);
      return s;
    },
    clear: () => { 
      sessionStorage.removeItem(KEY); 
      return initial; 
    },
    tick(s) {
      if (s.expiresAt && Date.now() > s.expiresAt) s.expiresAt = null;
      save(s);
    },
  },
  extraReducers: (b) => {
    b.addCase(resendCode.fulfilled, (s) => {
      s.expiresAt = Date.now() + 60_000;
      s.remaining -= 1;
    });
  },
});
export default confirmationSlice.reducer;
export const { start, clear, tick } = confirmationSlice.actions;
