import { beforeAll, describe, expect, it, vi } from 'vitest'

/**
 * Integration tests for `netlify/edge-functions/api.ts`.
 *
 * Same harness as `agents-function.test.ts`: a `Deno.env` shim and a stubbed
 * `fetch` standing in for the Firestore REST API, so the handler's real status
 * codes, content types and error bodies can be asserted without a deploy.
 *
 * The thing being protected is narrow and easy to lose: every failure path
 * under `/api/` has to answer `application/problem+json`. One route falling
 * through to the HTML 404 page defeats the endpoint.
 */

type Handler = (
  request: Request,
  context: { next: () => Promise<Response> },
) => Promise<Response>

/** What the CDN would return for a static payload that exists. */
function staticJson(): Response {
  return new Response('{"count":0,"items":[]}\n', {
    status: 200,
    headers: { 'content-type': 'application/json', vary: 'Accept-Encoding' },
  })
}

/** What the CDN returns when nothing matches: the HTML 404 page. */
function htmlNotFound(): Response {
  return new Response('<!doctype html><html><body>404</body></html>', {
    status: 404,
    headers: { 'content-type': 'text/html; charset=UTF-8' },
  })
}

function ctx(response: Response = staticJson()) {
  return { next: async () => response }
}

function get(url: string, accept?: string, method = 'GET'): Request {
  return new Request(url, { method, headers: accept ? { accept } : {} })
}

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
            fields: { src: { stringValue: 'https://cdn.example/chart.webp' } },
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
      return Response.json([{ document: { name: 'p/posts/estudo', fields: POST_FIELDS } }])
    }
    if (url.endsWith('/posts/estudo')) {
      return Response.json({ name: 'p/posts/estudo', fields: POST_FIELDS })
    }
    if (url.endsWith('/posts/estudo/content/main')) {
      return Response.json({ fields: BODY_FIELDS })
    }
    if (url.endsWith('/posts/quebrado')) {
      return new Response('{}', { status: 500 })
    }
    if (url.includes('/posts/')) return new Response('{}', { status: 404 })
    return new Response('{}', { status: 500 })
  }) as unknown as typeof fetch
}

async function load(projectId?: string): Promise<Handler> {
  vi.stubGlobal('Deno', { env: { get: () => projectId } })
  const module = await import('../netlify/edge-functions/api.ts')
  return module.default as unknown as Handler
}

async function problemBody(response: Response) {
  return (await response.json()) as Record<string, unknown>
}

/* ─── Errors ────────────────────────────────────────────────────────────── */

describe('api — errors are always problem+json', () => {
  let handler: Handler

  beforeAll(async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', firestore())
    handler = await load('demo-project')
  })

  it('turns an unmatched /api path into a problem document, not the HTML 404', async () => {
    const response = await handler(get('https://x/api/v1/nope'), ctx(htmlNotFound()))
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json; charset=utf-8',
    )

    const body = await problemBody(response)
    expect(body.code).toBe('not_found')
    expect(body.status).toBe(404)
    expect(body.instance).toBe('/api/v1/nope')
    expect(String(body.hint)).toContain('/openapi.json')
    expect(String(body.type)).toMatch(/^https:\/\//)
  })

  it('rejects a write with 405 rather than a confusing 404', async () => {
    const response = await handler(
      get('https://x/api/v1/profile', undefined, 'POST'),
      ctx(),
    )
    expect(response.status).toBe(405)
    const body = await problemBody(response)
    expect(body.code).toBe('method_not_allowed')
    expect(String(body.detail)).toContain('POST')
    expect(String(body.detail)).toContain('read-only')
    expect(String(body.hint)).toContain('GET')
  })

  it('406s when the Accept header rules JSON out', async () => {
    const response = await handler(get('https://x/api/v1/profile', 'text/html'), ctx())
    expect(response.status).toBe(406)
    expect((await problemBody(response)).code).toBe('not_acceptable')
  })

  it('serves a browser, whose Accept ends in a wildcard', async () => {
    // `text/html,...,*/*;q=0.8` must not 406 — the wildcard accepts JSON.
    const response = await handler(
      get('https://x/api/v1/profile', 'text/html,application/xhtml+xml,*/*;q=0.8'),
      ctx(),
    )
    expect(response.status).toBe(200)
  })

  it('never caches an error', async () => {
    const response = await handler(get('https://x/api/v1/nope'), ctx(htmlNotFound()))
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('reports a database failure as 503, not as a missing post', async () => {
    // Answering 404 during an outage would tell a crawler the post is gone.
    const response = await handler(get('https://x/api/v1/posts/quebrado'), ctx())
    expect(response.status).toBe(503)
    const body = await problemBody(response)
    expect(body.code).toBe('upstream_unavailable')
    expect(String(body.hint)).toContain('Retry')
  })

  it('404s a slug that does not exist, and says how to list the real ones', async () => {
    const response = await handler(get('https://x/api/v1/posts/fantasma'), ctx())
    expect(response.status).toBe(404)
    const body = await problemBody(response)
    expect(body.code).toBe('not_found')
    expect(String(body.detail)).toContain('fantasma')
    expect(String(body.hint)).toContain('/api/v1/posts')
  })

  it('404s a nested path under posts', async () => {
    const response = await handler(get('https://x/api/v1/posts/a/b'), ctx())
    expect(response.status).toBe(404)
  })
})

/* ─── Success ───────────────────────────────────────────────────────────── */

describe('api — blog endpoints', () => {
  let handler: Handler

  beforeAll(async () => {
    vi.resetModules()
    vi.stubGlobal('fetch', firestore())
    handler = await load('demo-project')
  })

  it('lists posts with a count', async () => {
    const response = await handler(get('https://x/api/v1/posts'), ctx())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')

    const body = (await response.json()) as { count: number; items: Record<string, unknown>[] }
    expect(body.count).toBe(1)
    expect(body.items[0].slug).toBe('estudo')
    expect(body.items[0].url).toBe('https://marcusboni.com.br/blog/estudo')
    expect(body.items[0].language).toBe('pt-BR')
    expect(body.items[0]).not.toHaveProperty('body')
  })

  it('returns one post with its Markdown body and resolved images', async () => {
    const response = await handler(get('https://x/api/v1/posts/estudo'), ctx())
    expect(response.status).toBe(200)

    const body = (await response.json()) as { body: string; title: string }
    expect(body.title).toBe('Estudo de mercado')
    expect(body.body).toContain('## Método')
    expect(body.body).toContain('![Gráfico](https://cdn.example/chart.webp)')
    expect(body.body).not.toContain('media:chart')
  })

  it('answers HEAD with headers and no body', async () => {
    const response = await handler(get('https://x/api/v1/posts', undefined, 'HEAD'), ctx())
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(await response.text()).toBe('')
  })

  it('passes a static payload through untouched', async () => {
    // /api/v1/profile is a file on the CDN; this function must not shadow it.
    const response = await handler(get('https://x/api/v1/profile'), ctx())
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"count":0,"items":[]}\n')
  })

  it('declares Vary: Accept on the pass-through too', async () => {
    const response = await handler(get('https://x/api/v1/profile'), ctx())
    expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding')
  })
})

describe('api — without a database', () => {
  let handler: Handler

  beforeAll(async () => {
    vi.resetModules()
    handler = await load(undefined)
  })

  it('503s the blog endpoints rather than claiming there are no posts', async () => {
    // An empty list would be a factual claim this function cannot support.
    const response = await handler(get('https://x/api/v1/posts'), ctx())
    expect(response.status).toBe(503)
    expect((await problemBody(response)).code).toBe('upstream_unavailable')
  })
})
