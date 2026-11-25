import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BlogIndex } from '@/blog/pages/BlogIndex'
import { BlogPost } from '@/blog/pages/BlogPost'
import { applyBlogIndexHead, applyPostHead } from '@/blog/lib/seo'
import type { Post, PostMeta } from '@/blog/types'
import { isLocaleTransitioning, isPlainLeftClick, transitionLocale } from '@/lib/locale-transition'
import {
  availableLangs,
  collapseLegacyPairs,
  findLegacyPairs,
  isBilingual,
  localizedBody,
  localizedMeta,
  postPath,
} from '../netlify/lib/blog-locale'

const bilingualPost: Post = {
  slug: 'diagnosticar-wi-fi-lento-com-ia',
  lang: 'pt',
  status: 'published',
  title: 'Como diagnostiquei e melhorei meu Wi-Fi com IA',
  subtitle: 'Dois roteadores dividiam o mesmo bloco de 5 GHz.',
  excerpt: 'O pico de ping ao roteador caiu de 330 para 12 ms.',
  tags: ['Wi-Fi', 'Windows', 'IA'],
  readingMinutes: 5,
  publishedAt: '2026-11-24T12:00:00.000Z',
  updatedAt: '2026-11-24T12:00:00.000Z',
  locales: {
    pt: {
      title: 'Como diagnostiquei e melhorei meu Wi-Fi com IA',
      subtitle: 'Dois roteadores dividiam o mesmo bloco de 5 GHz.',
      excerpt: 'O pico de ping ao roteador caiu de 330 para 12 ms.',
      tags: ['Wi-Fi', 'Windows', 'IA'],
      readingMinutes: 5,
    },
    en: {
      title: 'How I diagnosed and improved my Wi-Fi with AI',
      subtitle: 'Two routers shared the same 5 GHz channels.',
      excerpt: 'Peak ping to my router dropped from 330 to 12 ms.',
      tags: ['Wi-Fi', 'Windows', 'AI'],
      readingMinutes: 5,
    },
  },
  body: '## Dois roteadores\n\nTexto em português.',
  bodies: {
    pt: '## Dois roteadores\n\nTexto em português.',
    en: '## Two routers\n\nEnglish text.',
  },
  media: {},
}

const ptOnlyPost: PostMeta = {
  slug: 'postgres-legado',
  lang: 'pt',
  status: 'published',
  title: 'PostgreSQL legado sem medo',
  excerpt: 'Ler uma base antiga com APIs.',
  tags: ['PostgreSQL'],
  readingMinutes: 4,
  publishedAt: '2026-10-02T12:00:00.000Z',
  updatedAt: '2026-10-02T12:00:00.000Z',
}

const enOnlyPost: PostMeta = {
  slug: 'what-a-hackathon-teaches',
  lang: 'en',
  status: 'published',
  title: 'What a hackathon teaches about scope',
  excerpt: 'Three days, one product.',
  tags: ['React'],
  readingMinutes: 4,
  publishedAt: '2026-09-05T12:00:00.000Z',
  updatedAt: '2026-09-05T12:00:00.000Z',
}

const state = vi.hoisted(() => ({
  locale: 'pt' as 'pt' | 'en',
  post: null as Post | null,
  posts: [] as PostMeta[],
}))

vi.mock('@/blog/usePosts', () => ({
  usePost: () => ({ status: 'ready', retry: () => {}, post: state.post }),
  usePostList: () => ({ status: 'ready', retry: () => {}, posts: state.posts }),
}))
vi.mock('@/hooks/useScrollReveal', () => ({ useScrollReveal: () => ({ current: null }) }))
vi.mock('@/i18n/LanguageContext', async () => {
  const { translations } = await import('@/i18n/translations')
  return {
    useLanguage: () => ({
      locale: state.locale,
      setLocale: () => {},
      t: translations[state.locale],
    }),
  }
})
vi.mock('@/lib/analytics', () => ({ trackEvent: () => {} }))

