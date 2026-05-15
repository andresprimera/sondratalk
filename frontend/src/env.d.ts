/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPPORTED_LOCALES?: string
  readonly VITE_LANDING_PAGE?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
