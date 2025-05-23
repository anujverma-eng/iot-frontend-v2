// src/store/confirmationSlice.ts
import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";

import type { RootState } from ".";
import { AuthClient } from "../lib/auth/cognitoClient";

export type Flow = "signup" | "forgot";
interface ConfirmationState {
  flow: Flow | null;
  email: string | null;
  expiresAt: number | null; // 60″ cooldown
  remaining: number; // 3 attempts
}
const initial: ConfirmationState = { flow: null, email: null, expiresAt: null, remaining: 3 };

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
  const { email, flow } = (getState() as RootState).confirmation;
  if (!email || !flow) throw new Error("NO_CONTEXT");
  if (flow === "signup") await AuthClient.resendConfirmation(email);
  else await AuthClient.forgotPassword(email);
});

export const confirmCode = createAsyncThunk<void, { code: string; newPassword?: string }, { state: RootState }>(
  "confirmation/confirm",
  async ({ code, newPassword }, { getState }) => {
    const { flow, email } = getState().confirmation;
    if (!email || !flow) throw new Error("NO_CONTEXT");

    if (flow === "signup") await AuthClient.confirmSignUp(email, code);
    else if (newPassword) await AuthClient.confirmForgot(email, code, newPassword);
    else throw new Error("MISSING_PASSWORD");
  }
);

/* ––––– slice ––––– */
const confirmationSlice = createSlice({
  name: "confirmation",
  initialState: load(),
  reducers: {
    start(_, a: PayloadAction<{ flow: Flow; email: string }>) {
      const s: ConfirmationState = {
        flow: a.payload.flow,
        email: a.payload.email,
        expiresAt: Date.now() + 60_000,
        remaining: 3,
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
