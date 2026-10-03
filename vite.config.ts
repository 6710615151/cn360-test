import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    // The tree-shaken three.js core is ~500 kB minified (~125 kB gzip) on its own
    // and can't be split further; keep the warning for anything larger.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom'],
          zustand: ['zustand'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: [],
  },
  server: {
    https: false, // use http for local dev; Vercel handles HTTPS in production
    port: 5173,
  },
})
