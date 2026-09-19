/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Where the mock server runs (HTTP + WebSocket on the same port, see Tech Spec §8).
  const target = env.MOCK_SERVER_URL || 'http://localhost:4020'

  return {
    plugins: [react()],
    // Shown in the top bar. MOCK_SERVER_URL has no VITE_ prefix, so it has to be passed in here.
    define: {
      __MOCK_SERVER_URL__: JSON.stringify(target.replace(/^https?:\/\//, '')),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/ws': { target, ws: true, changeOrigin: true },
      },
    },
    test: {
      environment: 'node',
    },
  }
})
