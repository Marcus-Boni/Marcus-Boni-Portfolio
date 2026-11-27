import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

import { handleAgentChat } from './netlify/lib/agent-chat.ts'
import { handleGitHubActivity } from './netlify/lib/github-activity.ts'

/**
 * Dev-only middleware that mounts the exact Netlify Edge Function handler
 * (`netlify/lib/agent-chat.ts`) on `/agent/v1/chat` during `pnpm dev`.
 *
 * Server-side env vars (`GROQ_API_KEY`, `NVIDIA_API_KEY`, `OPENROUTER_API_KEY`)
 * stay strictly inside the Node dev process and are never exposed to the client
 * bundle. `apply: 'serve'` ensures zero bytes enter `dist/`.
 */
function agentChatDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'agent-chat-dev-bridge',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/agent/v1/chat', async (req, res, next) => {
        try {
          const host = req.headers.host ?? 'localhost:5173'
          const url = new URL(req.originalUrl ?? '/agent/v1/chat', `http://${host}`)
          const method = req.method ?? 'GET'
          const headers = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(key, value)
            else if (Array.isArray(value)) headers.set(key, value.join(', '))
          }

          let body: string | undefined
          if (method !== 'GET' && method !== 'HEAD') {
            const chunks: Buffer[] = []
            let totalBytes = 0
            for await (const chunk of req) {
              const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
              totalBytes += buf.byteLength
              if (totalBytes > 32_768) {
                res.statusCode = 413
                res.setHeader('content-type', 'application/problem+json; charset=utf-8')
                res.end(JSON.stringify({ status: 413, title: 'Payload too large' }))
                return
              }
              chunks.push(buf)
            }
            body = Buffer.concat(chunks).toString('utf8')
          }

          const abortController = new AbortController()
          res.on('close', () => {
            if (!res.writableEnded) abortController.abort()
          })

          const webReq = new Request(url.toString(), {
            method,
            headers,
            body,
            signal: abortController.signal,
          })

          const webRes = await handleAgentChat(webReq, {
            env: (key) => env[key] ?? process.env[key],
          })

          res.statusCode = webRes.status
          webRes.headers.forEach((value, key) => res.setHeader(key, value))
          res.flushHeaders()

          if (!webRes.body) {
            res.end()
            return
          }

          const reader = webRes.body.getReader()
          try {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              if (value) res.write(Buffer.from(value))
            }
          } finally {
            reader.releaseLock()
            res.end()
          }
        } catch (err) {
          next(err)
        }
      })

      server.middlewares.use('/agent/v1/github', async (req, res, next) => {
        try {
          const host = req.headers.host ?? 'localhost:5173'
          const url = new URL(req.originalUrl ?? '/agent/v1/github', `http://${host}`)
          const webReq = new Request(url.toString(), { method: req.method ?? 'GET' })
          const webRes = await handleGitHubActivity(webReq, {
            env: (key) => env[key] ?? process.env[key],
          })
          res.statusCode = webRes.status
          webRes.headers.forEach((value, key) => res.setHeader(key, value))
          const text = await webRes.text()
          res.end(text)
        } catch (err) {
          next(err)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const serverEnv = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss(), agentChatDevPlugin(serverEnv)],
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
  }
})
