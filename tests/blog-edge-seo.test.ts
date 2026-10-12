import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

type Handler = (request: Request, context: { next: () => Promise<Response> }) => Promise<Response>
const shell = `<!doctype html><html lang="en"><head><!-- SEO:START --><title>Home</title><!-- SEO:END -->
  <script id="site-jsonld" type="application/ld+json">{"@type":"ProfilePage"}</script></head>
  <body><div id="root"><!-- BODY:START --><p>Portfolio shell</p><!-- BODY:END --></div><script type="module" src="/assets/app.js"></script></body></html>`
const fields = (overrides: Record<string, unknown> = {}) => ({
  title: { stringValue: 'Engenharia <segura> & clara' },
  subtitle: { stringValue: 'Subtítulo' }, excerpt: { stringValue: 'Descrição útil' },
  status: { stringValue: 'published' }, lang: { stringValue: 'pt' },
  publishedAt: { stringValue: '2026-09-01T12:00:00.000Z' },
  updatedAt: { stringValue: '2026-09-02T12:00:00.000Z' }, ...overrides,
})
const document = (slug: string, overrides: Record<string, unknown> = {}) => ({
  name: `projects/demo/databases/(default)/documents/posts/${slug}`, fields: fields(overrides),
})
const body = '## Método\n\nConteúdo completo com **evidência**.\n\n[Referência](https://example.org)\n\n![Diagrama](media:chart)'
const bodyFields = (markdown = body) => ({ fields: {
  body: { stringValue: markdown },
  media: { mapValue: { fields: { chart: { mapValue: { fields: { src: { stringValue: 'https://example.org/chart.webp' }, alt: { stringValue: 'Fluxo' } } } } } } },
} })
let handler: Handler
let feeds: Handler
let fetchMock: ReturnType<typeof vi.fn>

const context = (html = shell) => ({ next: async () => new Response(html, { headers: { 'content-type': 'text/html', etag: 'old' } }) })
const request = (path: string, method = 'GET') => new Request(`https://preview.netlify.app${path}`, { method })

