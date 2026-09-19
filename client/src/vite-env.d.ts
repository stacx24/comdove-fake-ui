/// <reference types="vite/client" />

// Injected by vite.config.ts from MOCK_SERVER_URL, without the protocol.
declare const __MOCK_SERVER_URL__: string

interface ImportMetaEnv {
  /** `mock` (default) serves static mock data; `server` talks to the real mock server. */
  readonly VITE_DATA_SOURCE?: 'mock' | 'server'
  /** Display-only label for the top bar; the real value is the server's COMDOVE_WEBHOOK_URL. */
interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'sample' | 'server'
  readonly VITE_WEBHOOK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __MOCK_SERVER_URL__: string
