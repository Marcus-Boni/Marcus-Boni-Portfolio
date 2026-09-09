import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Guards the one rule Netlify's edge bundler enforces and nothing else checks.
 *
 * Netlify packages **every** `.ts` file at the top level of
 * `netlify/edge-functions/` as an edge function and requires each to default-
 * export a function. It does *not* skip names beginning with `_` — that is the
 * convention for Netlify *Functions*, not Edge Functions. Shared modules parked
 * there fail the deploy with:
 *
 *   Default export in '…/netlify/edge-functions/_accept.ts' must be a function.
 *
 * Which is exactly what happened: `pnpm test` passed, `pnpm build` passed, and
 * the deploy died in the bundling step afterwards. Shared code now lives in
 * `netlify/lib/`, a sibling directory the bundler never scans, and this test
 * keeps it there.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const EDGE_DIR = path.join(root, 'netlify/edge-functions')

const entries = readdirSync(EDGE_DIR, { withFileTypes: true })
const files = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
  .map((entry) => entry.name)
  .sort()

beforeAll(() => {
  // `firestore.ts` reads the project id at module scope; without the shim the
  // imports below throw before the assertion can run.
  vi.stubGlobal('Deno', { env: { get: () => undefined } })
})

/**
 * The `.ts` has to sit in the static part of the template literal or Vite's
 * dynamic-import analysis cannot enumerate the candidates and warns.
 */
function load(name: string): Promise<Record<string, unknown>> {
  return import(`../netlify/edge-functions/${name.slice(0, -'.ts'.length)}.ts`)
}

describe('netlify/edge-functions', () => {
  it('holds only real functions — no directories, no stray files', () => {
    expect(files).toEqual(['agents.ts', 'api.ts', 'blog-meta.ts', 'feeds.ts'])
    expect(entries.filter((entry) => entry.isDirectory())).toEqual([])
  })

  it.each(files)('%s default-exports a function', async (name) => {
    const module = await load(name)
    expect(
      typeof module.default,
      `${name} is packaged as an edge function, so it must default-export a handler. ` +
        'Shared modules belong in netlify/lib/.',
    ).toBe('function')
  })

  it.each(files)('%s declares its routing', async (name) => {
    const module = await load(name)
    const config = module.config as { path?: unknown } | undefined
    expect(config, `${name} needs an exported config`).toBeDefined()
    expect(config?.path, `${name} needs a path in its config`).toBeDefined()
  })

  it('keeps no underscore-prefixed helpers here', () => {
    // The prefix means nothing to the edge bundler. Leaving one here reads as
    // "ignored" and deploys as "broken function".
    expect(files.filter((name) => name.startsWith('_'))).toEqual([])
  })
})
