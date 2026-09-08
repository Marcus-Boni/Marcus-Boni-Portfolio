import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Integration tests for `netlify/edge-functions/agents.ts`.
 *
 * The handler is a plain `(Request, { next }) => Response`, so it runs under
 * Node with two stubs: a `Deno.env` shim (read at module load by
 * `firestore.ts`) and, for the blog cases, a `fetch` standing in for the
 * Firestore REST API. That buys real assertions on status codes, content types
 * and `Vary` — the three things the readiness checks actually probe — without
 * waiting for a deploy.
 *
 * `import()` is dynamic and `vi.resetModules()` runs between the two suites
 * because the project id is captured at module scope: the unconfigured and
 * configured cases need two separate module instances.
 */

type Handler = (
  request: Request,
  context: { next: () => Promise<Response> },
) => Promise<Response>

/** The static HTML `context.next()` would resolve to, mimicking Netlify's CDN. */
function shell(status = 200): Response {
  return new Response('<!doctype html><html><body>app shell</body></html>', {
    status,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      vary: 'Accept-Encoding',
    },
  })
}

function ctx(response: Response = shell()) {
  return { next: async () => response }
}

function get(url: string, accept?: string, method = 'GET'): Request {
  return new Request(url, { method, headers: accept ? { accept } : {} })
}

async function load(projectId?: string): Promise<Handler> {
  vi.stubGlobal('Deno', { env: { get: () => projectId } })
  const module = await import('../netlify/edge-functions/agents.ts')
  return module.default as unknown as Handler
}

/* ─── Without Firestore ─────────────────────────────────────────────────── */

describe('agents — static routes (no Firestore configured)', () => {
  let handler: Handler

  beforeAll(async () => {
    vi.resetModules()
    handler = await load(undefined)
  })

  it('serves Markdown for the home page under Accept: text/markdown', async () => {
    const response = await handler(get('https://x/', 'text/markdown'), ctx())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding')
    expect(await response.text()).toContain('# Marcus Boni — Software Engineer')
  })

  it('serves HTML by default, and declares that the URL varies by Accept', async () => {
    const response = await handler(get('https://x/'), ctx())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=UTF-8')
    // The whole point of `Vary`: without it a CDN hands whichever variant
    // landed first to everyone.
    expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding')
    expect(await response.text()).toContain('app shell')
  })

  it('serves HTML to a browser Accept header', async () => {
    const chrome =
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    const response = await handler(get('https://x/', chrome), ctx())
    expect(response.headers.get('content-type')).toBe('text/html; charset=UTF-8')
  })

  it('serves HTML to a bare */* — the acceptmarkdown q-value rule', async () => {
    const response = await handler(get('https://x/', '*/*'), ctx())
    expect(response.headers.get('content-type')).toBe('text/html; charset=UTF-8')
  })

  it('serves HTML when Markdown is explicitly refused with q=0', async () => {
    const response = await handler(get('https://x/', 'text/markdown;q=0, text/html'), ctx())
    expect(response.headers.get('content-type')).toBe('text/html; charset=UTF-8')
  })

  it('honours q-values in favour of Markdown', async () => {
    const response = await handler(
      get('https://x/', 'text/markdown;q=0.9, text/html;q=0.8'),
      ctx(),
    )
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
  })

  it('answers HEAD with the same headers and no body', async () => {
    // `curl -sI -H 'Accept: text/markdown'` is the command acceptmarkdown.com
    // tells implementers to verify with, so HEAD has to be right.
    const response = await handler(get('https://x/', 'text/markdown', 'HEAD'), ctx())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding')
    expect(await response.text()).toBe('')
  })

  it('returns 406 when neither representation is acceptable', async () => {
    const response = await handler(get('https://x/', 'application/pdf'), ctx())
    expect(response.status).toBe(406)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding')
    expect(response.headers.get('cache-control')).toBe('no-store')
    const body = await response.text()
    expect(body).toContain('- text/html')
    expect(body).toContain('- text/markdown')
  })

  it('serves the developer portal as Markdown', async () => {
    const response = await handler(get('https://x/developers', 'text/markdown'), ctx())
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('# Developers')
  })

  it('serves the blog index as Markdown even with no database', async () => {
    const response = await handler(get('https://x/blog', 'text/markdown'), ctx())
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('No posts published yet.')
  })

  it('falls back to HTML for a post it cannot read', async () => {
    // Firestore unreachable is not "no such post" — answering 404 here would
    // tell a crawler the whole blog is gone during an outage.
    const response = await handler(get('https://x/blog/anything', 'text/markdown'), ctx())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=UTF-8')
  })
})

