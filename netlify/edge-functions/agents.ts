import type { Config, Context } from '@netlify/edge-functions'

import {
  acceptsHtmlExplicitly,
  MARKDOWN,
  mergeVary,
  negotiate,
  notAcceptableBody,
} from './_accept.ts'
import {
  blogIndexMarkdown,
  developersMarkdown,
  homeMarkdown,
  notFoundMarkdown,
  postMarkdown,
} from './_agent-docs.ts'
import { getPostBody, isConfigured, listPublished, lookupPost } from './_firestore.ts'
import { blogSlug, matchRoute } from './_routes.ts'

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
  const chosen = negotiate(accept)

  // Nothing this site produces is acceptable to the client. The one case where
  // 406 is the honest answer rather than an over-eager one.
  if (chosen === null) {
    return text(notAcceptableBody(accept), 406, request, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    })
  }

  const wantsMarkdown =
    chosen === MARKDOWN ||
    // A 404 diagnostic defaults to Markdown for clients that never named
    // `text/html`. See `acceptsHtmlExplicitly`.
    (matchRoute(url.pathname) === null && !acceptsHtmlExplicitly(accept))

  if (wantsMarkdown) {
    const doc = await buildMarkdown(url)
    if (doc) {
      return text(doc.body, doc.status, request, {
        'content-type': MARKDOWN_TYPE,
        'cache-control':
          doc.status === 200
            ? 'public, max-age=300, stale-while-revalidate=86400'
            : 'public, max-age=0, must-revalidate',
      })
    }
  }

  // HTML — or a Markdown request this route cannot answer right now (a post
  // while Firestore is unreachable). Falling back to the HTML representation
  // beats erroring: it is still a truthful representation of the URL, and a
  // backend blip should not read to a crawler as "this page is gone".
  return withVary(await context.next())
}

/* ─── Markdown routing ──────────────────────────────────────────────────── */

/**
 * The Markdown document for a URL, or `null` when this route has no Markdown
 * representation and the request should fall through to HTML.
 */
async function buildMarkdown(url: URL): Promise<MarkdownDoc | null> {
  switch (matchRoute(url.pathname)) {
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

    // The admin app is behind Firebase Auth and disallowed in robots.txt.
    // There is no content to represent.
    case 'admin':
      return null

    case null:
      return { body: notFoundMarkdown(url.pathname), status: 404 }
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
  // Documents only. Static files are served straight from the CDN — running
  // this on every hashed asset would add an invocation to each one for a
  // header they do not need. Extensions are listed rather than matched
  // generically (`\.\w+$`) so a post slug containing a dot is not mistaken
  // for a file.
  excludedPattern: [
    '^/assets/.*',
    '^/admin(/.*)?$',
    '^/.*\\.(js|mjs|css|map|json|xml|txt|md|png|jpe?g|webp|avif|gif|svg|ico|pdf|woff2?|ttf|otf|mp4|webm|wasm|zip)$',
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
