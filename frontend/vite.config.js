import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5180,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:3210',
        changeOrigin: true
      }
    },
    host: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900
  }
})
