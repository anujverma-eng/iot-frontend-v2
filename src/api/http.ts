// src/api/http.ts
import axios, { AxiosError, type AxiosInstance, type CancelTokenSource } from "axios";
import { v4 as uuid } from "uuid";
import { tokenManager } from "../utils/tokenManager";
import { AuthClient } from "../lib/auth/cognitoClient";

// Store reference will be set later to avoid circular dependency
let storeRef: any = null;

export const setStoreReference = (store: any) => {
  storeRef = store;
};

/* ------------------------------------------------------------------ */
/*  axios singleton                                                   */
/* ------------------------------------------------------------------ */
const http: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

/* ---------- request: JWT + trace‑id + org-id ------------------------ */
http.interceptors.request.use((cfg) => {
  const t = tokenManager.load();
  if (t?.idToken) cfg.headers.Authorization = `Bearer ${t.idToken}`;
  else if (t?.accessToken) cfg.headers.Authorization = `Bearer ${t.accessToken}`;
  cfg.headers["X-Request-ID"] = uuid();
  
  // Add X-Org-Id header from Redux store
  if (storeRef) {
    const state = storeRef.getState();
    const activeOrgId = state.activeOrg?.orgId;
    if (activeOrgId) {
      cfg.headers["X-Org-Id"] = activeOrgId;
    }
  }
  
  // Debug logging (guarded by env flag)
  if (import.meta.env.VITE_DEBUG_ORG_REQUESTS === 'true') {
    console.log(`[HTTP] ${cfg.method?.toUpperCase()} ${cfg.url}`, {
      'X-Org-Id': cfg.headers["X-Org-Id"] || 'NOT_SET',
      'Authorization': cfg.headers.Authorization ? 'PRESENT' : 'MISSING',
    });
  }
  
  return cfg;
});

/* ---------- response: single silent‑refresh queue -------------------- */
let refreshing: Promise<{ access: string; id: string }> | null = null;

http.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    if (err.response?.status !== 401) throw err;

    const original = err.config!;
    if ((original as any)._retry) throw err; // already retried once

    if (!refreshing) {
      const saved = tokenManager.load();
      if (!saved) throw err; // not logged‑in

      refreshing = AuthClient.refresh(saved.refreshToken).finally(() => {
        refreshing = null;
      });
    }

    const fresh = await refreshing;
    tokenManager.save({
      ...tokenManager.load()!,
      accessToken: fresh.access,
      idToken: fresh.id,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    (original as any)._retry = true;
    original.headers!.Authorization = `Bearer ${fresh.access}`;
    http.defaults.headers.common.Authorization = `Bearer ${fresh.access}`;

    return http(original);
  }
);

/* ---------- cancellation helper ------------------------------------- */
let source: CancelTokenSource | null = null;
http.interceptors.request.use((cfg) => {
  if (!source || source.token.reason) {
    source = axios.CancelToken.source();
  }
  cfg.cancelToken = source.token;
  return cfg;
});

export function cancelPendingRequests(reason = "Navigation change") {
  source?.cancel(reason);
}

export default http;
