/**
 * RFC 9457 `application/problem+json` error responses.
 *
 * "Agents can't parse HTML error pages" is the whole reason this exists: an
 * error under `/api/` has to be as machine-readable as a success. Rather than
 * inventing a shape, this uses the published one — `type`, `title`, `status`,
 * `detail`, `instance` — extended with the two members the readiness model
 * asks for by name: a stable `code` and a `hint` naming the next thing to try.
 *
 * Extension members are exactly what RFC 9457 §3.2 allows, so the document
 * stays conformant while carrying what a caller actually needs.
 *
 * Pure module: no Deno globals, no fetch. `tests/problem.test.ts` covers it.
 */

const SITE_URL = 'https://marcusboni.com.br'

/** Stable error codes. Adding one is a contract change; renaming one breaks callers. */
export type ProblemCode =
  | 'not_found'
  | 'method_not_allowed'
  | 'not_acceptable'
  | 'upstream_unavailable'

export interface Problem {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  code: ProblemCode
  hint: string
}

export const PROBLEM_TYPE = 'application/problem+json; charset=utf-8'

interface Definition {
  status: number
  title: string
}

const DEFINITIONS: Record<ProblemCode, Definition> = {
  not_found: { status: 404, title: 'Not found' },
  method_not_allowed: { status: 405, title: 'Method not allowed' },
  not_acceptable: { status: 406, title: 'Not acceptable' },
  upstream_unavailable: { status: 503, title: 'Upstream unavailable' },
}

/**
 * Builds the problem document.
 *
 * `type` points at the developer portal's anchor for the code rather than a
 * bare `about:blank`: a URI that resolves to an explanation is worth more to
 * whoever is debugging than one that does not.
 */
export function problem(
  code: ProblemCode,
  detail: string,
  instance: string,
  hint: string,
): Problem {
  const { status, title } = DEFINITIONS[code]
  return {
    type: `${SITE_URL}/developers#error-${code.replace(/_/g, '-')}`,
    title,
    status,
    detail,
    instance,
    code,
    hint,
  }
}

/** The problem document as a `Response`, with the headers the RFC requires. */
export function problemResponse(document: Problem, isHead = false): Response {
  const body = `${JSON.stringify(document, null, 2)}\n`
  return new Response(isHead ? null : body, {
    status: document.status,
    headers: {
      'content-type': PROBLEM_TYPE,
      // Errors are per-request; caching one would hand it to the next caller.
      'cache-control': 'no-store',
      // Both are negotiated from the same paths as the success responses.
      vary: 'Accept, Accept-Encoding',
      'x-content-type-options': 'nosniff',
    },
  })
}

/* ─── The four errors this API can produce ──────────────────────────────── */

export function notFound(instance: string): Problem {
  return problem(
    'not_found',
    `No API resource exists at ${instance}.`,
    instance,
    `GET ${SITE_URL}/openapi.json for the operations this API exposes, or ${SITE_URL}/api/v1 for a short index.`,
  )
}

export function postNotFound(slug: string, instance: string): Problem {
  return problem(
    'not_found',
    `No published post has the slug "${slug}". Drafts are not readable.`,
    instance,
    `GET ${SITE_URL}/api/v1/posts to list every published post and its slug.`,
  )
}

export function methodNotAllowed(method: string, instance: string): Problem {
  return problem(
    'method_not_allowed',
    `${method} is not supported. This API is read-only.`,
    instance,
    'Use GET, or HEAD when only the headers are needed. There are no write operations.',
  )
}

export function notAcceptable(accept: string, instance: string): Problem {
  return problem(
    'not_acceptable',
    `This API only produces application/json. The Accept header "${accept}" rules it out.`,
    instance,
    'Send Accept: application/json, or omit the header. HTML and Markdown are available from the page URLs instead.',
  )
}

export function upstreamUnavailable(instance: string): Problem {
  return problem(
    'upstream_unavailable',
    'The content database could not be reached, so this response cannot be produced right now.',
    instance,
    'Retry in a few seconds. The failure is transient and the request is unchanged.',
  )
}
