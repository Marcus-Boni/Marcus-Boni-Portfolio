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
          // The React runtime and the small packages it shares with other
          // dependencies (`scheduler`, `use-sync-external-store`). Named
          // first, so none of them can be merged into a lazy chunk and drag
          // that chunk into the entry as a static dependency.
          if (
            /node_modules[\\/](scheduler|use-sync-external-store|react|react-dom)[\\/]/.test(
              id,
            )
          ) {
            return 'react'
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
          // Shiki. Only reached from <CodeBlock>, so a post without code fences
          // never downloads a highlighter. Language grammars are dynamically
          // imported and stay in their own on-demand chunks.
          // `@shikijs/langs` and `@shikijs/themes` are deliberately excluded:
          // naming a chunk for a module forces it in even when it is only
          // reached by dynamic import, which would collapse every grammar into
          // one 1.2 MB chunk and undo the per-language loading.
          if (
            /node_modules[\\/](shiki|oniguruma-to-es|regex|regex-recursion|regex-utilities)[\\/]/.test(
              id,
            ) ||
            /node_modules[\\/]@shikijs[\\/](?!langs|themes)/.test(id)
          ) {
            return 'shiki'
          }
          // NOTE: do NOT add a manualChunks rule for the unified/remark/rehype
          // pipeline. Naming a chunk for it makes Rolldown treat it as a
          // *static* dependency and it lands as a modulepreload on the home
          // page — the failure the `react` rule above guards against.
          // The renderer is kept off the index by lazy-loading `BlogPost`
          // inside `BlogApp` instead, which is where the boundary belongs.
          if (/node_modules[\\/]react-router[\\/]/.test(id)) {
            return 'router'
          }
        },
      },
    },
  },
})
