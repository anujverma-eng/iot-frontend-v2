// src/lib/apiClient.ts
import axios, { AxiosError, type AxiosInstance, type CancelTokenSource } from "axios";
import { tokenManager } from "../utils/tokenManager";
import { AuthClient } from "./auth/cognitoClient";
import { v4 as uuid } from "uuid";
import { UserRole } from "../types/User";

declare module "axios" {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

/* ---------- instance ---------- */
const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

/* ---------- request: add JWT & trace‑id ---------- */
apiClient.interceptors.request.use((cfg) => {
  const t = tokenManager.load();
  console.log(t);
  if (t?.idToken) {
    cfg.headers.Authorization = `Bearer ${t.idToken}`;
  } else if (t?.accessToken) {
    cfg.headers.Authorization = `Bearer ${t.accessToken}`;
  }
  cfg.headers["X-Request-ID"] = uuid();
  return cfg;
});

/* ------------------------------------------------------------------ */
/* 3)  response interceptor – single refresh queue                    */
/* ------------------------------------------------------------------ */
let ongoingRefresh: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    /* if it's not 401 → bubble up */
    if (err.response?.status !== 401) throw err;

    const original = err.config!;
    if (original._retry) throw err; // already retried once

    /* ----- start (or join) a refresh cycle ----- */
    if (!ongoingRefresh) {
      ongoingRefresh = silentRefresh().finally(() => {
        ongoingRefresh = null;
      });
    }

    const newAccess = await ongoingRefresh;

    /* mark so we don't recurse forever */
    original._retry = true;
    original.headers.set("Authorization", `Bearer ${newAccess}`);

    /* IMPORTANT: update defaults so subsequent NEW calls are fresh */
    apiClient.defaults.headers.common.Authorization = `Bearer ${newAccess}`;

    return apiClient(original);
  }
);

/* helper – ask Cognito for a fresh access JWT */
async function silentRefresh(): Promise<string> {
  const saved = tokenManager.load();
  if (!saved) throw new Error("No refresh token – user not logged‑in");

  const fresh = await AuthClient.refresh(saved.refreshToken);

  tokenManager.save({
    accessToken: fresh.access,
    idToken: fresh.id,
    refreshToken: saved.refreshToken, // Cognito keeps same RT
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  });
  return fresh.access;
}

/* ------------------------------------------------------------------ */
/* 4)  cancellation support                                           */
/* ------------------------------------------------------------------ */
/** holds the single CancelTokenSource currently linked to requests */
let currentSource: CancelTokenSource | null = null;

/** attach a fresh cancel‑token to every request */
apiClient.interceptors.request.use((cfg) => {
  /* if we don't have a source OR it has been cancelled → make new */
  if (!currentSource || currentSource.token.reason) {
    currentSource = axios.CancelToken.source();
  }
  cfg.cancelToken = currentSource.token;
  return cfg;
});

/** call this before route changes/unmounts to abort all in‑flight calls */
export function cancelPendingRequests(reason = "Navigation change") {
  currentSource?.cancel(reason);
}

export interface MeDTO {
  _id: string;
  email: string;
  role: UserRole;
  orgId: string | null;
}

export async function getMe(): Promise<MeDTO> {
  const { data } = await apiClient.get("/users/me");
  if (!data?.success) throw new Error(data?.message ?? "ME_FAILED");
  return data.data as MeDTO;
}

export default apiClient;
