import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const openPagesSrc = path.resolve(root, '../../packages/open-pages/src')

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    // Local DX: demo uses package sources (HMR), not dist.
    alias: {
      '@openpages/vue': path.join(openPagesSrc, 'index.ts'),
      '@openpages/vue/style.css': path.join(openPagesSrc, 'style.css'),
    },
    dedupe: ['vue'],
  },
  server: {
    port: 5173,
    fs: {
      allow: [openPagesSrc, path.resolve(root, '../..')],
    },
  },
  optimizeDeps: {
    exclude: ['@openpages/vue'],
  },
})
