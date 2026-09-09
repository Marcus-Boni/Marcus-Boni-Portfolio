import type { Config, Context } from '@netlify/edge-functions'

import { negotiate } from '../lib/accept.ts'
import { deprecationHeaders } from '../lib/deprecation.ts'
import { resolveMedia } from '../lib/agent-docs.ts'
import {
  getPostBody,
  isConfigured,
  listPublished,
  lookupPost,
  type EdgePost,
} from '../lib/firestore.ts'
import {
  methodNotAllowed,
  notAcceptable,
  notFound,
  postNotFound,
  problemResponse,
  upstreamUnavailable,
} from '../lib/problem.ts'

/**
 * The public content API under `/api/`.
 *
 * Two jobs, and the second is the reason this function exists at all:
 *
 *  1. Serve the blog endpoints. Posts live in Firestore and change without a
 *     rebuild, so they cannot be static files like the rest of the API.
 *  2. Own every error under `/api/`. The static payloads are plain files, and
 *     an unmatched one would otherwise fall through to `public/404.html` — an
 *     HTML error page, which is precisely what a JSON client cannot parse.
 *
 * Everything else under `/api/` is a static file emitted from
 * `src/data/api.ts`; this function passes those through untouched. Same lesson
 * as `agents.ts`: ask the origin what exists rather than keeping a second
 * catalogue that can drift.
 */

const SITE_URL = 'https://marcusboni.com.br'
const JSON_TYPE = 'application/json; charset=utf-8'
const POSTS = '/api/v1/posts'

export default async function handler(request: Request, context: Context) {
  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/'
  const response = await route(request, context, path)

  // Applied once, to whatever the route produced, so a deprecated path
  // announces itself on its errors as much as on its successes — including the
  // static payloads, which this function only passes through.
  const headers = deprecationHeaders(path)
  if (Object.keys(headers).length === 0) return response
  return withHeaders(response, headers)
}

async function route(
  request: Request,
  context: Context,
  path: string,
): Promise<Response> {
  const isHead = request.method === 'HEAD'

  // Read-only by design. Saying so with 405 beats letting a POST fall through
  // to a 404, which would read as "wrong URL" rather than "wrong idea".
  if (request.method !== 'GET' && !isHead) {
    return problemResponse(methodNotAllowed(request.method, path), false)
  }

  const accept = request.headers.get('accept')
  if (negotiate(accept, ['application/json']) === null) {
    return problemResponse(notAcceptable(accept ?? '', path), isHead)
  }

  if (path === POSTS) return await listPostsResponse(path, isHead)
  if (path.startsWith(`${POSTS}/`)) {
    return await postResponse(path.slice(POSTS.length + 1), path, isHead)
  }

  // A static payload, or nothing. The CDN knows which.
  const response = await context.next()
  if (response.status !== 404) return withVary(response)
  return problemResponse(notFound(path), isHead)
}

/* ─── Blog endpoints ────────────────────────────────────────────────────── */

/** `EdgePost` in the shape the OpenAPI `PostSummary` schema describes. */
function summary(post: EdgePost): Record<string, unknown> {
  return {
    slug: post.slug,
    url: `${SITE_URL}/blog/${post.slug}`,
    title: post.title,
    subtitle: post.subtitle || undefined,
    excerpt: post.excerpt || undefined,
    language: post.lang === 'pt' ? 'pt-BR' : 'en',
    tags: post.tags,
    readingMinutes: post.readingMinutes,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    translationOf: post.translationOf,
    coverUrl: post.coverUrl,
  }
}

async function listPostsResponse(path: string, isHead: boolean): Promise<Response> {
  if (!isConfigured) return problemResponse(upstreamUnavailable(path), isHead)
  const posts = await listPublished()
  return json({ count: posts.length, items: posts.map(summary) }, isHead)
}

async function postResponse(
  rawSlug: string,
  path: string,
  isHead: boolean,
): Promise<Response> {
  // A nested path is not a slug — `/api/v1/posts/a/b` has no meaning here.
  if (!rawSlug || rawSlug.includes('/')) {
    return problemResponse(notFound(path), isHead)
  }
  const slug = decodeURIComponent(rawSlug)

  const lookup = await lookupPost(slug)
  // "Cannot tell" is not "does not exist". A database blip answering 404 would
  // tell a crawler the post is gone.
  if (lookup.state === 'unavailable') {
    return problemResponse(upstreamUnavailable(path), isHead)
  }
  if (lookup.state === 'missing') {
    return problemResponse(postNotFound(slug, path), isHead)
  }

  const content = await getPostBody(slug)
  if (!content) return problemResponse(upstreamUnavailable(path), isHead)

  return json(
    {
      ...summary(lookup.post),
      // `media:{id}` means nothing outside the React renderer; an API client
      // needs URLs it can fetch.
      body: resolveMedia(content.body, content.media),
    },
    isHead,
  )
}

/* ─── Responses ─────────────────────────────────────────────────────────── */

function json(payload: unknown, isHead: boolean): Response {
  const body = `${JSON.stringify(payload, null, 2)}\n`
  return new Response(isHead ? null : body, {
    status: 200,
    headers: {
      'content-type': JSON_TYPE,
      // Short: the blog changes on publish, not on deploy.
      'cache-control': 'public, max-age=300, stale-while-revalidate=86400',
      vary: 'Accept, Accept-Encoding',
      'x-content-type-options': 'nosniff',
    },
  })
}

function withVary(response: Response): Response {
  return withHeaders(response, { Vary: 'Accept, Accept-Encoding' })
}

function withHeaders(response: Response, extra: Record<string, string>): Response {
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(extra)) headers.set(name, value)
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const config: Config = {
  path: '/api/*',
  // No `method` filter: the 405 above is more useful than a silent pass-through,
  // and Netlify's HTTPMethod union has no HEAD to list anyway.
  //
  // `onError: 'bypass'` is deliberately NOT set. If this function fails, the
  // fallback is `public/404.html` — an HTML page — and handing that to a JSON
  // client is the exact failure this endpoint exists to prevent.
}
