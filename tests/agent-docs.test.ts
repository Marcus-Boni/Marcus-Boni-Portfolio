import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  cvFiles,
  experience,
  profile,
  projects,
  socials,
  techStack,
} from '@/data/profile'

import {
  blogIndexMarkdown,
  developersMarkdown,
  homeMarkdown,
  notFoundMarkdown,
  postMarkdown,
  resolveMedia,
  type DocPost,
} from '../netlify/lib/agent-docs.ts'

/**
 * Drift tests for the hand-maintained Markdown representations.
 *
 * The edge runtime cannot import from `src/` — React, the i18n bundle and the
 * Firebase SDK have no business at the edge — so `agent-docs.ts` restates the
 * site's content in prose. That copy is exactly the kind of thing that rots
 * silently: nothing breaks when a project is renamed in `profile.ts` and not
 * here, the Markdown just starts lying.
 *
 * These tests make the copy verifiable instead: every project, client and
 * technology in `profile.ts` has to appear in the Markdown, and every endpoint
 * named in the Markdown developer portal has to appear in the HTML one.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative: string) => readFileSync(path.join(root, relative), 'utf8')

/**
 * Collapses whitespace and unifies dash characters before comparing.
 *
 * Prose is wrapped at 80 columns, so a client name can straddle a line break;
 * and the docs use an em dash where `profile.ts` uses a hyphen (`EAV - Escola
 * Americana de Vitória`). Neither is a content difference.
 */
function flat(text: string): string {
  return text.replace(/[—–]/g, '-').replace(/\s+/g, ' ')
}

/** File-like paths named in a document: `/llms.txt`, `/rss.xml`, … */
function endpoints(text: string): string[] {
  const found = text.matchAll(/\/[a-z0-9][a-z0-9._-]*\.(?:txt|md|xml|pdf)\b/g)
  return [...new Set([...found].map((match) => match[0]))].sort()
}

describe('homeMarkdown', () => {
  const markdown = flat(homeMarkdown())

  it('states who the page is about', () => {
    expect(markdown).toContain(profile.name)
    expect(markdown).toContain(profile.fullName)
    expect(markdown).toContain(profile.role)
    expect(markdown).toContain(profile.location)
    expect(markdown).toContain(profile.email)
    expect(markdown).toContain(String(profile.repoCount))
  })

  it('names the current role and employer', () => {
    expect(markdown).toContain(experience.role)
    expect(markdown).toContain(experience.company)
  })

  it.each(projects.map((project) => [project.title, project.url] as const))(
    'describes the %s project',
    (title, url) => {
      expect(markdown).toContain(flat(title))
      expect(markdown).toContain(url)
    },
  )

  it.each(experience.projects.map((entry) => [entry.client] as const))(
    'names the %s engagement',
    (client) => {
      expect(markdown).toContain(flat(client))
    },
  )

  it.each(techStack.map((tech) => [tech.name] as const))(
    'lists %s in the stack',
    (name) => {
      expect(markdown).toContain(name)
    },
  )

  it.each(socials.map((social) => [social.label, social.url] as const))(
    'links %s',
    (_label, url) => {
      // `mailto:` is normalised away in the Markdown; the address itself is
      // asserted above.
      if (url.startsWith('mailto:')) return
      expect(markdown).toContain(url)
    },
  )

  it('links both résumé variants', () => {
    expect(markdown).toContain(cvFiles.pt)
    expect(markdown).toContain(cvFiles.en)
  })

  it('points an agent at the machine-readable index', () => {
    for (const file of ['/llms.txt', '/llms-full.txt', '/agent-instructions.md', '/sitemap.xml']) {
      expect(markdown).toContain(file)
    }
  })

  it('is substantial enough to answer a profile question in one fetch', () => {
    expect(homeMarkdown().length).toBeGreaterThan(2000)
  })
})

describe('developersMarkdown ↔ public/developers.html', () => {
  const markdown = developersMarkdown()
  const html = read('public/developers.html')

  it('names exactly the same endpoints in both representations', () => {
    expect(endpoints(markdown)).toEqual(endpoints(html))
  })

  it('documents the negotiation contract in both', () => {
    for (const document of [markdown, flat(html)]) {
      expect(document).toContain('text/markdown')
      expect(document).toContain('Vary: Accept')
      expect(document).toContain('406')
      expect(document).toContain('acceptmarkdown.com')
    }
  })

  it('is honest that there are no API keys and no sandbox to hand out', () => {
    // The scan asks for "API keys and a sandbox environment". This site is
    // read-only and unauthenticated, so the truthful answer is that neither
    // exists — not a fake key issuer.
    expect(flat(markdown)).toContain('no API keys to issue and no sandbox to provision')
    expect(flat(html)).toContain('no API keys to issue and no sandbox to provision')
  })

  it('gives a runnable curl for the Markdown variant', () => {
    expect(markdown).toContain("curl -s -H 'Accept: text/markdown'")
    expect(html).toContain('Accept: text/markdown')
  })
})