describe('agents — unknown paths', () => {
  let handler: Handler

  beforeAll(async () => {
    vi.resetModules()
    handler = await load(undefined)
  })

  it('returns a 404 with a Markdown body for an agent', async () => {
    const response = await handler(
      get('https://x/some-path-that-does-not-exist', 'text/markdown'),
      ctx(shell(404)),
    )
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    const body = await response.text()
    expect(body).toContain('# 404')
    expect(body).toContain('/some-path-that-does-not-exist')
    expect(body).toContain('/sitemap.xml')
    expect(body).toContain('/llms.txt')
  })

  it('returns the Markdown diagnostic to a client that named no type', async () => {
    // `curl` sends `*/*`. On a real page that means "serve the default"; on a
    // 404 diagnostic there is no resource to represent, and a programmatic
    // client is better served the pointer list. See `acceptsHtmlExplicitly`.
    const response = await handler(get('https://x/api/v1/posts', '*/*'), ctx(shell(404)))
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
  })

  it('hands a browser the styled 404 page instead', async () => {
    const response = await handler(
      get('https://x/api/v1/posts', 'text/html,*/*;q=0.8'),
      ctx(shell(404)),
    )
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('text/html; charset=UTF-8')
    expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding')
  })

  it('never rewrites a 404 into a 200', async () => {
    for (const accept of ['text/markdown', '*/*', 'text/html', undefined]) {
      const response = await handler(get('https://x/nope', accept), ctx(shell(404)))
      expect(response.status, `Accept: ${accept}`).toBe(404)
    }
  })

  it('never 404s a path the origin actually serves', async () => {
    // The regression that shipped: the handler treated "not an app route" as
    // "does not exist", so /llms.txt, /robots.txt and every PDF answered 404 —
    // because `excludedPattern` was silently ignored and the function ran on
    // them after all. Routing config is a performance lever; correctness has to
    // come from asking the origin.
    const file = new Response('# Marcus Boni\n', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=UTF-8', vary: 'Accept-Encoding' },
    })
    const response = await handler(get('https://x/llms.txt', 'text/markdown'), ctx(file))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/plain; charset=UTF-8')
    expect(await response.text()).toBe('# Marcus Boni\n')
  })

  it('never 406s a static file whose type it does not produce', async () => {
    // `/llms.txt` is text/plain. Answering "this resource is available in
    // text/html and text/markdown" was a lie the handler had no business
    // telling — 406 is only honest about representations it produces itself.
    const file = new Response('User-agent: *\n', {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=UTF-8' },
    })
    const response = await handler(get('https://x/robots.txt', 'text/plain'), ctx(file))
    expect(response.status).toBe(200)
  })

  it('passes a hashed asset through untouched', async () => {
    const asset = new Response('console.log(1)', {
      status: 200,
      headers: { 'content-type': 'text/javascript', 'cache-control': 'max-age=31536000' },
    })
    const response = await handler(get('https://x/assets/index-abc123.js'), ctx(asset))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/javascript')
    expect(response.headers.get('cache-control')).toBe('max-age=31536000')
  })

  it('still 406s on a page it does own', async () => {
    // The narrowing above must not disable 406 where it is correct.
    const response = await handler(get('https://x/', 'application/pdf'), ctx())
    expect(response.status).toBe(406)
  })

  it('does not answer for the admin app', async () => {
    // Excluded from this function's routing in production; the switch arm
    // exists so a routing change cannot start serving Markdown for it.
    const response = await handler(get('https://x/admin/blog', 'text/markdown'), ctx())
    expect(response.headers.get('content-type')).toBe('text/html; charset=UTF-8')
  })
})