beforeEach(async () => {
  vi.resetModules()
  vi.stubGlobal('Deno', { env: { get: () => 'demo' } })
  fetchMock = vi.fn(async (input: unknown) => {
    const url = String(input)
    if (url.endsWith(':runQuery')) return Response.json([{ document: document('metodo') }])
    if (url.endsWith('/posts/metodo/content/main')) return Response.json(bodyFields())
    if (url.endsWith('/posts/metodo')) return Response.json(document('metodo'))
    return new Response('{}', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  handler = (await import('../netlify/edge-functions/blog-meta.ts')).default as unknown as Handler
  feeds = (await import('../netlify/edge-functions/feeds.ts')).default as unknown as Handler
})
afterEach(() => vi.unstubAllGlobals())

describe('delivered blog HTML', () => {
  it('serves article content, canonical, language, author and breadcrumbs without JavaScript', async () => {
    const response = await handler(request('/blog/metodo'), context())
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('<html lang="pt-BR">')
    expect(html).toContain('<h1>Engenharia &lt;segura&gt; &amp; clara</h1>')
    expect(html).toContain('Conteúdo completo com <strong>evidência</strong>')
    expect(html).toContain('src="https://example.org/chart.webp"')
    expect(html).toContain('href="https://marcusboni.com.br/blog/metodo"')
    expect(html).not.toContain('Portfolio shell')
    expect(html).not.toContain('ProfilePage')
    expect(response.headers.get('etag')).toBeNull()
    const json = JSON.parse(html.match(/<script id="blog-jsonld" type="application\/ld\+json">(.*?)<\/script>/s)![1])
    expect(json['@graph'][0]['@type']).toBe('BlogPosting')
    expect(json['@graph'][0].author.url).toBe('https://marcusboni.com.br/about')
    expect(json['@graph'][1]['@type']).toBe('BreadcrumbList')
  })

  it('redirects trailing-slash duplicates to the canonical URL before any lookup', async () => {
    const article = await handler(request('/blog/metodo/?utm_source=x'), context())
    expect(article.status).toBe(301)
    expect(article.headers.get('location')).toBe('https://preview.netlify.app/blog/metodo?utm_source=x')
    const index = await handler(request('/blog/'), context())
    expect(index.status).toBe(301)
    expect(index.headers.get('location')).toBe('https://preview.netlify.app/blog')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('declares share-image dimensions, uses name= for X cards and shows a later revision date', async () => {
    const html = await (await handler(request('/blog/metodo'), context())).text()
    expect(html).toContain('<meta property="og:image" content="https://marcusboni.com.br/og-image.jpg">')
    expect(html).toContain('<meta property="og:image:width" content="1200">')
    expect(html).toContain('<meta property="og:image:height" content="630">')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(html).not.toContain('property="twitter:')
    expect(html).toContain('Atualizado em <time datetime="2026-09-02T12:00:00.000Z">2026-09-02</time>')
  })

  it('serves blog-specific head and crawlable index links', async () => {
    const response = await handler(request('/blog'), context())
    const html = await response.text()
    expect(html).toContain('<h1>Blog de engenharia de software</h1>')
    expect(html).toContain('<a href="https://marcusboni.com.br/blog/metodo">')
    expect(html).toContain('"@type":"Blog"')
    expect(html).not.toContain('<title>Home</title>')
  })

  it('uses real 404 for missing/draft and 503 Retry-After for metadata or content outages', async () => {
    expect((await handler(request('/blog/ausente'), context())).status).toBe(404)
    fetchMock.mockImplementation(async () => new Response('{}', { status: 403 }))
    expect((await handler(request('/blog/rascunho'), context())).status).toBe(404)
    fetchMock.mockImplementation(async () => new Response('{}', { status: 503 }))
    const outage = await handler(request('/blog/metodo'), context())
    expect(outage.status).toBe(503)
    expect(outage.headers.get('Retry-After')).toBe('300')
    expect(await outage.text()).not.toContain('Portfolio shell')
  })

  it('fails safely when the content document or HTML template is unavailable', async () => {
    fetchMock.mockImplementation(async (input: unknown) => String(input).endsWith('/content/main')
      ? new Response('{}', { status: 500 }) : Response.json(document('metodo')))
    expect((await handler(request('/blog/metodo'), context())).status).toBe(503)
    fetchMock.mockImplementation(async (input: unknown) => String(input).endsWith('/content/main')
      ? Response.json(bodyFields()) : Response.json(document('metodo')))
    expect((await handler(request('/blog/metodo'), context('<html>missing markers</html>'))).status).toBe(503)
  })

  it('keeps unlisted articles readable but noindex and out of translation clusters', async () => {
    fetchMock.mockImplementation(async (input: unknown) => String(input).endsWith('/content/main')
      ? Response.json(bodyFields()) : Response.json(document('metodo', { status: { stringValue: 'unlisted' }, translationOf: { stringValue: 'method' } })))
    const response = await handler(request('/blog/metodo'), context())
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, follow')
    expect(html).toContain('content="noindex, follow"')
    expect(html).not.toContain('hreflang=')
  })

  it('only emits reciprocal published translations and uses the English document language', async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input)
      if (url.endsWith('/content/main')) return Response.json(bodyFields())
      return Response.json(url.endsWith('/posts/method')
        ? document('method', { lang: { stringValue: 'en' }, translationOf: { stringValue: 'metodo' } })
        : document('metodo', { translationOf: { stringValue: 'method' } }))
    })
    const html = await (await handler(request('/blog/method'), context())).text()
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('hreflang="pt-BR"')
    expect(html).toContain('hreflang="en"')
    expect(html).toContain('hreflang="x-default"')
  })

  it('omits translation hints when the published counterpart does not link back', async () => {
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input)
      if (url.endsWith('/content/main')) return Response.json(bodyFields())
      return Response.json(url.endsWith('/posts/method')
        ? document('method', { lang: { stringValue: 'en' } })
        : document('metodo', { translationOf: { stringValue: 'method' } }))
    })
    expect(await (await handler(request('/blog/metodo'), context())).text()).not.toContain('hreflang=')
  })

  it('returns 503 when Firebase is not configured rather than indexing a home shell', async () => {
    vi.resetModules()
    vi.stubGlobal('Deno', { env: { get: () => undefined } })
    const unconfigured = (await import('../netlify/edge-functions/blog-meta.ts')).default as unknown as Handler
    expect((await unconfigured(request('/blog/metodo'), context())).status).toBe(503)
    expect((await unconfigured(request('/blog'), context())).status).toBe(503)
  })

  it('HEAD retains article status and metadata headers with no body', async () => {
    const headOrigin = { next: async () => new Response(null, { headers: { 'content-type': 'text/html' } }) }
    const response = await handler(request('/blog/metodo', 'HEAD'), headOrigin)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('')
    expect((await handler(request('/blog', 'HEAD'), headOrigin)).status).toBe(200)
    expect((await handler(request('/blog/ausente', 'HEAD'), headOrigin)).status).toBe(404)
  })

  it('escapes malicious metadata and does not interpret replacement tokens in content', async () => {
    fetchMock.mockImplementation(async (input: unknown) => String(input).endsWith('/content/main')
      ? Response.json(bodyFields('Texto $& literal\n\n<script>alert(1)</script>'))
      : Response.json(document('metodo', { title: { stringValue: '</script><script>alert(1)</script> $&' } })))
    const html = await (await handler(request('/blog/metodo'), context())).text()
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('Portfolio shell')
    expect(html).toContain('Texto $&amp; literal')
    expect(html).toContain('\\u003c/script\\u003e')
  })

  it('preserves GFM and directives while rejecting script URLs and event attributes', async () => {
    const { renderMarkdown } = await import('../netlify/lib/blog-html.ts')
    const html = renderMarkdown('# Body title\n\n## Section\n\n:::callout{title="Useful" onclick="alert(1)"}\nKeep **this advice**.\n:::\n\n::repo{owner=example name=repo desc="Description"}\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n[bad](javascript:alert(1))\n\n![bad](media:evil)', { evil: { src: 'javascript:alert(1)' } })
    expect(html).toContain('<h2 id="body-title">Body title</h2>')
    expect(html).toContain('<h3 id="section">Section</h3>')
    expect(html).toContain('<aside>')
    expect(html).toContain('<strong>this advice</strong>')
    expect(html).toContain('<table>')
    expect(html).toContain('https://github.com/example/repo')
    expect(html).not.toContain('onclick=')
    expect(html).not.toContain('javascript:')
  })

  it('produces representative real-handler HTML fixtures for local visual verification', async () => {
    const markdown = `# Decisões de arquitetura\n\nUm artigo técnico legível antes da execução de JavaScript, com exemplos, links e evidência.\n\n## Um modelo simples\n\nEscolha limites claros e registre os motivos das decisões. [Consulte a referência](https://example.org).\n\n:::callout{title="Uma decisão importante"}\nValide as suposições com **resultados observáveis** antes de ampliar o projeto.\n:::\n\n![Diagrama de exemplo](/og-image.jpg)\n\n\`\`\`ts\nconst resultado = validar(dados)\n\`\`\`\n\n| Decisão | Evidência |\n| --- | --- |\n| Limites claros | Testes de contrato |\n\n## Próximos passos\n\n1. Meça o comportamento.\n2. Registre a decisão.\n\n::repo{owner=marcusboni name=portfolio desc="Exemplo de repositório"}\n`
    fetchMock.mockImplementation(async (input: unknown) => {
      const url = String(input)
      const post = document('metodo', { title: { stringValue: 'Arquitetura de software: decisões com evidência' },
        cover: { mapValue: { fields: { src: { stringValue: '/og-image.jpg' }, alt: { stringValue: 'Marcus Boni — engenharia de software' } } } } })
      if (url.endsWith(':runQuery')) return Response.json([{ document: post }])
      if (url.endsWith('/content/main')) return Response.json(bodyFields(markdown))
      return Response.json(post)
    })
    let template = readFileSync(existsSync('dist/index.html') ? 'dist/index.html' : 'index.html', 'utf8')
    if (!template.includes('BODY:START')) template = readFileSync('index.html', 'utf8')
    const dir = 'node_modules/.cache/seo-qa'
    mkdirSync(dir, { recursive: true })
    for (const [name, path] of [['article', '/blog/metodo'], ['blog', '/blog']]) {
      const response = await handler(request(path), context(template))
      expect(response.status).toBe(200)
      const html = (await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '')
      writeFileSync(`${dir}/${name}.html`, html)
    }
  })
})

