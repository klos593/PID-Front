/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    // Forwards /api/* to the Fastify backend so the browser only ever talks
    // to :5173 — no CORS config needed, and the session cookie stays
    // same-origin in dev just like it will behind nginx in production.
    proxy: {
      // VITE_BACKEND_URL lets docker-compose point this at the `backend`
      // service name instead of 127.0.0.1 when running inside the network.
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
  // `vite build`/`vite dev` already default to the automatic JSX runtime
  // (via oxc). Vitest's own transform goes through esbuild instead and
  // needs this set explicitly, or components fail with "React is not
  // defined" — scoped to `mode === 'test'` so it doesn't clash with oxc
  // during a normal build.
  ...(mode === 'test' ? { esbuild: { jsx: 'automatic' } } : {}),
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
}))