describe('notFoundMarkdown', () => {
  const markdown = notFoundMarkdown('/api/v1/posts')

  it('echoes the path that was not found', () => {
    expect(markdown).toContain('/api/v1/posts')
  })

  it('leads with the 404 so a skimming agent cannot miss it', () => {
    expect(markdown.trimStart().startsWith('# 404')).toBe(true)
  })

  it('points at the sitemap, llms.txt and the developer portal', () => {
    // "give the 404 response a short markdown body pointing agents at your
    // sitemap, llms.txt, or docs index" — all three, since we have all three.
    expect(markdown).toContain('/sitemap.xml')
    expect(markdown).toContain('/llms.txt')
    expect(markdown).toContain('/developers')
  })

  it('stays short — it is a signpost, not a page', () => {
    expect(markdown.length).toBeLessThan(1200)
  })
})

describe('blogIndexMarkdown', () => {
  const post: DocPost = {
    slug: 'estudo-de-mercado',
    lang: 'pt',
    title: 'Estudo de mercado',
    subtitle: 'Como olhar para um setor',
    excerpt: 'Um método para estudar um mercado antes de escrever código.',
    tags: ['produto', 'pesquisa'],
    readingMinutes: 7,
    publishedAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-02T12:00:00.000Z',
    translationOf: null,
  }

  it('renders a post as a linked heading with its metadata', () => {
    const markdown = blogIndexMarkdown([post])
    expect(markdown).toContain('[Estudo de mercado](https://marcusboni.com.br/blog/estudo-de-mercado)')
    expect(markdown).toContain('2026-08-01 · pt · 7 min read · produto, pesquisa')
    expect(markdown).toContain(post.excerpt)
  })

  it('says so plainly when there is nothing published', () => {
    // Reached whenever Firestore is unconfigured. An empty document would read
    // as a broken endpoint.
    const markdown = blogIndexMarkdown([])
    expect(markdown).toContain('No posts published yet.')
    expect(markdown).toContain('/rss.xml')
  })
})

describe('postMarkdown', () => {
  const post: DocPost = {
    slug: 'notas',
    lang: 'en',
    title: 'Notes on "quoted" titles',
    subtitle: 'A dek',
    excerpt: 'An excerpt.',
    tags: ['react'],
    readingMinutes: 3,
    publishedAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-03T00:00:00.000Z',
    translationOf: 'notas-pt',
  }

  const markdown = postMarkdown(post, '## Heading\n\nBody text.\n')

  it('opens with YAML front matter', () => {
    expect(markdown.startsWith('---\n')).toBe(true)
    expect(markdown).toContain('url: "https://marcusboni.com.br/blog/notas"')
    expect(markdown).toContain('lang: "en"')
    expect(markdown).toContain('date_published: "2026-01-02T00:00:00.000Z"')
    expect(markdown).toContain('reading_minutes: 3')
    expect(markdown).toContain('tags: ["react"]')
  })

  it('escapes quotes in front-matter values', () => {
    expect(markdown).toContain('title: "Notes on \\"quoted\\" titles"')
  })

  it('cross-references the translated counterpart', () => {
    expect(markdown).toContain('translation_of: "https://marcusboni.com.br/blog/notas-pt"')
  })

  it('carries the body through unchanged', () => {
    expect(markdown).toContain('## Heading\n\nBody text.')
  })

  it('omits optional front-matter keys rather than emitting empty ones', () => {
    const bare = postMarkdown(
      { ...post, subtitle: '', excerpt: '', tags: [], translationOf: null, publishedAt: null },
      'Body.',
    )
    expect(bare).not.toContain('subtitle:')
    expect(bare).not.toContain('description:')
    expect(bare).not.toContain('tags:')
    expect(bare).not.toContain('translation_of:')
    expect(bare).not.toContain('date_published:')
  })
})

describe('resolveMedia', () => {
  const media = { hero: { src: 'https://cdn.example/hero-1600.webp', alt: 'Fallback alt' } }

  it('rewrites a media reference into a fetchable URL', () => {
    expect(resolveMedia('![A chart](media:hero)', media)).toBe(
      '![A chart](https://cdn.example/hero-1600.webp)',
    )
  })

  it("falls back to the media entry's own alt text", () => {
    expect(resolveMedia('![](media:hero)', media)).toBe(
      '![Fallback alt](https://cdn.example/hero-1600.webp)',
    )
  })

  it('leaves an unresolvable reference alone rather than emitting a dead link', () => {
    expect(resolveMedia('![x](media:gone)', media)).toBe('![x](media:gone)')
  })

  it('does not touch ordinary image links', () => {
    const plain = '![x](https://example.com/a.png)'
    expect(resolveMedia(plain, media)).toBe(plain)
  })
})
