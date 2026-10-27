import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages serves the site from `/<repo>/`, so asset URLs must carry that
// prefix. The deploy workflow passes BASE_PATH; locally we default to the repo
// name so `pnpm build` output matches what production will serve.
const base = process.env.BASE_PATH ?? '/polaroid-booth/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  build: {
    // Split vendor code so an app-code change doesn't invalidate the React
    // chunk in users' caches.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
