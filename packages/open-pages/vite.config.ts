import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      exclude: ['src/**/*.test.ts', 'src/style-entry.ts'],
      entryRoot: 'src',
      outDir: 'dist',
      insertTypesEntry: true,
      copyDtsFiles: true,
      // Vue SFCs: emit .vue.d.ts next to bundled types
      cleanVueFileName: true,
    }),
  ],
  build: {
    lib: {
      entry: {
        'open-pages': resolve(__dirname, 'src/index.ts'),
        style: resolve(__dirname, 'src/style-entry.ts'),
      },
      formats: ['es'],
      fileName: (_format, entryName) => (entryName === 'style' ? 'style.js' : 'open-pages.js'),
    },
    rollupOptions: {
      external: ['vue', 'lucide-vue-next'],
      output: {
        globals: {
          vue: 'Vue',
        },
        assetFileNames: 'open-pages.[ext]',
      },
    },
    cssCodeSplit: true,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
