/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // client.js pega todo a rutas relativas /api — acá las redirigimos al
      // backend de Fastify. `backend` es el nombre del servicio en
      // docker-compose.dev.yml; corriendo `npm run dev` fuera de Docker hay
      // que apuntar a http://127.0.0.1:4000.
      '/api': { target: 'http://backend:4000', changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
})