describe('unified bilingual post helpers', () => {
  it('recognizes bilingual vs single-language posts and builds distinct SEO paths', () => {
    expect(isBilingual(bilingualPost)).toBe(true)
    expect(availableLangs(bilingualPost)).toEqual(['pt', 'en'])
    expect(postPath(bilingualPost, 'pt')).toBe('/blog/diagnosticar-wi-fi-lento-com-ia')
    expect(postPath(bilingualPost, 'en')).toBe('/en/blog/diagnosticar-wi-fi-lento-com-ia')

    expect(isBilingual(ptOnlyPost)).toBe(false)
    expect(postPath(ptOnlyPost, 'pt')).toBe('/blog/postgres-legado')
    expect(postPath(ptOnlyPost, 'en')).toBe('/blog/postgres-legado')

    expect(isBilingual(enOnlyPost)).toBe(false)
    expect(postPath(enOnlyPost, 'pt')).toBe('/blog/what-a-hackathon-teaches')
    expect(postPath(enOnlyPost, 'en')).toBe('/blog/what-a-hackathon-teaches')
  })

  it('projects metadata and body into the requested language with clean fallback', () => {
    expect(localizedMeta(bilingualPost, 'en').title).toBe(
      'How I diagnosed and improved my Wi-Fi with AI',
    )
    expect(localizedBody(bilingualPost, 'en')).toContain('English text.')
    expect(localizedBody(bilingualPost, 'pt')).toContain('Texto em português.')

    const fallback = localizedMeta(ptOnlyPost, 'en')
    expect(fallback.lang).toBe('pt')
    expect(fallback.isFallback).toBe(true)
    expect(fallback.title).toBe('PostgreSQL legado sem medo')
  })

  it('collapses legacy reciprocal translationOf pairs into one entry and identifies them for admin merge', () => {
    const legacyPt: PostMeta = {
      ...ptOnlyPost,
      slug: 'caixa-pt',
      title: 'Caixa PT',
      translationOf: 'box-en',
    }
    const legacyEn: PostMeta = {
      ...enOnlyPost,
      slug: 'box-en',
      title: 'Box EN',
      translationOf: 'caixa-pt',
    }

    const ptIndex = collapseLegacyPairs([legacyPt, legacyEn, ptOnlyPost], 'pt')
    expect(ptIndex).toHaveLength(2)
    expect(ptIndex[0].post.slug).toBe('caixa-pt')
    expect(ptIndex[0].availableLangs).toEqual(['pt', 'en'])

    const enIndex = collapseLegacyPairs([legacyPt, legacyEn, ptOnlyPost], 'en')
    expect(enIndex).toHaveLength(2)
    expect(enIndex[0].post.slug).toBe('box-en')
    expect(enIndex[0].canonicalSlug).toBe('caixa-pt')

    expect(findLegacyPairs([legacyPt, legacyEn, bilingualPost])).toEqual([
      { pt: legacyPt, en: legacyEn },
    ])
  })
})

describe('unified diary index and article UI', () => {
  beforeEach(() => {
    state.post = bilingualPost
    state.posts = [bilingualPost, ptOnlyPost, enOnlyPost]
  })

  it('lists each publication once in the active language without a redundant language filter', () => {
    state.locale = 'pt'
    const ptHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/blog'] },
        createElement(Routes, null, createElement(Route, { path: '/blog', element: createElement(BlogIndex, { routeLang: 'pt' }) })),
      ),
    )
    expect(ptHtml).toContain('Como diagnostiquei e melhorei meu Wi-Fi com IA')
    expect(ptHtml).not.toContain('How I diagnosed and improved my Wi-Fi with AI')
    expect(ptHtml).toContain('PT · EN')
    expect(ptHtml).toContain('3 registros')
    expect(ptHtml).not.toContain('aria-label="Idioma"')

    state.locale = 'en'
    const enHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/en/blog'] },
        createElement(Routes, null, createElement(Route, { path: '/en/blog', element: createElement(BlogIndex, { routeLang: 'en' }) })),
      ),
    )
    expect(enHtml).toContain('How I diagnosed and improved my Wi-Fi with AI')
    expect(enHtml).not.toContain('Como diagnostiquei e melhorei meu Wi-Fi com IA')
    expect(enHtml).toContain('href="/en/blog/diagnosticar-wi-fi-lento-com-ia"')
    expect(enHtml).toContain('3 entries')
  })

  it('renders PT at /blog/:slug and EN at /en/blog/:slug for the same publication with matching ordinal', () => {
    state.locale = 'pt'
    const ptHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/blog/diagnosticar-wi-fi-lento-com-ia'] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: '/blog/:slug',
            element: createElement(BlogPost, { routeLang: 'pt' }),
          }),
        ),
      ),
    )
    expect(ptHtml).toContain('lang="pt-BR"')
    expect(ptHtml).toContain('Como diagnostiquei e melhorei meu Wi-Fi com IA')
    expect(ptHtml).toContain('Texto em português.')
    expect(ptHtml).toContain('href="/en/blog/diagnosticar-wi-fi-lento-com-ia"')
    expect(ptHtml).toContain('Read in English')
    expect(ptHtml).toContain('Nº 003')

    state.locale = 'en'
    const enHtml = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ['/en/blog/diagnosticar-wi-fi-lento-com-ia'] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: '/en/blog/:slug',
            element: createElement(BlogPost, { routeLang: 'en' }),
          }),
        ),
      ),
    )
    expect(enHtml).toContain('lang="en"')
    expect(enHtml).toContain('How I diagnosed and improved my Wi-Fi with AI')
    expect(enHtml).toContain('English text.')
    expect(enHtml).toContain('href="/blog/diagnosticar-wi-fi-lento-com-ia"')
    expect(enHtml).toContain('Ler em português')
    expect(enHtml).toContain('No. 003')
  })
})

