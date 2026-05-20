import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  publicDir: 'public',
  server: {
    port: 3000
  }
})
