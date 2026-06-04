import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Point the `css-anchor-kit` bare import straight at the library source so the
// demo always runs against the live code in `../../src` — no build/link step.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'css-anchor-kit': fileURLToPath(new URL('../../src/index.ts', import.meta.url)),
    },
  },
})
