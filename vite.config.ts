import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/](three|@react-three)[\\/]/.test(id)) {
            return 'three'
          }
          if (
            /node_modules[\\/](gsap|framer-motion|motion-dom|motion-utils|lenis|split-type)[\\/]/.test(
              id,
            )
          ) {
            return 'motion'
          }
        },
      },
    },
  },
})
