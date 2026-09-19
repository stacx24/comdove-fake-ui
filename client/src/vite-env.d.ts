interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'sample' | 'server'
  readonly VITE_WEBHOOK_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __MOCK_SERVER_URL__: string
