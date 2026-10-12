import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (request: Request) => Promise<Response>

const ENV = {
  AGENT_PUBLISH_TOKEN: 'agent-secret',
  FIREBASE_PROJECT_ID: 'demo-project',
  FIREBASE_SERVICE_ACCOUNT_EMAIL: 'agent-publisher@demo-project.iam.gserviceaccount.com',
  FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: '',
}

let env: Record<string, string> = { ...ENV }

function req(method: string, body: unknown, token = ENV.AGENT_PUBLISH_TOKEN): Request {
  return new Request('https://x/agent/v1/posts', {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-agent-name': 'docs-agent',
    },
    body: JSON.stringify(body),
  })
}

const payload = {
  requestId: 'api-explainer-2026-09-28',
  post: {
    slug: 'explicando-apis',
    lang: 'pt',
    title: 'Explicando APIs',
    subtitle: 'Uma introducao pratica',
    body: '## O que e uma API?\n\nUma API e um contrato entre sistemas.',
    tags: ['apis', 'arquitetura'],
  },
}

const validMedia = {
  src: 'https://cdn.example/cover.webp',
  variants: [{ width: 960, url: 'https://cdn.example/cover-960.webp' }],
  lqip: 'data:image/webp;base64,abc',
  width: 960,
  height: 540,
  alt: 'Diagrama de API',
  caption: 'Camadas de uma API',
  storagePath: 'blog/explicando-apis/cover',
}

async function load(): Promise<Handler> {
  vi.resetModules()
  env = { ...ENV, FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: await testPrivateKey() }
  vi.stubGlobal('Deno', {
    env: { get: (key: string) => env[key] },
  })
  const module = await import('../netlify/edge-functions/agent-publish.ts')
  return module.default as Handler
}

function firestore(existing = false, commitStatus = 200): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'test-access-token', expires_in: 3600 })
    }
    if (url.endsWith('/posts/explicando-apis') && init?.method !== 'POST') {
      if (!existing) return new Response('{}', { status: 404 })
      return Response.json({
        updateTime: '2026-09-01T10:00:00.000001Z',
        fields: existingMetaFields(),
      })
    }
    if (url.endsWith('/posts/explicando-apis/content/main')) {
      return Response.json({
        updateTime: '2026-09-01T10:00:00.000002Z',
        fields: existingBodyFields(),
      })
    }
    if (url.endsWith(':commit')) {
      if (commitStatus !== 200) return new Response('{}', { status: commitStatus })
      return Response.json({ writeResults: [{ updateTime: 'meta' }, { updateTime: 'body' }] })
    }
    return new Response('{}', { status: 500 })
  }) as unknown as typeof fetch
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

let privateKeyPem: string | null = null

