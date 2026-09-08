import type { Config, Context } from '@netlify/edge-functions'

import {
  escapeHtml,
  escapeJsonLd,
  isConfigured,
  lookupPost,
  type EdgePost,
} from './_firestore.ts'

/**
 * Per-post `<head>` injection and 404 status for `/blog/:slug`.
 *
 * This is the half of the SEO story that JavaScript cannot do. LinkedIn, Slack,
 * WhatsApp and X fetch the HTML and never execute scripts, so without this
 * every shared post would preview as the generic portfolio card. The client
 * writes the same values on navigation (`src/blog/lib/seo.ts`); this makes them
 * true in the delivered HTML.
 *
 * The whole `<!-- SEO:START -->…<!-- SEO:END -->` block from index.html is
 * replaced in one shot. Anything unexpected — no project id, an unreadable
 * Firestore, a missing marker — falls through to the untouched response, so a
 * failure here degrades to the site's default card rather than to an error
 * page.
 *
 * A slug Firestore *definitely* does not have is the one case that changes the
 * status: the app shell still renders (React shows its own not-found view, so
 * the visual result is unchanged) but it is delivered as a real 404 instead of
 * a 200. `/blog/anything` answering 200 is the same soft-404 that
 * `public/_redirects` fixes for the rest of the site — it just needs a
 * database read to detect.
 */

const SITE_URL = 'https://marcusboni.com.br'
const SITE_NAME = 'Marcus Boni'
const DEFAULT_OG = `${SITE_URL}/og-image.png`
const MARKER = /<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/

export default async function handler(request: Request, context: Context) {
  const response = await context.next()

  if (!isConfigured) return response

  // Only rewrite the document itself; assets and data requests pass through.
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) return response

  const url = new URL(request.url)
  const slug = url.pathname.replace(/^\/blog\/?/, '').replace(/\/$/, '')
  // `/blog` itself is the index — it has no post-specific head to build.
  if (!slug || slug.includes('/')) return response

  const lookup = await lookupPost(slug)
  // `unavailable` is not `missing`: a Firestore outage must not turn every
  // post on the site into a 404 that crawlers act on.
  if (lookup.state === 'unavailable') return response

  const html = await response.text()
  if (!MARKER.test(html)) return response

  const missing = lookup.state === 'missing'
  const rewritten = html.replace(
    MARKER,
    missing ? buildNotFoundHead(slug) : buildHead(lookup.post),
  )

  const headers = new Headers(response.headers)
  // Cached at the edge so a crawler storm costs a handful of Firestore reads,
  // not one per request. Browsers revalidate on every visit.
  headers.set('Netlify-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  headers.delete('content-length')

  return new Response(rewritten, {
    // The shell is delivered as-is — React renders its own not-found view —
    // but the status tells the truth about the URL.
    status: missing ? 404 : response.status,
    headers,
  })
}

/**
 * `<head>` for a slug that does not exist.
 *
 * Kept minimal on purpose: no canonical (there is no canonical URL for a page
 * that isn't there) and an explicit `noindex`, so a crawler that followed a
 * stale link drops it instead of indexing an error state.
 */
function buildNotFoundHead(slug: string): string {
  const title = `Post não encontrado — ${SITE_NAME}`
  return `<!-- SEO:START -->
    <title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}" />
    <meta
      name="description"
      content="Não existe um post em /blog/${escapeHtml(slug)}. Veja o índice em ${SITE_URL}/blog."
    />
    <meta name="robots" content="noindex, follow" />
    <link rel="alternate" type="text/markdown" href="${SITE_URL}/blog/${escapeHtml(slug)}" />
    <meta name="theme-color" content="#0d0c0a" />

    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:image" content="${DEFAULT_OG}" />
    <!-- SEO:END -->`
}

function buildHead(post: EdgePost): string {
  const url = `${SITE_URL}/blog/${post.slug}`
  const title = `${post.title} — ${SITE_NAME}`
  const description = post.excerpt || post.subtitle || post.title
  const image = post.coverUrl ?? DEFAULT_OG
  const locale = post.lang === 'pt' ? 'pt_BR' : 'en_US'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description,
    image,
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt || undefined,
    inLanguage: post.lang === 'pt' ? 'pt-BR' : 'en',
    keywords: post.tags.length > 0 ? post.tags.join(', ') : undefined,
    author: { '@type': 'Person', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Person', name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  }

  // An unlisted post is shareable but must never be indexed.
  const robots =
    post.status === 'unlisted'
      ? '<meta name="robots" content="noindex, follow" />'
      : '<meta name="robots" content="index, follow" />'

  // hreflang is only valid when a counterpart actually exists.
  const alternates = post.translationOf
    ? [
        `<link rel="alternate" hreflang="${post.lang}" href="${escapeHtml(url)}" />`,
        `<link rel="alternate" hreflang="${post.lang === 'pt' ? 'en' : 'pt'}" href="${SITE_URL}/blog/${escapeHtml(post.translationOf)}" />`,
      ].join('\n    ')
    : ''

  return `<!-- SEO:START -->
    <title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}" />
    <meta name="description" content="${escapeHtml(description)}" />
    ${robots}
    <link rel="canonical" href="${escapeHtml(url)}" />
    ${alternates}
    <link rel="alternate" type="text/markdown" href="${escapeHtml(url)}" />
    <meta name="theme-color" content="#0d0c0a" />

    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(post.title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:locale" content="${locale}" />
    <meta property="article:published_time" content="${escapeHtml(post.publishedAt ?? '')}" />
    <meta property="article:modified_time" content="${escapeHtml(post.updatedAt)}" />
    <meta property="article:author" content="${SITE_NAME}" />
    ${post.tags.map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}" />`).join('\n    ')}

    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="${escapeHtml(url)}" />
    <meta property="twitter:title" content="${escapeHtml(post.title)}" />
    <meta property="twitter:description" content="${escapeHtml(description)}" />
    <meta property="twitter:image" content="${escapeHtml(image)}" />

    <script type="application/ld+json">${escapeJsonLd(jsonLd)}</script>
    <!-- SEO:END -->`
}

export const config: Config = {
  path: '/blog/*',
}
