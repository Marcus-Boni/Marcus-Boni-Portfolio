import { describe, expect, it } from 'vitest'

import {
  methodNotAllowed,
  notAcceptable,
  notFound,
  postNotFound,
  problem,
  problemResponse,
  upstreamUnavailable,
  type ProblemCode,
} from '../netlify/lib/problem.ts'

/**
 * RFC 9457 conformance for the API's error documents.
 *
 * The readiness check asks for "error codes, messages, and resolution hints".
 * The first is a contract — a caller branches on `code`, so renaming one is a
 * breaking change — and the third is the part that is easy to write badly: a
 * hint that restates the error instead of naming the next request to make is
 * no better than no hint.
 */

const builders = [
  ['notFound', notFound('/api/v1/nope'), 'not_found', 404],
  ['postNotFound', postNotFound('ghost', '/api/v1/posts/ghost'), 'not_found', 404],
  ['methodNotAllowed', methodNotAllowed('POST', '/api/v1/profile'), 'method_not_allowed', 405],
  ['notAcceptable', notAcceptable('text/csv', '/api/v1/profile'), 'not_acceptable', 406],
  ['upstreamUnavailable', upstreamUnavailable('/api/v1/posts'), 'upstream_unavailable', 503],
] as const

describe('problem documents', () => {
  it.each(builders)('%s carries every required member', (_name, document, code, status) => {
    expect(document.code).toBe(code)
    expect(document.status).toBe(status)
    expect(document.title.length).toBeGreaterThan(0)
    expect(document.detail.length).toBeGreaterThan(20)
    expect(document.instance.startsWith('/')).toBe(true)
  })

  it.each(builders)('%s resolves its type URI to an explanation', (_name, document) => {
    // `about:blank` is legal and useless. These point at the error's row in the
    // developer portal, which has a matching `id`.
    expect(document.type).toMatch(
      /^https:\/\/marcusboni\.com\.br\/developers#error-[a-z-]+$/,
    )
  })

  it.each(builders)('%s hints at a next request, not a restatement', (_name, document) => {
    expect(document.hint.length).toBeGreaterThan(20)
    expect(document.hint).not.toBe(document.detail)
    // Every hint names something concrete to do: a URL, a method, or a retry.
    expect(document.hint).toMatch(/GET|Retry|Accept:|https:\/\//)
  })

  it('echoes the offending value so the caller can see what was rejected', () => {
    expect(postNotFound('ghost', '/x').detail).toContain('ghost')
    expect(methodNotAllowed('DELETE', '/x').detail).toContain('DELETE')
    expect(notAcceptable('text/csv', '/x').detail).toContain('text/csv')
  })

  it('keeps the code enum closed', () => {
    // Adding a member is a contract change; this is the list the OpenAPI
    // `Problem.code` enum and the developer portal both publish.
    const codes: ProblemCode[] = [
      'not_found',
      'method_not_allowed',
      'not_acceptable',
      'upstream_unavailable',
    ]
    for (const code of codes) {
      expect(problem(code, 'detail text here', '/x', 'hint text here').code).toBe(code)
    }
  })
})

describe('problemResponse', () => {
  it('uses the RFC media type and never caches', () => {
    const response = problemResponse(notFound('/api/v1/nope'))
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json; charset=utf-8',
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('vary')).toBe('Accept, Accept-Encoding')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('serialises the document as JSON', async () => {
    const response = problemResponse(methodNotAllowed('PUT', '/api/v1/stack'))
    const body = (await response.json()) as Record<string, unknown>
    expect(body.status).toBe(405)
    expect(body.code).toBe('method_not_allowed')
  })

  it('omits the body for HEAD but keeps the headers', async () => {
    const response = problemResponse(notFound('/api/v1/nope'), true)
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe(
      'application/problem+json; charset=utf-8',
    )
    expect(await response.text()).toBe('')
  })
})
