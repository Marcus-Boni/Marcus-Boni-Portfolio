/**
 * The set of URLs this site actually has.
 *
 * A single-page app has no server-side notion of "page", so without a list
 * like this every path answers 200 with the app shell — a soft 404. Agents
 * probing for `/api`, `/docs` or `/.well-known/…` then conclude every path
 * exists, and a crawler indexes infinite duplicates of the shell.
 *
 * Two things read this table:
 *   • `agents.ts`, to know whether a request can have a representation at all
 *     before spending a Firestore read or an origin fetch on it;
 *   • `tests/routes.test.ts`, which cross-checks it against the client routes
 *     in `src/main.tsx` / `src/blog/BlogApp.tsx` and against the rewrite rules
 *     in `public/_redirects`, so adding a route without wiring up its rewrite
 *     fails the suite instead of silently 404ing in production.
 *
 * Pure module: no Deno globals, no fetch.
 */

/** What kind of document a path resolves to. Drives the Markdown branch. */
export type RouteKind =
  | 'home'
  | 'blog-index'
  | 'blog-post'
  | 'developers'
  | 'about'
  | 'contact'
  | 'privacy'
  | 'admin'

export interface Route {
  /** Path prefix. With `wildcard`, the prefix is followed by more segments. */
  readonly path: string
  readonly kind: RouteKind
  /**
   * `none`     — exact match only.
   * `segment`  — exactly one more path segment (`/blog/:slug`). Deeper paths
   *              are 404s: the blog has no nested routes, and letting
   *              `/blog/a/b` answer 200 is the soft-404 bug in miniature.
   * `deep`     — any number of further segments (`/admin/blog/new`).
   */
  readonly wildcard: 'none' | 'segment' | 'deep'
  /**
   * `spa`    — React renders it, so `_redirects` has to rewrite it to
   *            `/index.html` or the CDN 404s a legitimate URL.
   * `static` — a real file in `public/<path>/index.html`, rewritten to itself
   *            in `_redirects` rather than relying on the host to resolve a
   *            directory index (Netlify does, `vite preview` does not).
   */
  readonly served: 'spa' | 'static'
}

/**
 * Ordered most-specific first: `/blog` has to win over `/blog/:slug`.
 * Keep the `spa` entries in sync with the `<Route>` declarations in
 * `src/main.tsx` and `src/blog/BlogApp.tsx`.
 */
export const ROUTES: readonly Route[] = [
  { path: '/', kind: 'home', wildcard: 'none', served: 'spa' },
  { path: '/blog', kind: 'blog-index', wildcard: 'none', served: 'spa' },
  { path: '/blog', kind: 'blog-post', wildcard: 'segment', served: 'spa' },
  // Documentation and trust pages, not app. Plain files carrying no bundle, so
  // an agent reading them pays for nothing but the HTML — and each keeps its
  // own <title> and canonical instead of inheriting the SPA shell's.
  { path: '/developers', kind: 'developers', wildcard: 'none', served: 'static' },
  { path: '/about', kind: 'about', wildcard: 'none', served: 'static' },
  { path: '/contact', kind: 'contact', wildcard: 'none', served: 'static' },
  { path: '/privacy', kind: 'privacy', wildcard: 'none', served: 'static' },
  { path: '/admin', kind: 'admin', wildcard: 'none', served: 'spa' },
  { path: '/admin', kind: 'admin', wildcard: 'deep', served: 'spa' },
]

/**
 * Drops a trailing slash so `/blog/` and `/blog` are the same document.
 * The root is left alone — `/` *is* its own path.
 */
export function normalizePath(pathname: string): string {
  let out = pathname || '/'
  while (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1)
  return out
}

function matches(route: Route, pathname: string): boolean {
  if (route.wildcard === 'none') return route.path === pathname

  const prefix = route.path === '/' ? '/' : `${route.path}/`
  if (!pathname.startsWith(prefix)) return false

  const rest = pathname.slice(prefix.length)
  if (rest.length === 0) return false
  return route.wildcard === 'deep' || !rest.includes('/')
}

/**
 * The route a path resolves to, or `null` when the site has no such document.
 * `null` is the signal to answer 404 rather than hand over the app shell.
 */
export function matchRoute(pathname: string): RouteKind | null {
  const normalized = normalizePath(pathname)
  for (const route of ROUTES) {
    if (matches(route, normalized)) return route.kind
  }
  return null
}

/** The `:slug` of a `/blog/:slug` request, or `''` for anything else. */
export function blogSlug(pathname: string): string {
  const normalized = normalizePath(pathname)
  if (matchRoute(normalized) !== 'blog-post') return ''
  return decodeURIComponent(normalized.slice('/blog/'.length))
}

/**
 * The `_redirects` / Netlify `path` form of a route. Netlify's `*` is a
 * greedy match, so both wildcard kinds collapse onto it — the narrower
 * `segment` rule is enforced in `matchRoute`, not by the rewrite.
 */
export function redirectPath(route: Route): string {
  if (route.wildcard === 'none') return route.path
  return route.path === '/' ? '/*' : `${route.path}/*`
}