describe('publication feeds', () => {
  it('uses genuine dates, escapes XML and never fabricates dates for static pages', async () => {
    const xml = await (await feeds(request('/sitemap.xml'), context())).text()
    expect(xml).toContain('<lastmod>2026-09-02</lastmod>')
    const home = xml.match(/<url>\s*<loc>https:\/\/marcusboni.com.br\/<\/loc>(.*?)<\/url>/s)![1]
    expect(home).not.toContain('<lastmod>')
    const rss = await (await feeds(request('/rss.xml'), context())).text()
    expect(rss).toContain('Engenharia &lt;segura&gt; &amp; clara')
    expect(rss).toContain('<pubDate>Tue, 01 Sep 2026 12:00:00 GMT</pubDate>')
  })

  it('distinguishes a confirmed empty collection from an upstream error', async () => {
    fetchMock.mockImplementation(async () => Response.json([{ readTime: 'now' }]))
    const empty = await feeds(request('/sitemap.xml'), context())
    expect(empty.status).toBe(200)
    expect(await empty.text()).toContain('https://marcusboni.com.br/blog')
    fetchMock.mockImplementation(async () => new Response('{}', { status: 500 }))
    const outage = await feeds(request('/rss.xml'), context())
    expect(outage.status).toBe(503)
    expect(outage.headers.get('Retry-After')).toBe('300')
    fetchMock.mockImplementation(async () => Response.json([{ error: { code: 14, message: 'Unavailable' } }]))
    expect((await feeds(request('/sitemap.xml'), context())).status).toBe(503)
  })

  it('paginates beyond the old 200 cap using a stable exclusive cursor', async () => {
    fetchMock.mockImplementation(async (_input: unknown, init: RequestInit) => {
      const query = JSON.parse(String(init.body)).structuredQuery
      const offset = query.startAt ? 1000 : 0
      expect(query.limit).toBe(1000)
      expect(query.orderBy[0].field.fieldPath).toBe('__name__')
      if (offset) expect(query.startAt).toEqual({ before: false, values: [{ referenceValue: 'projects/demo/databases/(default)/documents/posts/post-0999' }] })
      return Response.json(Array.from({ length: offset ? 1 : 1000 }, (_, i) => ({ document: document(`post-${String(offset + i).padStart(4, '0')}`) })))
    })
    const xml = await (await feeds(request('/sitemap.xml'), context())).text()
    expect(xml).toContain('/blog/post-1000')
    expect((xml.match(/<loc>/g) ?? []).length).toBe(1007)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('omits non-reciprocal translation hints and invalid dates', async () => {
    fetchMock.mockImplementation(async () => Response.json([{ document: document('metodo', {
      translationOf: { stringValue: 'missing' }, publishedAt: { stringValue: 'invalid' }, updatedAt: { stringValue: 'invalid' },
    }) }]))
    const xml = await (await feeds(request('/sitemap.xml'), context())).text()
    expect(xml).not.toContain('hreflang=')
    expect(xml).not.toContain('<lastmod>')
    const rss = await (await feeds(request('/rss.xml'), context())).text()
    expect(rss).not.toContain('<pubDate>')
    expect(rss).not.toContain('<lastBuildDate>')
  })
})
