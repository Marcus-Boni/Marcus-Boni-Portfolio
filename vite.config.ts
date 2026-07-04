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
          // React runtime deps shared by react-dom AND @react-three/fiber.
          // Without this rule the bundler merges `scheduler` into the three
          // chunk, making the 870 KB three.js bundle a *static* dependency of
          // the entry (modulepreload + full parse during load). Keep them
          // with the app code so the three chunk stays truly lazy.
          if (
            /node_modules[\\/](scheduler|use-sync-external-store|react|react-dom)[\\/]/.test(
              id,
            )
          ) {
            return 'react'
          }
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
          if (/node_modules[\\/](@firebase|firebase)[\\/]/.test(id)) {
            return 'firebase'
          }
          if (/node_modules[\\/]react-router[\\/]/.test(id)) {
            return 'router'
          }
        },
      },
    },
  },
})
