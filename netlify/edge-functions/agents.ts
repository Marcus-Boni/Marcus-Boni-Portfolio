import type { Config, Context } from '@netlify/edge-functions'

import {
  acceptsHtmlExplicitly,
  MARKDOWN,
  mergeVary,
  negotiate,
  notAcceptableBody,
} from '../lib/accept.ts'
import {
  blogIndexMarkdown,
  developersMarkdown,
  homeMarkdown,
  notFoundMarkdown,
  postMarkdown,
} from '../lib/agent-docs.ts'
import { getPostBody, isConfigured, listPublished, lookupPost } from '../lib/firestore.ts'
import { blogSlug, matchRoute, type RouteKind } from '../lib/routes.ts'

/**
 * HTTP-level agent readiness: Markdown content negotiation, `Vary: Accept`,
 * 406, and the Markdown half of the 404.
 *
 * Why this sits at the edge rather than in the app: everything here has to be
 * true of the *delivered response*, before any JavaScript runs. An agent that
 * reads `Accept: text/markdown` off a React effect has already been handed the
 * HTML.
 *
 * What it does **not** own: the 404 *status* for unknown paths. That comes from
 * `public/_redirects` listing the real routes and letting everything else fall
 * through to `public/404.html`, which Netlify serves with a genuine 404. Doing
 * it with routing rather than code means it keeps working if this function
 * fails (`onError: 'bypass'`).
 *
 * Declared before `blog-meta` so a Markdown request short-circuits without
 * paying for the per-post `<head>` rewrite. Documents only — see the
 * `excludedPattern` at the bottom.
 */

const MARKDOWN_TYPE = 'text/markdown; charset=utf-8'

interface MarkdownDoc {
  body: string
  status: number
}

export default async function handler(request: Request, context: Context) {
  // Only a retrieval has a representation to negotiate. Nothing on this site
  // accepts a write, but a stray POST should pass through untouched rather
  // than be answered with a document.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return withVary(await context.next())
  }

  const url = new URL(request.url)
  const accept = request.headers.get('accept')
  const kind = matchRoute(url.pathname)

  // ── Pages this function owns a representation of ────────────────────────
  //
  // Only here is negotiation this function's business. `/admin` is excluded
  // deliberately: it is an authenticated app with no document to serve.
  if (kind !== null && kind !== 'admin') {
    const chosen = negotiate(accept)

    // Nothing this site produces is acceptable to the client. Scoped to these
    // routes on purpose — 406 is only honest about a representation we are the
    // ones producing.
    if (chosen === null) {
      return text(notAcceptableBody(accept), 406, request, {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      })
    }

    if (chosen === MARKDOWN) {
      const doc = await buildMarkdown(url, kind)
      // `null` means the route has a Markdown form but cannot produce it right
      // now (a post while Firestore is unreachable). Falling back to HTML beats
      // erroring: it is still a truthful representation of the URL, and a
      // backend blip should not read to a crawler as "this page is gone".
      if (doc) return markdown(doc, request)
    }

    return withVary(await context.next())
  }

  // ── Everything else ─────────────────────────────────────────────────────
  //
  // Static files, `/admin`, and paths that simply do not exist. This function
  // has no catalogue of what is on disk, so it must not guess: `/llms.txt` and
  // `/marcus-boni-cv-pt.pdf` are not app routes either, and answering 404 for
  // them — or 406, because they are neither HTML nor Markdown — is exactly the
  // bug that shipped when this branch assumed `excludedPattern` would keep it
  // away from them. Ask the origin; it knows.
  const response = await context.next()
  if (response.status !== 404) return withVary(response)

  // Only an HTML 404 is this function's to restate. `/api/` answers with RFC
  // 9457 `application/problem+json`, and rewriting that into Markdown would
  // break the contract the API endpoint exists to keep — a JSON client asked
  // for a machine-readable error and would get prose.
  const origin = response.headers.get('content-type') ?? ''
  if (!origin.includes('text/html')) return withVary(response)

  // A genuine 404 page. Restate it as Markdown for a client that never named
  // `text/html` — see `acceptsHtmlExplicitly` for why a 404 diagnostic is
  // treated differently from a page.
  if (negotiate(accept) === MARKDOWN || !acceptsHtmlExplicitly(accept)) {
    return markdown({ body: notFoundMarkdown(url.pathname), status: 404 }, request)
  }

  return withVary(response)
}

/* ─── Markdown routing ──────────────────────────────────────────────────── */

