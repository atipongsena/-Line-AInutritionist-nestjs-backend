/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIFF_ID: string
  readonly VITE_API_BASE_URL: string
  // Add other environment variables here if you have more
  // Example: readonly VITE_ANOTHER_VAR: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
