import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { open: true },
  build: {
    // @react-three/rapier вбудовує WASM-модуль фізики (~2 МБ) прямо в бандл.
    chunkSizeWarningLimit: 4000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
