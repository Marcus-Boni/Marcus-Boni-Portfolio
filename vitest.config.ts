import path from 'node:path'

import { defineConfig } from 'vitest/config'

/**
 * Separate from `vite.config.ts` on purpose.
 *
 * The app config carries the React and Tailwind plugins plus the `manualChunks`
 * rules, none of which a Node-environment unit test needs — and Tailwind's
 * plugin scans the whole project on start, which is a slow way to run a suite
 * of pure functions. Only the `@` alias is shared, because
 * `tests/agent-docs.test.ts` reads the real `src/data/profile.ts` to prove the
 * edge functions' hand-maintained copies of that content have not drifted.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
