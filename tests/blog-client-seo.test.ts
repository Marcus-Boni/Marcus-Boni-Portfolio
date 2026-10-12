import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PostBody } from '@/blog/components/PostBody'
import { applyBlogIndexHead, applyMissingPostHead, applyPostHead, restoreSiteHead } from '@/blog/lib/seo'
import { extractToc } from '@/blog/lib/text'
import type { PostMeta } from '@/blog/types'

vi.mock('@/blog/components/CodeBlock', () => ({ CodeBlock: () => null, InlineCode: ({ children }: { children: string }) => createElement('code', null, children) }))
vi.mock('@/blog/components/BlogImage', () => ({ BlogFigure: () => null }))
vi.mock('@/blog/components/directives', () => ({ Callout: () => null, Gallery: () => null, PullQuote: () => null, RepoCard: () => null, Video: () => null, YouTube: () => null }))

// A small head-only DOM double keeps navigation regressions in the existing
// Node test environment without adding a browser or DOM dependency.
class HeadElement {
  id = ''
  textContent = ''
  attributes = new Map<string, string>()
  readonly tag: string
  readonly owner: HeadDocument
  constructor(tag: string, owner: HeadDocument) { this.tag = tag; this.owner = owner }
  setAttribute(key: string, value: string) { this.attributes.set(key, value) }
  getAttribute(key: string) { return key === 'id' ? this.id : this.attributes.get(key) ?? null }
  remove() { this.owner.elements = this.owner.elements.filter((node) => node !== this) }
}

