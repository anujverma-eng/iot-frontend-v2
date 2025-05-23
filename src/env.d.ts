/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TOKEN_ENC_KEY: string;
  readonly VITE_API_BASE: string;
  readonly VITE_COGNITO_REGION: string;
  readonly VITE_COGNITO_DOMAIN: string;
  readonly VITE_COGNITO_APP_CLIENT_ID: string;
  readonly VITE_COGNITO_USER_POOL_ID: string;
  readonly VITE_COGNITO_IDENTITY_POOL_ID: string;
  readonly VITE_COGNITO_REDIRECT_URI: string;
  readonly VITE_COGNITO_LOGOUT_URI: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
