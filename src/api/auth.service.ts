import {
  CognitoUserPool,
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoRefreshToken,
} from "amazon-cognito-identity-js";
import { tokenManager } from "../utils/tokenManager";

const pool = new CognitoUserPool({
  UserPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  ClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
});

export const AuthService = {
  /* ---- sign‑in / sign‑up --------------------------------------- */
  signUp(email: string, pw: string) {
    return new Promise<void>((ok, ko) =>
      pool.signUp(email, pw, [new CognitoUserAttribute({ Name: "email", Value: email })], [], (err) =>
        err ? ko(err) : ok()
      )
    );
  },

  confirmSignUp(email: string, code: string) {
    const u = new CognitoUser({ Username: email, Pool: pool });
    return new Promise<void>((ok, ko) => u.confirmRegistration(code, false, (err) => (err ? ko(err) : ok())));
  },

  signIn(email: string, pw: string) {
    const u = new CognitoUser({ Username: email, Pool: pool });
    const auth = new AuthenticationDetails({ Username: email, Password: pw });

    return new Promise<{ access: string; id: string; refresh: string; exp: number }>((ok, ko) =>
      u.authenticateUser(auth, {
        onSuccess(s) {
          ok({
            access: s.getAccessToken().getJwtToken(),
            id: s.getIdToken().getJwtToken(),
            refresh: s.getRefreshToken().getToken(),
            exp: s.getAccessToken().getExpiration(),
          });
        },
        onFailure: ko,
      })
    );
  },

  refresh(rt: string) {
    const u = pool.getCurrentUser();
    if (!u) throw new Error("NO_USER");
    return new Promise<{ access: string; id: string }>((ok, ko) =>
      u.refreshSession(new CognitoRefreshToken({ RefreshToken: rt }), (err, s) =>
        err
          ? ko(err)
          : ok({
              access: s.getAccessToken().getJwtToken(),
              id: s.getIdToken().getJwtToken(),
            })
      )
    );
  },

  /* …other helpers (forgotPassword etc.)… */
};
