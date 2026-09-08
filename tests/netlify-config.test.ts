import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

/**
 * Guards the secrets-scanning configuration.
 *
 * Netlify fails a build when a configured environment variable's *value* turns
 * up in repo code or build output. The Firebase web config trips it: every key
 * is `VITE_`-prefixed, so Vite inlines it into the client bundle, and the
 * project id also sits in `.firebaserc`. None of it is secret — Google
 * documents the web API key as safe to ship, and anyone can read all of it out
 * of the deployed JavaScript.
 *
 * The risk this file protects against is not the Firebase keys. It is the fix
 * being widened later — one `SECRETS_SCAN_ENABLED = false` and the scanner
 * stops noticing the service-account JSON somebody commits next year.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

/**
 * `netlify.toml` with its comments stripped.
 *
 * Every assertion below runs against this rather than the raw file. The
 * comments in that file discuss the settings they warn against — including the
 * literal `SECRETS_SCAN_ENABLED = false` — so matching the raw text would both
 * fail the negative checks and let a positive one pass on prose alone.
 */
const toml = read('netlify.toml')
  // Git checks this file out with CRLF on Windows, and in a JS regex `.` does
  // not match `\r` — so `#.*$` would never reach the end of a comment line and
  // nothing would be stripped.
  .replace(/\r\n?/g, '\n')
  .split('\n')
  .map((line) => line.replace(/(^|\s)#.*$/, ''))
  .join('\n')

/** The `SECRETS_SCAN_OMIT_KEYS` value, as a set of key names. */
function omittedKeys(): Set<string> {
  const match = toml.match(/SECRETS_SCAN_OMIT_KEYS\s*=\s*"([^"]*)"/)
  return new Set((match?.[1] ?? '').split(',').map((key) => key.trim()).filter(Boolean))
}

/** Every `import.meta.env.VITE_*` name the Firebase config reads. */
function firebaseEnvKeys(): string[] {
  const source = read('src/lib/firebase-config.ts')
  return [...source.matchAll(/import\.meta\.env\.(VITE_[A-Z0-9_]+)/g)].map(
    (match) => match[1],
  )
}

describe('netlify.toml — secrets scanning', () => {
  it('declares the omit list as a comma-separated string', () => {
    // Netlify reads build.environment values as strings; a TOML array is
    // silently useless here, and the failure mode is a red deploy.
    expect(toml).toMatch(/\[build\.environment\]/)
    expect(toml).toMatch(/SECRETS_SCAN_OMIT_KEYS\s*=\s*"/)
    expect(omittedKeys().size).toBeGreaterThan(0)
  })

  it.each(firebaseEnvKeys())('omits %s, which Vite inlines into the bundle', (key) => {
    expect(
      omittedKeys().has(key),
      `${key} is read in src/lib/firebase-config.ts and shipped to the browser, ` +
        'so the secrets scanner will find it in dist/ and fail the build. ' +
        'Add it to SECRETS_SCAN_OMIT_KEYS in netlify.toml.',
    ).toBe(true)
  })

  it('omits the project id, which .firebaserc also carries', () => {
    expect(omittedKeys().has('VITE_FIREBASE_PROJECT_ID')).toBe(true)
    expect(read('.firebaserc')).toContain('"projects"')
  })

  it('never disables scanning wholesale', () => {
    // The blunt switch would hide a real credential the day one is committed.
    expect(toml).not.toMatch(/SECRETS_SCAN_ENABLED\s*=\s*("?)false\1/)
  })

  it('omits keys rather than blinding whole paths', () => {
    // SECRETS_SCAN_OMIT_PATHS on dist/ would stop the scanner reading the build
    // output at all — the one place a leaked secret would actually ship from.
    expect(toml).not.toMatch(/SECRETS_SCAN_OMIT_PATHS/)
  })

  it('only ever omits public Firebase web-config keys', () => {
    // A non-VITE_ key in this list would be a server-side value, and those are
    // not inlined into anything public — if one shows up here, something is
    // being hidden rather than declared.
    for (const key of omittedKeys()) {
      expect(key.startsWith('VITE_FIREBASE_'), `${key} is not a public web-config key`).toBe(
        true,
      )
    }
  })
})

describe('netlify.toml — build', () => {
  it('runs the test suite before building', () => {
    expect(toml).toMatch(/command\s*=\s*"pnpm test && pnpm build"/)
  })

  it('does not declare the agents function, which routes itself inline', () => {
    // A declaration here is merged with the inline one rather than replacing
    // it, which would re-add the asset paths `excludedPattern` excludes.
    expect(toml).not.toMatch(/function\s*=\s*"agents"/)
  })
})