async function testPrivateKey(): Promise<string> {
  if (privateKeyPem) return privateKeyPem
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const exported = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  const body = base64(new Uint8Array(exported)).match(/.{1,64}/g)?.join('\n') ?? ''
  privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`
  return privateKeyPem
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function existingMetaFields() {
  return {
    slug: { stringValue: 'explicando-apis' },
    lang: { stringValue: 'en' },
    status: { stringValue: 'published' },
    title: { stringValue: 'Old API title' },
    subtitle: { stringValue: 'Existing subtitle' },
    excerpt: { stringValue: 'Existing excerpt' },
    tags: {
      arrayValue: { values: [{ stringValue: 'produto' }, { stringValue: 'apis' }] },
    },
    cover: {
      mapValue: {
        fields: {
          src: { stringValue: 'https://cdn.example/cover.webp' },
          alt: { stringValue: 'Existing cover' },
        },
      },
    },
    series: {
      mapValue: {
        fields: {
          id: { stringValue: 'guides' },
          title: { stringValue: 'Guides' },
          order: { integerValue: '2' },
        },
      },
    },
    readingMinutes: { integerValue: '3' },
    publishedAt: { stringValue: '2026-09-01T10:00:00.000Z' },
    updatedAt: { stringValue: '2026-09-01T10:00:00.000Z' },
    translationOf: { stringValue: 'explaining-apis' },
    featured: { booleanValue: true },
  }
}

function existingBodyFields() {
  return {
    body: { stringValue: '## Existing body\n\nOriginal Markdown.' },
    status: { stringValue: 'published' },
    media: {
      mapValue: {
        fields: {
          diagram: {
            mapValue: {
              fields: {
                src: { stringValue: 'https://cdn.example/diagram.webp' },
                alt: { stringValue: 'Existing diagram' },
              },
            },
          },
        },
      },
    },
  }
}

describe('agent publishing endpoint', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects requests without the agent bearer token', async () => {
    vi.stubGlobal('fetch', firestore())
    const handler = await load()

    const response = await handler(req('POST', payload, 'wrong-token'))

    expect(response.status).toBe(401)
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json; charset=utf-8',
    )
    expect((await json(response)).code).toBe('unauthorized')
  })

  it('creates a published post and body without touching the public read API', async () => {
    const writes: unknown[] = []
    vi.stubGlobal('fetch', (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'test-access-token', expires_in: 3600 })
      }
      if (url.endsWith('/posts/explicando-apis') && init?.method !== 'POST') {
        return new Response('{}', { status: 404 })
      }
      if (url.endsWith(':commit')) {
        writes.push(JSON.parse(String(init?.body)))
        return Response.json({
          writeResults: [{ updateTime: 'meta' }, { updateTime: 'body' }],
        })
      }
      return new Response('{}', { status: 500 })
    }) as unknown as typeof fetch)
    const handler = await load()

    const response = await handler(req('POST', payload))
    const body = await json(response)

    expect(response.status).toBe(201)
    expect(body).toMatchObject({
      slug: 'explicando-apis',
      status: 'published',
      requestId: 'api-explainer-2026-09-28',
      created: true,
    })
    expect(writes).toHaveLength(1)
    expect(JSON.stringify(writes[0])).toContain('/posts/explicando-apis/content/main')
    expect(JSON.stringify(writes[0])).toContain('"exists":false')
    expect(JSON.stringify(writes[0])).toContain('"agentRequestId"')
  })

  it('accepts validated optional metadata shapes', async () => {
    const writes: unknown[] = []
    vi.stubGlobal('fetch', (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'test-access-token', expires_in: 3600 })
      }
      if (url.endsWith('/posts/explicando-apis') && init?.method !== 'POST') {
        return new Response('{}', { status: 404 })
      }
      if (url.endsWith(':commit')) {
        writes.push(JSON.parse(String(init?.body)))
        return Response.json({
          writeResults: [{ updateTime: 'meta' }, { updateTime: 'body' }],
        })
      }
      return new Response('{}', { status: 500 })
    }) as unknown as typeof fetch)
    const handler = await load()

    const response = await handler(
      req('POST', {
        ...payload,
        post: {
          ...payload.post,
          excerpt: 'Uma explicacao curta.',
          cover: validMedia,
          media: { diagram: validMedia },
          series: { id: 'guias-api', title: 'Guias de API', order: 1 },
          translationOf: 'explaining-apis',
          featured: false,
          publishedAt: '2026-09-28T12:00:00.000Z',
        },
      }),
    )

    expect(response.status).toBe(201)
    const serialized = JSON.stringify(writes[0])
    expect(serialized).toContain('https://cdn.example/cover.webp')
    expect(serialized).toContain('guias-api')
  })

  it.each([
    ['subtitle', 42],
    ['excerpt', { text: 'wrong' }],
    ['excerpt', 'a'.repeat(201)],
    ['translationOf', 'Não é slug'],
    ['publishedAt', 'tomorrow'],
    ['featured', 'yes'],
    ['cover', { src: 'https://cdn.example/cover.webp' }],
    ['media', { bad: { src: 'https://cdn.example/diagram.webp' } }],
    ['series', { id: 'guides', title: 'Guides', order: 'first' }],
  ])('rejects invalid optional field %s', async (field, value) => {
    vi.stubGlobal('fetch', firestore())
    const handler = await load()

    const response = await handler(
      req('POST', {
        ...payload,
        post: { ...payload.post, [field]: value },
      }),
    )

    expect(response.status).toBe(400)
    const body = await json(response)
    expect(body.code).toBe('bad_request')
    expect(String(body.detail)).toContain(`post.${field}`)
  })

  it('does not let POST overwrite an existing slug', async () => {
    vi.stubGlobal('fetch', firestore(true))
    const handler = await load()

    const response = await handler(req('POST', payload))

    expect(response.status).toBe(409)
    expect((await json(response)).code).toBe('conflict')
  })

  it('revises an existing post with PATCH and keeps the original publishedAt', async () => {
    const writes: unknown[] = []
    vi.stubGlobal('fetch', (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'test-access-token', expires_in: 3600 })
      }
      if (url.endsWith('/posts/explicando-apis') && init?.method !== 'POST') {
        return Response.json({
          updateTime: '2026-09-01T10:00:00.000001Z',
          fields: existingMetaFields(),
        })
      }
      if (url.endsWith('/posts/explicando-apis/content/main')) {
        return Response.json({
          updateTime: '2026-09-01T10:00:00.000002Z',
          fields: existingBodyFields(),
        })
      }
      if (url.endsWith(':commit')) {
        writes.push(JSON.parse(String(init?.body)))
        return Response.json({
          writeResults: [{ updateTime: 'meta' }, { updateTime: 'body' }],
        })
      }
      return new Response('{}', { status: 500 })
    }) as unknown as typeof fetch)
    const handler = await load()

    const response = await handler(req('PATCH', payload))
    const body = await json(response)

    expect(response.status).toBe(200)
    expect(body.created).toBe(false)
    expect(body.publishedAt).toBe('2026-09-01T10:00:00.000Z')
    expect(JSON.stringify(writes[0])).toContain('2026-09-01T10:00:00.000001Z')
    expect(JSON.stringify(writes[0])).toContain('2026-09-01T10:00:00.000002Z')
  })

  it('preserves omitted metadata and body fields on partial PATCH', async () => {
    const writes: unknown[] = []
    vi.stubGlobal('fetch', (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'test-access-token', expires_in: 3600 })
      }
      if (url.endsWith('/posts/explicando-apis') && init?.method !== 'POST') {
        return Response.json({
          updateTime: '2026-09-01T10:00:00.000001Z',
          fields: existingMetaFields(),
        })
      }
      if (url.endsWith('/posts/explicando-apis/content/main')) {
        return Response.json({
          updateTime: '2026-09-01T10:00:00.000002Z',
          fields: existingBodyFields(),
        })
      }
      if (url.endsWith(':commit')) {
        writes.push(JSON.parse(String(init?.body)))
        return Response.json({
          writeResults: [{ updateTime: 'meta' }, { updateTime: 'body' }],
        })
      }
      return new Response('{}', { status: 500 })
    }) as unknown as typeof fetch)
    const handler = await load()

    const response = await handler(
      req('PATCH', {
        requestId: 'revise-title',
        post: { slug: 'explicando-apis', title: 'Updated API title' },
      }),
    )

    expect(response.status).toBe(200)
    const serialized = JSON.stringify(writes[0])
    expect(serialized).toContain('Updated API title')
    expect(serialized).toContain('produto')
    expect(serialized).toContain('https://cdn.example/cover.webp')
    expect(serialized).toContain('https://cdn.example/diagram.webp')
    expect(serialized).toContain('## Existing body')
    expect(serialized).toContain('explaining-apis')
  })

  it('rejects PATCH against an owner draft instead of publishing it', async () => {
    vi.stubGlobal('fetch', (async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'test-access-token', expires_in: 3600 })
      }
      if (url.endsWith('/posts/explicando-apis')) {
        return Response.json({
          updateTime: '2026-09-01T10:00:00.000001Z',
          fields: {
            ...existingMetaFields(),
            status: { stringValue: 'draft' },
          },
        })
      }
      if (url.endsWith('/posts/explicando-apis/content/main')) {
        return Response.json({
          updateTime: '2026-09-01T10:00:00.000002Z',
          fields: { ...existingBodyFields(), status: { stringValue: 'draft' } },
        })
      }
      return new Response('{}', { status: 500 })
    }) as unknown as typeof fetch)
    const handler = await load()

    const response = await handler(req('PATCH', payload))

    expect(response.status).toBe(403)
    expect((await json(response)).code).toBe('forbidden')
  })

  it('maps concurrent commit precondition failures to 409', async () => {
    vi.stubGlobal('fetch', firestore(true, 409))
    const handler = await load()

    const response = await handler(req('PATCH', payload))

    expect(response.status).toBe(409)
    expect((await json(response)).code).toBe('conflict')
  })

  it('rejects malformed successful commit responses as unavailable', async () => {
    vi.stubGlobal('fetch', (async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://oauth2.googleapis.com/token') {
        return Response.json({ access_token: 'test-access-token', expires_in: 3600 })
      }
      if (url.endsWith('/posts/explicando-apis')) {
        return new Response('{}', { status: 404 })
      }
      if (url.endsWith(':commit')) return Response.json({ writeResults: [] })
      return new Response('{}', { status: 500 })
    }) as unknown as typeof fetch)
    const handler = await load()

    const response = await handler(req('POST', payload))

    expect(response.status).toBe(503)
    expect((await json(response)).code).toBe('upstream_unavailable')
  })

  it('rejects destructive methods', async () => {
    vi.stubGlobal('fetch', firestore())
    const handler = await load()

    const response = await handler(req('DELETE', payload))

    expect(response.status).toBe(405)
    expect(String((await json(response)).hint)).toContain('DELETE is not available')
  })
})
