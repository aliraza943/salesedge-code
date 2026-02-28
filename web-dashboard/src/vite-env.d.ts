/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ID: string;
  readonly VITE_OAUTH_PORTAL_URL: string;
  readonly VITE_APP_TITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