/**
 * The Markdown document for a page, or `null` when the route has a Markdown
 * form but cannot produce it right now.
 *
 * Only reached for routes the caller already matched, so there is no `null`
 * arm here: an unknown path is the CDN's to answer, not this function's.
 */
async function buildMarkdown(
  url: URL,
  kind: Exclude<RouteKind, 'admin'>,
): Promise<MarkdownDoc | null> {
  switch (kind) {
    case 'home':
      return { body: homeMarkdown(), status: 200 }

    case 'developers':
      return { body: developersMarkdown(), status: 200 }

    case 'blog-index':
      // An empty list is a real answer for a blog with no posts yet, and the
      // page's own copy is worth serving either way.
      return {
        body: blogIndexMarkdown(isConfigured ? await listPublished() : []),
        status: 200,
      }

    case 'blog-post':
      return await buildPostMarkdown(url.pathname)
  }
}

async function buildPostMarkdown(pathname: string): Promise<MarkdownDoc | null> {
  const slug = blogSlug(pathname)
  const lookup = await lookupPost(slug)

  // Not "no such post" — "cannot tell right now". Let HTML answer.
  if (lookup.state === 'unavailable') return null
  if (lookup.state === 'missing') {
    return { body: notFoundMarkdown(pathname), status: 404 }
  }

  const content = await getPostBody(slug)
  if (!content) return null

  return {
    body: postMarkdown(lookup.post, content.body, content.media),
    status: 200,
  }
}

/* ─── Responses ─────────────────────────────────────────────────────────── */

/** A Markdown representation, with the cache policy its status deserves. */
function markdown(doc: MarkdownDoc, request: Request): Response {
  return text(doc.body, doc.status, request, {
    'content-type': MARKDOWN_TYPE,
    'cache-control':
      doc.status === 200
        ? 'public, max-age=300, stale-while-revalidate=86400'
        : // A 404 must not stick: the slug may be published a minute from now.
          'public, max-age=0, must-revalidate',
  })
}

function text(
  body: string,
  status: number,
  request: Request,
  headers: Record<string, string>,
): Response {
  return new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers: {
      ...headers,
      // Both representations come from one URL, so every cache in the path has
      // to key on the request header. Without this, whichever variant lands in
      // a CDN first is served to everyone.
      vary: 'Accept, Accept-Encoding',
      'x-content-type-options': 'nosniff',
    },
  })
}

/** Passes a response through, declaring that the URL varies by `Accept`. */
function withVary(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('Vary', mergeVary(headers.get('Vary')))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export const config: Config = {
  path: '/*',
  // A performance measure, not a correctness one — the handler passes anything
  // it does not own straight through, so an over-matching route costs an
  // invocation, not a wrong answer. That distinction is load-bearing: the first
  // version of this file used `excludedPattern` here, which Netlify pairs with
  // `pattern` and silently ignores next to `path`. The exclusions never
  // applied, and because the handler trusted them, `/llms.txt` and every PDF
  // answered 404.
  //
  // `excludedPath` is the form that goes with `path`. Extensions are spelled
  // out rather than matched generically so a post slug containing a dot is
  // never mistaken for a file.
  excludedPath: [
    '/assets/*',
    '/admin',
    '/admin/*',
    // `api.ts` owns everything under /api, errors included.
    '/api/*',
    '/*.js',
    '/*.mjs',
    '/*.css',
    '/*.map',
    '/*.json',
    '/*.xml',
    '/*.txt',
    '/*.md',
    '/*.png',
    '/*.jpg',
    '/*.jpeg',
    '/*.webp',
    '/*.avif',
    '/*.gif',
    '/*.svg',
    '/*.ico',
    '/*.pdf',
    '/*.woff',
    '/*.woff2',
    '/*.ttf',
    '/*.otf',
    '/*.mp4',
    '/*.webm',
    '/*.wasm',
    '/*.zip',
  ],
  // No `method` filter on purpose. Netlify's `HTTPMethod` union has no `HEAD`
  // — the platform answers HEAD from the GET path — so listing `['GET']` would
  // risk this function being skipped for `curl -sI -H 'Accept: text/markdown'`,
  // which is exactly the command acceptmarkdown.com tells implementers to
  // verify with. The method guard at the top of the handler does the filtering
  // instead, where it can be tested.
  //
  // The 404 status and the HTML representation both survive without this
  // function; a crash here should degrade to that, not to a 500.
  onError: 'bypass',
}
