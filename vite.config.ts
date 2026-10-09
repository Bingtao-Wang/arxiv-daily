import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: 'client',
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), {
    name: 'watch-paper-data',
    configureServer(server) {
      // Data lives outside client/. Watch creations too, including the first fetch.
      server.watcher.add(fileURLToPath(new URL('./shared/static/data', import.meta.url)))
    },
  }],
  server: { port: 5173, host: '127.0.0.1' },
  build: { outDir: '../dist', emptyOutDir: true },
})
