/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
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
