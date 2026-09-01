/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_USE_API_V2?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