class HeadDocument {
  title = ''
  documentElement = { lang: 'en' }
  elements: HeadElement[] = []
  head = {
    appendChild: (node: HeadElement) => { this.elements.push(node) },
    querySelectorAll: (selector: string) => this.query(selector),
  }
  createElement(tag: string) { return new HeadElement(tag, this) }
  getElementById(id: string) { return this.elements.find((node) => node.id === id) ?? null }
  query(selector: string) {
    const tag = selector.match(/^\w+/)?.[0]
    const constraints = [...selector.matchAll(/\[([\w:-]+)(\^?=)?(?:"([^"]*)")?\]/g)]
    return this.elements.filter((node) => node.tag === tag && constraints.every(([, key, operator, value]) => {
      const actual = node.getAttribute(key)
      return !operator ? actual !== null : operator === '^=' ? actual?.startsWith(value) : actual === value
    }))
  }
  meta(key: string) { return this.query(`meta[name="${key}"]`)[0]?.getAttribute('content') ?? this.query(`meta[property="${key}"]`)[0]?.getAttribute('content') }
  schema() { return JSON.parse(this.query('script[type="application/ld+json"]')[0].textContent) }
}

const article: PostMeta = {
  slug: 'arquitetura', lang: 'pt', status: 'published', title: 'Arquitetura', excerpt: 'Decisões sobre arquitetura.',
  tags: ['TypeScript'], readingMinutes: 3, publishedAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-02T12:00:00.000Z',
}

let document: HeadDocument
beforeEach(() => { document = new HeadDocument(); vi.stubGlobal('document', document) })
afterEach(() => vi.unstubAllGlobals())

describe('blog client head navigation', () => {
  it('replaces a delivered anonymous article schema instead of duplicating it', () => {
    const old = document.createElement('script')
    old.setAttribute('type', 'application/ld+json')
    old.textContent = JSON.stringify({ '@type': 'BlogPosting', headline: 'Previous post' })
    document.head.appendChild(old)
    applyPostHead(article)
    expect(document.query('script[type="application/ld+json"]')).toHaveLength(1)
    const [post, breadcrumbs] = document.schema()['@graph']
    expect(post.headline).toBe(article.title)
    expect(post.author.url).toBe('https://marcusboni.com.br/about')
    expect(breadcrumbs.itemListElement).toHaveLength(3)
    expect(document.meta('article:published_time')).toBe(article.publishedAt)
    expect(document.documentElement.lang).toBe('pt-BR')
  })

  it('indexes only published articles and resets robots after an unlisted visit', () => {
    applyPostHead({ ...article, status: 'unlisted' })
    expect(document.meta('robots')).toBe('noindex, follow')
    applyPostHead(article)
    expect(document.meta('robots')).toContain('index, follow')
    expect(document.meta('robots')).not.toContain('noindex')
  })

  it('declares translations only for published reciprocal language pairs and removes stale tags', () => {
    const post = { ...article, translationOf: 'architecture' }
    const counterpart: PostMeta = { ...article, slug: 'architecture', lang: 'en', translationOf: article.slug }
    applyPostHead(post, counterpart)
    expect(document.query('link[rel="alternate"][hreflang]')).toHaveLength(3)
    applyPostHead(post, { ...counterpart, translationOf: undefined })
    expect(document.query('link[rel="alternate"][hreflang]')).toHaveLength(0)
    applyPostHead(post, { ...counterpart, status: 'unlisted' })
    expect(document.query('link[rel="alternate"][hreflang]')).toHaveLength(0)
    applyPostHead(article)
    expect(document.meta('og:locale:alternate')).toBeUndefined()
  })

  it('clears article metadata and updates canonical, Markdown alternate and schema on index navigation', () => {
    applyPostHead(article)
    applyBlogIndexHead([article])
    expect(document.query('meta[property^="article:"]')).toHaveLength(0)
    expect(document.query('link[rel="canonical"]')[0].getAttribute('href')).toBe('https://marcusboni.com.br/blog')
    expect(document.query('link[type="text/markdown"]')[0].getAttribute('href')).toBe('https://marcusboni.com.br/blog')
    expect(document.schema()['@type']).toBe('Blog')
    expect(document.schema().blogPost[0].url).toBe('https://marcusboni.com.br/blog/arquitetura')
  })

  it('removes canonical, article schema and alternate representation for a missing article', () => {
    applyPostHead(article)
    applyMissingPostHead('pt', '/blog/does-not-exist')
    expect(document.meta('robots')).toBe('noindex, follow')
    expect(document.query('link[rel="canonical"]')).toHaveLength(0)
    expect(document.query('link[type="text/markdown"]')).toHaveLength(0)
    expect(document.query('script[type="application/ld+json"]')).toHaveLength(0)
  })

  it('restores home language, indexability and the portfolio graph when leaving the blog', () => {
    applyPostHead({ ...article, status: 'unlisted', lang: 'en' })
    restoreSiteHead('pt')
    expect(document.documentElement.lang).toBe('pt-BR')
    expect(document.meta('robots')).not.toContain('noindex')
    expect(document.getElementById('site-jsonld')).not.toBeNull()
    expect(document.schema()['@graph'].map((node: { '@type': string }) => node['@type'])).toEqual(['Person', 'WebSite', 'WebPage'])
    applyPostHead(article)
    expect(document.getElementById('site-jsonld')).toBeNull()
    expect(document.query('script[type="application/ld+json"]')).toHaveLength(1)
  })
})

describe('article heading hierarchy and table of contents', () => {
  it('keeps the page title as the only h1 and keeps table of contents IDs aligned', () => {
    const markdown = '# Contexto\n\n## Decisões\n\n### Detalhes\n\n## Decisões'
    const html = renderToStaticMarkup(createElement(PostBody, { markdown }))
    expect(html).not.toContain('<h1')
    expect(html).toContain('<h2 id="contexto">')
    expect(html).toContain('<h3 id="decisões">')
    expect(html).toContain('<h4 id="detalhes">')
    const toc = extractToc(markdown)
    expect(toc.map((entry) => entry.depth)).toEqual([2, 3, 3])
    for (const entry of toc) expect(html).toContain(`id="${entry.id}"`)
  })

  it('preserves heading levels when the body already begins at h2', () => {
    const markdown = '## Uso de `React`\n\n### Exemplos\n\n#### Repetido\n\n## Repetido'
    const html = renderToStaticMarkup(createElement(PostBody, { markdown }))
    expect(html).toContain('<h2 id="uso-de-react">')
    for (const entry of extractToc(markdown)) expect(html).toContain(`id="${entry.id}"`)
  })

  it('handles setext titles and ignores fenced code headings', () => {
    const markdown = 'Contexto\n========\n\n## Decisões\n\n~~~md\n# Exemplo\n## Ignorado\n~~~'
    const html = renderToStaticMarkup(createElement(PostBody, { markdown }))
    expect(html).not.toContain('<h1')
    expect(extractToc(markdown).map((entry) => entry.text)).toEqual(['Contexto', 'Decisões'])
    for (const entry of extractToc(markdown)) expect(html).toContain(`id="${entry.id}"`)
  })
})
