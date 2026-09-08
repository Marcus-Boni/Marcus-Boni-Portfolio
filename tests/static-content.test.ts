import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { cvFiles, experience, profile, projects, techStack } from '@/data/profile'

/**
 * "Content without JavaScript" — the raw HTML has to carry the page.
 *
 * Before this, `index.html` shipped one headline and two lines of dek: about
 * 200 characters, which is all a crawler that does not execute JavaScript ever
 * saw of the site. Everything else lived in the React tree.
 *
 * These tests measure the *delivered* document, not the rendered one: strip
 * scripts, styles, comments and tags, and count what is left.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

const html = read('index.html')

/** Visible text of a document: no comments, no scripts, no styles, no tags. */
function visibleText(source: string): string {
  return source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&(?:middot|middash);/g, '·')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Collapses whitespace and unifies dashes, so 80-column wrapping is invisible. */
function flat(text: string): string {
  return text.replace(/[—–]/g, '-').replace(/\s+/g, ' ')
}

const text = flat(visibleText(html))

describe('index.html — text content', () => {
  it('serves well over the 500 characters the readiness check asks for', () => {
    expect(text.length).toBeGreaterThan(500)
  })

  it('has exactly one h1', () => {
    const h1s = html.match(/<h1\b/gi) ?? []
    expect(h1s).toHaveLength(1)
  })

  it('keeps heading levels sequential — no jumps', () => {
    const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]))
    expect(levels[0]).toBe(1)
    for (let index = 1; index < levels.length; index += 1) {
      expect(
        levels[index] - levels[index - 1],
        `h${levels[index - 1]} is followed by h${levels[index]}`,
      ).toBeLessThanOrEqual(1)
    }
  })

  it('names the person, the role and the way to reach them', () => {
    expect(text).toContain(profile.name)
    expect(text).toContain(profile.email)
    expect(text).toContain(String(profile.repoCount))
    expect(text).toContain(experience.company)
  })

  it.each(projects.map((project) => [project.title] as const))(
    'describes the %s project in raw HTML',
    (title) => {
      expect(text).toContain(flat(title))
    },
  )

  it.each(experience.projects.map((entry) => [entry.client] as const))(
    'names the %s engagement in raw HTML',
    (client) => {
      expect(text).toContain(flat(client))
    },
  )

  it.each(techStack.map((tech) => [tech.name] as const))(
    'lists %s in raw HTML',
    (name) => {
      expect(text).toContain(name)
    },
  )
})

describe('index.html — crawlable links', () => {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1])

  it.each([
    ['/blog'],
    ['/developers'],
    ['/llms.txt'],
    ['/agent-instructions.md'],
    ['/sitemap.xml'],
    ['/rss.xml'],
    [cvFiles.pt],
    [cvFiles.en],
  ])('links %s so a crawler can find it without running JS', (href) => {
    expect(hrefs).toContain(href)
  })

  it('links the public profiles', () => {
    expect(hrefs).toContain(profile.github)
    expect(hrefs).toContain(`mailto:${profile.email}`)
  })

  it('declares the Markdown representation of the page', () => {
    expect(html).toMatch(
      /<link\s+rel="alternate"\s+type="text\/markdown"\s+href="https:\/\/marcusboni\.com\.br\/"/,
    )
  })
})

describe('index.html — static shell lifecycle', () => {
  it('carries both static blocks inside the React root', () => {
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('</body>'))
    expect(root).toContain('id="hero-shell"')
    expect(root).toContain('id="static-content"')
  })

  it('drops both off-route so /blog and /admin never flash the portfolio', () => {
    // React clears `#root` on mount, but this runs synchronously during parse —
    // before the bundle executes. Miss one and the wrong content paints.
    const script = html.slice(html.lastIndexOf("location.pathname !== '/'"))
    expect(script).toContain("getElementById('hero-shell')?.remove()")
    expect(script).toContain("getElementById('static-content')?.remove()")
  })

  it('keeps the hero above the static content, so the fold hides it', () => {
    // The static block is only invisible to a JS visitor because `#hero-shell`
    // is `h-svh` and sits before it. Reordering would make it flash.
    expect(html.indexOf('id="hero-shell"')).toBeLessThan(html.indexOf('id="static-content"'))
    expect(html).toMatch(/id="hero-shell"[\s\S]{0,400}h-svh/)
  })
})

describe('public/404.html', () => {
  const notFound = read('public/404.html')
  const notFoundText = flat(visibleText(notFound))

  it('is noindex — an error state must not be indexed', () => {
    expect(notFound).toMatch(/<meta name="robots" content="noindex, follow" \/>/)
  })

  it('needs no JavaScript', () => {
    // An error page that waits on the app bundle to say "wrong URL" is worse
    // than no error page.
    expect(notFound).not.toMatch(/<script/i)
  })

  it('paints a flat background colour, not only a gradient', () => {
    // Bone text on the browser's default white is unreadable, which is what
    // happens if the gradient is the only thing painting the page.
    expect(notFound).toMatch(/background-color:\s*var\(--ink\)/)
  })

  it('points at the real entry points instead of only apologising', () => {
    const hrefs = [...notFound.matchAll(/href="([^"]+)"/g)].map((match) => match[1])
    for (const href of ['/', '/blog', '/developers', '/sitemap.xml', '/llms.txt', '/agent-instructions.md']) {
      expect(hrefs).toContain(href)
    }
  })

  it('says in prose that there is no API to discover', () => {
    expect(notFoundText).toContain('There is no API to discover.')
  })
})

describe('public/developers/index.html', () => {
  const portal = read('public/developers/index.html')

  it('has its own title and canonical, not the SPA shell', () => {
    expect(portal).toContain('<title>Developers — Marcus Boni</title>')
    expect(portal).toContain('<link rel="canonical" href="https://marcusboni.com.br/developers" />')
  })

  it('declares its Markdown representation', () => {
    expect(portal).toContain(
      '<link rel="alternate" type="text/markdown" href="https://marcusboni.com.br/developers" />',
    )
  })

  it('is a document, not an app — no bundle to wait on', () => {
    expect(portal).not.toMatch(/<script/i)
  })

  it('has one h1 and sequential headings', () => {
    expect(portal.match(/<h1\b/gi) ?? []).toHaveLength(1)
    const levels = [...portal.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]))
    expect(levels[0]).toBe(1)
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1)
    }
  })
})
