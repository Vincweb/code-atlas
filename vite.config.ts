import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API = process.env.CODE_ATLAS_API ?? 'http://127.0.0.1:4800'

export default defineConfig({
  root: 'src/client',
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 4801,
    proxy: { '^/api/': API },
  },
})
