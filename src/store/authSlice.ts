// src/store/authSlice.ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { RootState } from ".";
import { AuthClient } from "../lib/auth/cognitoClient";
import { UserRole } from "../types/User";
import { tokenManager } from "../utils/tokenManager";
import { start } from "./confirmationSlice";
import { fetchProfile } from "./profileSlice";
import { fetchOrg } from "./orgSlice";

type Status = "idle" | "loading" | "auth" | "guest" | "error";

interface AuthState {
  status: Status;
  user: { email: string; role: UserRole; orgId: string | null } | null;
  pendingEmail: string | null;
  error: string | null;
}
const initial: AuthState = { status: "idle", user: null, pendingEmail: null, error: null };

const setSession = (s: AuthState, p: { access: string; refresh: string; exp: number; id: string }) => {

  s.status = "auth";
  s.user = { email: JSON.parse(atob(p.id.split(".")[1])).email ?? "user", role: extractRole(p.id), orgId: null };
  tokenManager.save({ accessToken: p.access, refreshToken: p.refresh, expiresAt: p.exp, idToken: p.id });
};

/* ---------- Thunks ---------- */
export const login = createAsyncThunk("auth/login", async (form: { email: string; password: string }, { dispatch }) => {
  try {
    const tokens = await AuthClient.signIn(form.email, form.password);
    dispatch(fetchProfile());
    dispatch(fetchOrg());
    return tokens;
  } catch (e: any) {
    if (e.code === "UserNotConfirmedException") {
      dispatch(start({ flow: "signup", email: form.email }));
      throw new Error("ACCOUNT_NOT_CONFIRMED");
    }
    throw e;
  }
});

export const register = createAsyncThunk("auth/register", async (form: { email: string; password: string }) => {
  await AuthClient.signUp(form.email, form.password);
  return form.email; // stash for confirm page
});

export const confirmRegister = createAsyncThunk("auth/confirmRegister", async (p: { email: string; code: string }) => {
  await AuthClient.confirmSignUp(p.email, p.code);
});

export const forgotPw = createAsyncThunk("auth/forgotPw", async (email: string) => {
  await AuthClient.forgotPassword(email);
  return email;
});

export const resetPw = createAsyncThunk("auth/resetPw", async (p: { email: string; code: string; newPw: string }) => {
  await AuthClient.confirmForgot(p.email, p.code, p.newPw);
});

export const logout = createAsyncThunk("auth/logout", async (_, { getState }) => {
  /* 1️clear local Cognito cache so no session survives refresh */
  AuthClient.signOutLocal();

  /* 2️ remote revoke – ignore network errors */
  const email = (getState() as RootState).auth.user?.email;
  if (email) {
    try {
      await AuthClient.globalSignOut(email);
    } catch {
      /* ignore */
    }
  }

  /* 3️ wipe our encrypted JWT copy */
  tokenManager.clear();

  /* 4️ hard redirect */
  window.location.assign("/login");
});

/* helper: pull role claim out of a JWT payload */
const extractRole = (jwt: string): UserRole => {
  try {
    const payload = JSON.parse(atob(jwt.split(".")[1]));
    return (payload["custom:role"] ?? UserRole.OWNER) as UserRole;
  } catch {
    return UserRole.OWNER;
  }
};

/* ---------- Slice ---------- */
const slice = createSlice({
  name: "auth",
  initialState: initial,
  reducers: {},
  extraReducers: (builder) => {
    /* ── login flow ─────────────────────────────────────────────── */
    builder.addCase(login.pending, (s) => {
      s.status = "loading";
      s.error = null;
    });
    builder.addCase(login.fulfilled, (s, a) => setSession(s, { ...a.payload, id: a.payload.id }));

    builder.addCase(login.rejected, (s, a) => {
      s.status = "error";
      s.error = a.error?.message ?? "Login failed";
    });

    /* ── register (keep as you had) ─────────────────────────────── */
    builder.addCase(register.fulfilled, (s, a) => {
      s.pendingEmail = a.payload;
    });

    /* ── start‑up session probe ─────────────────────────────────── */
    builder.addCase(initSession.pending, (s) => {
      s.status = "loading";
    });
    builder.addCase(initSession.fulfilled, (s, a) => {
      s.status = "auth";
      s.user = {
        email: a.payload.email,
        role: extractRole(a.payload.id),
        orgId: null,
      };
    });
    builder.addCase(initSession.rejected, (s, action) => {
      /* Nothing in storage or session is invalid → treat as logged‑out */
      s.status = "guest"; // user is NOT authenticated
      s.error = action.error.message ?? null;
    });
    builder.addCase(logout.fulfilled, () => ({ ...initial, status: "guest" }));
    builder.addCase(fetchProfile.fulfilled, (s, a) => {
      if (!s.user) return;
      s.user.orgId = a.payload.orgId ?? null; // ← keep auth slice consistent
      s.user.role = a.payload.role as UserRole;
    });
  },
});
export default slice.reducer;

export const initSession = createAsyncThunk("auth/initSession", async () => {
  const sess = await AuthClient.validateSession();
  if (!sess) throw new Error("NO_SESSION");

  tokenManager.save({
    accessToken: sess.access,
    refreshToken: sess.refresh,
    expiresAt: sess.exp,
    idToken: sess.id,
  });
  return { email: sess.email, id: sess.id };
});