describe('bilingual client SEO head', () => {
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
    documentElement = { lang: 'pt-BR' }
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
  }

  let doc: HeadDocument
  beforeEach(() => { doc = new HeadDocument(); vi.stubGlobal('document', doc) })
  afterEach(() => vi.unstubAllGlobals())

  it('emits reciprocal hreflang and localized metadata for a single bilingual post', () => {
    applyPostHead(bilingualPost, null, 'en')
    expect(doc.documentElement.lang).toBe('en')
    expect(doc.title).toContain('How I diagnosed and improved my Wi-Fi with AI')
    expect(doc.query('link[rel="canonical"]')[0].getAttribute('href')).toBe(
      'https://marcusboni.com.br/en/blog/diagnosticar-wi-fi-lento-com-ia',
    )
    const alternates = doc.query('link[rel="alternate"][hreflang]')
    expect(alternates).toHaveLength(3)
    expect(doc.meta('og:locale')).toBe('en_US')
    expect(doc.meta('og:locale:alternate')).toBe('pt_BR')

    applyBlogIndexHead([bilingualPost], 'en')
    expect(doc.query('link[rel="canonical"]')[0].getAttribute('href')).toBe(
      'https://marcusboni.com.br/en/blog',
    )
    expect(doc.query('link[rel="alternate"][hreflang]')).toHaveLength(3)
  })
})