/* ─── With Firestore ────────────────────────────────────────────────────── */

const POST_FIELDS = {
  lang: { stringValue: 'pt' },
  status: { stringValue: 'published' },
  title: { stringValue: 'Estudo de mercado' },
  subtitle: { stringValue: 'Como olhar para um setor' },
  excerpt: { stringValue: 'Um método para estudar um mercado.' },
  tags: { arrayValue: { values: [{ stringValue: 'produto' }] } },
  readingMinutes: { integerValue: '7' },
  publishedAt: { stringValue: '2026-08-01T12:00:00.000Z' },
  updatedAt: { stringValue: '2026-08-02T12:00:00.000Z' },
}

const BODY_FIELDS = {
  body: { stringValue: '## Método\n\n![Gráfico](media:chart)\n' },
  status: { stringValue: 'published' },
  media: {
    mapValue: {
      fields: {
        chart: {
          mapValue: {
            fields: {
              src: { stringValue: 'https://cdn.example/chart-1600.webp' },
              alt: { stringValue: 'Gráfico de participação' },
            },
          },
        },
      },
    },
  },
}

function firestore(): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)

    if (url.endsWith(':runQuery')) {
      return Response.json([
        { document: { name: 'projects/p/…/posts/estudo-de-mercado', fields: POST_FIELDS } },
      ])
    }
    if (url.endsWith('/posts/estudo-de-mercado')) {
      return Response.json({ name: 'projects/p/…/posts/estudo-de-mercado', fields: POST_FIELDS })
    }
    if (url.endsWith('/posts/estudo-de-mercado/content/main')) {
      return Response.json({ fields: BODY_FIELDS })
    }
    if (url.endsWith('/posts/rascunho')) {
      // What the security rules return for a draft: not readable, which is the
      // right answer for a crawler.
      return new Response('{}', { status: 403 })
    }
    if (url.includes('/posts/')) {
      return new Response('{}', { status: 404 })
    }
    return new Response('{}', { status: 500 })
  }) as unknown as typeof fetch
}

describe('agents — blog routes with Firestore', () => {
  let handler: Handler

  beforeAll(async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', firestore())
    handler = await load('demo-project')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("serves the post's own Markdown source", async () => {
    const response = await handler(
      get('https://x/blog/estudo-de-mercado', 'text/markdown'),
      ctx(),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')

    const body = await response.text()
    expect(body).toContain('title: "Estudo de mercado"')
    expect(body).toContain('url: "https://marcusboni.com.br/blog/estudo-de-mercado"')
    expect(body).toContain('## Método')
    // `media:chart` is meaningless outside the React renderer; an agent needs
    // a URL it can fetch.
    expect(body).toContain('![Gráfico](https://cdn.example/chart-1600.webp)')
    expect(body).not.toContain('media:chart')
  })

  it('lists published posts in the Markdown blog index', async () => {
    const response = await handler(get('https://x/blog', 'text/markdown'), ctx())
    const body = await response.text()
    expect(body).toContain('[Estudo de mercado](https://marcusboni.com.br/blog/estudo-de-mercado)')
    expect(body).toContain('7 min read')
  })

  it('404s a slug that does not exist', async () => {
    const response = await handler(get('https://x/blog/fantasma', 'text/markdown'), ctx())
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('text/markdown; charset=utf-8')
    expect(await response.text()).toContain('/blog/fantasma')
  })

  it('404s a draft, which the rules refuse to hand over', async () => {
    const response = await handler(get('https://x/blog/rascunho', 'text/markdown'), ctx())
    expect(response.status).toBe(404)
  })
})
