// src/utils/tokenManager.ts
import { encrypt, decrypt } from '../lib/crypto';

const STORAGE_KEY = 'iot.secureTokens';

export interface Tokens {
  accessToken : string;
  idToken     : string;
  refreshToken: string;
  expiresAt   : number;     // epoch seconds
}

const store = sessionStorage;          // still session‑scoped 🔐

export const tokenManager = {
  load(): Tokens | null {
    const blob = store.getItem(STORAGE_KEY);
    if (!blob) return null;

    try {
      return JSON.parse(decrypt(blob)) as Tokens;
    } catch {
      // corrupt / key changed → wipe
      store.removeItem(STORAGE_KEY);
      return null;
    }
  },

  save(tokens: Tokens) {
    store.setItem(STORAGE_KEY, encrypt(JSON.stringify(tokens)));
  },

  clear() {
    store.removeItem(STORAGE_KEY);
  },

  /** true if the access token will expire within 60s */
  needsRefresh(): boolean {
    const t = this.load();
    return t ? Date.now() / 1000 > t.expiresAt - 60 : false;
  },
};