describe('bilingual edge functions (HTML, sitemap, RSS, agents, API, publish)', () => {
  type EdgeHandler = (request: Request, context: { next: () => Promise<Response> }) => Promise<Response>

  const shell = `<!doctype html><html lang="pt-BR"><head><!-- SEO:START --><title>Home</title><!-- SEO:END --></head><body><div id="root"><!-- BODY:START --><p>Shell</p><!-- BODY:END --></div></body></html>`

  const bilingualDoc = {
    name: 'projects/demo/databases/(default)/documents/posts/wifi-ia',
    fields: {
      status: { stringValue: 'published' },
      lang: { stringValue: 'pt' },
      title: { stringValue: 'Wi-Fi com IA' },
      subtitle: { stringValue: 'Subtítulo PT' },
      excerpt: { stringValue: 'Resumo PT' },
      tags: { arrayValue: { values: [{ stringValue: 'IA' }] } },
      readingMinutes: { integerValue: '5' },
      publishedAt: { stringValue: '2026-11-24T12:00:00.000Z' },
      updatedAt: { stringValue: '2026-11-24T12:00:00.000Z' },
      locales: {
        mapValue: {
          fields: {
            pt: {
              mapValue: {
                fields: {
                  title: { stringValue: 'Wi-Fi com IA' },
                  subtitle: { stringValue: 'Subtítulo PT' },
                  excerpt: { stringValue: 'Resumo PT' },
                  tags: { arrayValue: { values: [{ stringValue: 'IA' }] } },
                  readingMinutes: { integerValue: '5' },
                },
              },
            },
            en: {
              mapValue: {
                fields: {
                  title: { stringValue: 'Wi-Fi with AI' },
                  subtitle: { stringValue: 'Subtitle EN' },
                  excerpt: { stringValue: 'Summary EN' },
                  tags: { arrayValue: { values: [{ stringValue: 'AI' }] } },
                  readingMinutes: { integerValue: '5' },
                },
              },
            },
          },
        },
      },
    },
  }

  const bilingualBodyDoc = {
    fields: {
      body: { stringValue: '## Caso\n\nTexto em português.' },
      bodies: {
        mapValue: {
          fields: {
            pt: { stringValue: '## Caso\n\nTexto em português.' },
            en: { stringValue: '## Case\n\nText in English.' },
          },
        },
      },
      media: { mapValue: { fields: {} } },
    },
  }

  const monoDoc = {
    name: 'projects/demo/databases/(default)/documents/posts/so-pt',
    fields: {
      status: { stringValue: 'published' },
      lang: { stringValue: 'pt' },
      title: { stringValue: 'Só em português' },
      excerpt: { stringValue: 'Resumo único' },
      tags: { arrayValue: { values: [{ stringValue: 'notas' }] } },
      readingMinutes: { integerValue: '3' },
      publishedAt: { stringValue: '2026-10-01T12:00:00.000Z' },
      updatedAt: { stringValue: '2026-10-01T12:00:00.000Z' },
    },
  }

  const ctx = () => ({ next: async () => new Response(shell, { headers: { 'content-type': 'text/html' } }) })

  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('Deno', { env: { get: () => 'demo' } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: unknown) => {
        const url = String(input)
        if (url.endsWith(':runQuery')) {
          return Response.json([{ document: bilingualDoc }, { document: monoDoc }])
        }
        if (url.endsWith('/posts/wifi-ia/content/main')) return Response.json(bilingualBodyDoc)
        if (url.endsWith('/posts/wifi-ia')) return Response.json(bilingualDoc)
        if (url.endsWith('/posts/so-pt')) return Response.json(monoDoc)
        return new Response('{}', { status: 404 })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('serves localized edge HTML with reciprocal hreflang and 301-redirects non-bilingual /en/blog/:slug', async () => {
    const blogMeta = (await import('../netlify/edge-functions/blog-meta.ts')).default as unknown as EdgeHandler

    const ptHtml = await (await blogMeta(new Request('https://x/blog/wifi-ia'), ctx())).text()
    expect(ptHtml).toContain('<html lang="pt-BR">')
    expect(ptHtml).toContain('<h1>Wi-Fi com IA</h1>')
    expect(ptHtml).toContain('Texto em português.')
    expect(ptHtml).toContain('<link rel="canonical" href="https://marcusboni.com.br/blog/wifi-ia">')
    expect(ptHtml).toContain('hreflang="en" href="https://marcusboni.com.br/en/blog/wifi-ia"')

    const enHtml = await (await blogMeta(new Request('https://x/en/blog/wifi-ia'), ctx())).text()
    expect(enHtml).toContain('<html lang="en">')
    expect(enHtml).toContain('<h1>Wi-Fi with AI</h1>')
    expect(enHtml).toContain('Text in English.')
    expect(enHtml).toContain('<link rel="canonical" href="https://marcusboni.com.br/en/blog/wifi-ia">')
    expect(enHtml).toContain('hreflang="pt-BR" href="https://marcusboni.com.br/blog/wifi-ia"')

    const enIndex = await (await blogMeta(new Request('https://x/en/blog'), ctx())).text()
    expect(enIndex).toContain('<html lang="en">')
    expect(enIndex).toContain('Wi-Fi with AI')
    expect(enIndex).not.toContain('Wi-Fi com IA')

    const monoRedirect = await blogMeta(new Request('https://x/en/blog/so-pt'), ctx())
    expect(monoRedirect.status).toBe(301)
    expect(monoRedirect.headers.get('location')).toBe('https://x/blog/so-pt')
  })

  it('emits both localized URLs with hreflang in sitemap while keeping RSS deduplicated', async () => {
    const feeds = (await import('../netlify/edge-functions/feeds.ts')).default as unknown as EdgeHandler

    const sitemap = await (await feeds(new Request('https://x/sitemap.xml'), ctx())).text()
    expect(sitemap).toContain('<loc>https://marcusboni.com.br/blog/wifi-ia</loc>')
    expect(sitemap).toContain('<loc>https://marcusboni.com.br/en/blog/wifi-ia</loc>')
    expect(sitemap).toContain('<loc>https://marcusboni.com.br/blog/so-pt</loc>')
    expect(sitemap).not.toContain('<loc>https://marcusboni.com.br/en/blog/so-pt</loc>')
    expect(sitemap).toContain('<loc>https://marcusboni.com.br/en/blog</loc>')

    const rss = await (await feeds(new Request('https://x/rss.xml'), ctx())).text()
    expect(rss.match(/<item>/g)).toHaveLength(2)
    expect(rss).toContain('<title>Wi-Fi com IA</title>')
    expect(rss).not.toContain('<title>Wi-Fi with AI</title>')
  })

  it('serves localized Markdown via Accept: text/markdown and JSON via /api/v1/posts', async () => {
    const agents = (await import('../netlify/edge-functions/agents.ts')).default as unknown as EdgeHandler
    const api = (await import('../netlify/edge-functions/api.ts')).default as unknown as EdgeHandler

    const mdRes = await agents(
      new Request('https://x/en/blog/wifi-ia', { headers: { accept: 'text/markdown' } }),
      ctx(),
    )
    expect(mdRes.status).toBe(200)
    const md = await mdRes.text()
    expect(md).toContain('title: "Wi-Fi with AI"')
    expect(md).toContain('url: "https://marcusboni.com.br/en/blog/wifi-ia"')
    expect(md).toContain('Text in English.')

    const apiList = (await (await api(new Request('https://x/api/v1/posts?lang=en'), ctx())).json()) as {
      count: number
      items: Record<string, unknown>[]
    }
    expect(apiList.count).toBe(2)
    expect(apiList.items[0].title).toBe('Wi-Fi with AI')
    expect(apiList.items[0].availableLanguages).toEqual(['pt-BR', 'en'])

    const apiOne = (await (await api(new Request('https://x/api/v1/posts/wifi-ia?lang=en'), ctx())).json()) as {
      title: string
      body: string
      bodies: { pt: string; en: string }
    }
    expect(apiOne.title).toBe('Wi-Fi with AI')
    expect(apiOne.body).toContain('Text in English.')
    expect(apiOne.bodies.pt).toContain('Texto em português.')
  })
})

describe('directional locale transition', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('commits cleanly and runs a directional View Transition when supported', async () => {
    const classes = new Set<string>()
    let resolveFinished!: () => void
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve
    })
    const removed: string[] = []
    const appended: { id: string; className: string }[] = []

    const fakeDoc = {
      documentElement: {
        dataset: {} as Record<string, string>,
        classList: {
          add: (...names: string[]) => names.forEach((n) => classes.add(n)),
          remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
        },
        offsetWidth: 100,
      },
      body: {
        appendChild: (node: { id: string; className: string }) => appended.push(node),
      },
      getElementById: () => null,
      createElement: () => ({
        id: '',
        className: '',
        setAttribute: () => {},
        remove: () => removed.push('bar'),
      }),
      startViewTransition: vi.fn((cb: () => void) => {
        cb()
        return { finished }
      }),
    }
    vi.stubGlobal('document', fakeDoc)
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
      setTimeout: () => 1,
      clearTimeout: () => {},
    })

    let committed = false
    transitionLocale('en', () => {
      committed = true
    })

    expect(committed).toBe(true)
    expect(fakeDoc.startViewTransition).toHaveBeenCalledTimes(1)
    expect(fakeDoc.documentElement.dataset.localeDir).toBe('to-en')
    expect(classes.has('locale-switch')).toBe(true)
    expect(isLocaleTransitioning()).toBe(true)
    expect(appended[0]?.className).toContain('locale-signal-to-en')

    resolveFinished()
    await finished
    await Promise.resolve()

    expect(classes.has('locale-switch')).toBe(false)
    expect(isLocaleTransitioning()).toBe(false)
  })

  it('uses the calm reduced-motion path with no signal sweep when reduced motion is active', async () => {
    const classes = new Set<string>()
    const appended: unknown[] = []
    const fakeDoc = {
      documentElement: {
        dataset: {} as Record<string, string>,
        classList: {
          add: (...names: string[]) => names.forEach((n) => classes.add(n)),
          remove: (...names: string[]) => names.forEach((n) => classes.delete(n)),
        },
      },
      body: { appendChild: (node: unknown) => appended.push(node) },
      getElementById: () => null,
      startViewTransition: vi.fn((cb: () => void) => {
        cb()
        return { finished: Promise.resolve() }
      }),
    }
    vi.stubGlobal('document', fakeDoc)
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
      setTimeout: () => 1,
      clearTimeout: () => {},
    })

    let ran = false
    transitionLocale('pt', () => {
      ran = true
    })

    expect(ran).toBe(true)
    expect(fakeDoc.documentElement.dataset.localeDir).toBe('to-pt')
    expect(classes.has('locale-switch-reduced')).toBe(true)
    expect(classes.has('locale-switch')).toBe(false)
    expect(appended).toHaveLength(0)
  })

  it('preserves native new-tab link behavior on modified or non-primary clicks', () => {
    const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false }
    expect(isPlainLeftClick(plain)).toBe(true)
    expect(isPlainLeftClick({ ...plain, ctrlKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, metaKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...plain, button: 1 })).toBe(false)
  })
})
