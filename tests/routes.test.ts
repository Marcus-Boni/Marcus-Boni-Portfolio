import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  blogSlug,
  matchRoute,
  normalizePath,
  redirectPath,
  ROUTES,
} from '../netlify/edge-functions/_routes.ts'

/**
 * The soft-404 regression suite.
 *
 * `public/_redirects` used to end with `/*  /index.html  200`, which made every
 * URL on the domain answer 200 with the app shell. These tests hold the three
 * places that now have to agree — the route table, the rewrite rules, and the
 * client routes in `src/main.tsx` — to each other, so a new route cannot be
 * added in one place and silently 404 (or silently soft-200) in production.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

interface Rule {
  from: string
  to: string
  status: string
}

function redirectRules(): Rule[] {
  return read('public/_redirects')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => {
      const [from, to, status = ''] = line.split(/\s+/)
      return { from, to, status }
    })
}

describe('matchRoute', () => {
  const cases: [pathname: string, expected: ReturnType<typeof matchRoute>][] = [
    ['/', 'home'],
    ['/blog', 'blog-index'],
    ['/blog/', 'blog-index'],
    ['/blog/hello-world', 'blog-post'],
    ['/developers', 'developers'],
    ['/developers/', 'developers'],
    ['/admin', 'admin'],
    ['/admin/blog/new', 'admin'],
    // Nothing below is a page this site has.
    ['/api', null],
    ['/api/v1/posts', null],
    ['/docs', null],
    ['/.well-known/ai-plugin.json', null],
    ['/index.php', null],
    ['/developers/keys', null],
    // The blog has no nested routes; `/blog/a/b` answering 200 would be the
    // same soft-404 in miniature.
    ['/blog/hello/world', null],
  ]

  for (const [pathname, expected] of cases) {
    it(`${pathname} → ${expected ?? '404'}`, () => {
      expect(matchRoute(pathname)).toBe(expected)
    })
  }
})

describe('normalizePath', () => {
  it('strips trailing slashes but keeps the root', () => {
    expect(normalizePath('/blog/')).toBe('/blog')
    expect(normalizePath('/blog///')).toBe('/blog')
    expect(normalizePath('/')).toBe('/')
    expect(normalizePath('')).toBe('/')
  })
})

describe('blogSlug', () => {
  it('extracts the slug of a post URL', () => {
    expect(blogSlug('/blog/estudo-de-mercado')).toBe('estudo-de-mercado')
    expect(blogSlug('/blog/estudo-de-mercado/')).toBe('estudo-de-mercado')
  })

  it('percent-decodes, so an accented slug reaches Firestore intact', () => {
    expect(blogSlug('/blog/notas-t%C3%A9cnicas')).toBe('notas-técnicas')
  })

  it('is empty for anything that is not a post URL', () => {
    expect(blogSlug('/blog')).toBe('')
    expect(blogSlug('/')).toBe('')
    expect(blogSlug('/blog/a/b')).toBe('')
  })
})

describe('public/_redirects', () => {
  it('has no catch-all rewrite to the app shell', () => {
    // The whole point. A `/*  /index.html  200` rule here means every path on
    // the domain reports itself as existing.
    const catchAll = redirectRules().filter(
      (rule) => rule.from === '/*' && rule.status.startsWith('200'),
    )
    expect(catchAll).toEqual([])
  })

  it('rewrites every client-rendered route to the app shell', () => {
    const rules = redirectRules()
    for (const route of ROUTES.filter((entry) => entry.served === 'spa')) {
      const expected = redirectPath(route)
      const rule = rules.find((candidate) => candidate.from === expected)
      expect(rule, `missing rewrite for ${expected}`).toBeDefined()
      expect(rule?.to).toBe('/index.html')
      expect(rule?.status).toBe('200')
    }
  })

  it('points statically served routes at their own file, not the app shell', () => {
    const rules = redirectRules()
    for (const route of ROUTES.filter((entry) => entry.served === 'static')) {
      const rule = rules.find((candidate) => candidate.from === route.path)
      expect(rule, `missing rewrite for ${route.path}`).toBeDefined()
      expect(rule?.to).toBe(`${route.path}/index.html`)
      expect(rule?.status).toBe('200')
    }
  })

  it('keeps the legacy CV redirect alive', () => {
    const rule = redirectRules().find((candidate) => candidate.from === '/marcus-boni-cv.pdf')
    expect(rule?.to).toBe('/marcus-boni-cv-pt.pdf')
    expect(rule?.status).toBe('301!')
  })
})

describe('route table ↔ filesystem', () => {
  it('ships a file for every statically served route', () => {
    for (const route of ROUTES.filter((entry) => entry.served === 'static')) {
      const file = path.join(root, 'public', route.path, 'index.html')
      expect(existsSync(file), `${route.path} needs public${route.path}/index.html`).toBe(
        true,
      )
    }
  })

  it('ships the 404 page every unmatched path falls through to', () => {
    // Netlify serves `404.html` with a real 404 status for any request that
    // matches no file and no redirect rule. Without this file the platform
    // falls back to its own generic page.
    expect(existsSync(path.join(root, 'public/404.html'))).toBe(true)
  })
})

describe('route table ↔ src/main.tsx', () => {
  it('covers every top-level route segment the app declares', () => {
    const declared = [...read('src/main.tsx').matchAll(/path="([^"]+)"/g)].map(
      (match) => match[1],
    )
    // `/*` is React Router's catch-all for the portfolio page itself.
    const segments = declared
      .filter((route) => route !== '/*')
      .map((route) => route.split('/')[1])

    expect(segments.length).toBeGreaterThan(0)

    const known = new Set(ROUTES.map((route) => route.path.split('/')[1]))
    for (const segment of segments) {
      expect(
        known.has(segment),
        `src/main.tsx routes /${segment}/* but netlify/edge-functions/_routes.ts does not — it will 404 on a fresh load`,
      ).toBe(true)
    }
  })
})
