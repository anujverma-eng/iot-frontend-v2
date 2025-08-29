// src/lib/auth/cognitoClient.ts
import {
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoRefreshToken,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { tokenManager } from "../../utils/tokenManager";

const pool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
});

export const AuthClient = {
  /* ---------- sign‑up ---------- */
  signUp(email: string, password: string) {
    return new Promise((res, rej) => {
      pool.signUp(email, password, [new CognitoUserAttribute({ Name: "email", Value: email })], [], (err, data) =>
        err ? rej(err) : res(data)
      );
    });
  },

  confirmSignUp(email: string, code: string) {
    const user = new CognitoUser({ Username: email, Pool: pool });
    return new Promise((res, rej) => user.confirmRegistration(code, false, (err, ok) => (err ? rej(err) : res(ok))));
  },

  /* ---------- sign‑in ---------- */
  signIn(email: string, password: string) {
    const user = new CognitoUser({ Username: email, Pool: pool });
    const auth = new AuthenticationDetails({ Username: email, Password: password });

    return new Promise<{ access: string; id: string; refresh: string; exp: number }>((res, rej) =>
      user.authenticateUser(auth, {
        onSuccess(sess) {
          res({
            access: sess.getAccessToken().getJwtToken(),
            id: sess.getIdToken().getJwtToken(),
            refresh: sess.getRefreshToken().getToken(),
            exp: sess.getAccessToken().getExpiration(),
          });
        },
        onFailure(err) {

          rej(err);
        },
      })
    );
  },

  globalSignOut(email: string) {
    const user = new CognitoUser({ Username: email, Pool: pool });
    return new Promise((res, rej) =>
      user.globalSignOut({
        onSuccess: res,
        onFailure(err) {

          rej(err);
        },
      })
    );
  },

  /* ---------- forgot‑password ---------- */
  forgotPassword(email: string) {
    const user = new CognitoUser({ Username: email, Pool: pool });
    return new Promise((res, rej) =>
      user.forgotPassword({
        onSuccess: res,
        onFailure(err) {

          rej(err);
        },
        inputVerificationCode: () => res("CODE_SENT"),
      })
    );
  },

  confirmForgot(email: string, code: string, newPw: string) {
    const user = new CognitoUser({ Username: email, Pool: pool });
    return new Promise((res, rej) =>
      user.confirmPassword(code, newPw, {
        onSuccess: res,
        onFailure(err) {

          rej(err);
        },
      })
    );
  },

  /** Check cached user; if session invalid -> null;
   *  if expiring in <60 s, auto‑refresh. */
  async validateSession(): Promise<{
    access: string;
    id: string;
    refresh: string;
    exp: number;
    email: string;
  } | null> {
    const user = pool.getCurrentUser();
    if (!user) return null;

    return new Promise((resolve) =>
      user.getSession(async (err: unknown, sess: CognitoUserSession) => {
        if (err || !sess?.isValid()) return resolve(null);

        /* refresh early if <60 s left */
        const now = Math.floor(Date.now() / 1000);
        if (sess.getAccessToken().getExpiration() - now < 60) {
          try {
            const newAccess = await AuthClient.refresh(sess.getRefreshToken().getToken());
            // replace sessionStorage copy
            tokenManager.save({
              accessToken: newAccess.access,
              refreshToken: sess.getRefreshToken().getToken(),
              idToken: newAccess.id,
              expiresAt: now + 3600,
            });
          } catch {
            return resolve(null);
          }
        }

        resolve({
          access: sess.getAccessToken().getJwtToken(),
          id: sess.getIdToken().getJwtToken(),
          refresh: sess.getRefreshToken().getToken(),
          exp: sess.getAccessToken().getExpiration(),
          email: JSON.parse(atob(sess.getIdToken().getJwtToken().split(".")[1])).email,
        });
      })
    );
  },

  /* ---------- refresh (silent) ---------- */
  refresh(refreshTok: string) {
    const user = pool.getCurrentUser();
    if (!user) throw new Error("No user in pool");
    return new Promise<{ access: string; id: string }>((res, rej) =>
      user.refreshSession(new CognitoRefreshToken({ RefreshToken: refreshTok }), (err, sess) =>
        err
          ? rej(err)
          : res({
              access: sess.getAccessToken().getJwtToken(),
              id: sess.getIdToken().getJwtToken(),
            })
      )
    );
  },

  /* ---------- resend sign‑up code ---------- */
  resendConfirmation(email: string) {
    const user = new CognitoUser({ Username: email, Pool: pool });
    return new Promise((res, rej) => user.resendConfirmationCode((err, ok) => (err ? rej(err) : res(ok))));
  },

  signOutLocal() {
    const u = pool.getCurrentUser();
    if (u) u.signOut(); // no callbacks ⇒ synchronous
    // Add confirmation state clear
    sessionStorage.removeItem('iot.confirm.ctx');
  },
};

/** Try to read the cached user and session (throws if none / expired) */
export async function getCachedSession(): Promise<{
  access: string;
  id: string;
  refresh: string;
  exp: number;
  email: string;
}> {
  const user = pool.getCurrentUser();
  if (!user) throw new Error("NO_CACHED_USER");

  return new Promise((res, rej) =>
    user.getSession(async (err: unknown, sess: CognitoUserSession) => {
      if (err || !sess.isValid()) return rej(err ?? new Error("INVALID"));

      // optional silent refresh if the token expires in <60s
      const now = Math.floor(Date.now() / 1000);
      if (sess.getAccessToken().getExpiration() - now < 60) {
        const fresh = await AuthClient.refresh(sess.getRefreshToken().getToken());

        sess = await new Promise<CognitoUserSession>((ok, ko) =>
          user.getSession((e: unknown, s: CognitoUserSession | PromiseLike<CognitoUserSession>) => (e ? ko(e) : ok(s)))
        );
      }

      res({
        access: sess.getAccessToken().getJwtToken(),
        id: sess.getIdToken().getJwtToken(),
        refresh: sess.getRefreshToken().getToken(),
        exp: sess.getAccessToken().getExpiration(),
        email: JSON.parse(atob(sess.getIdToken().getJwtToken().split(".")[1])).email,
      });
    })
  );
}
