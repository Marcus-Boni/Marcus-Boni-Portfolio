import type { Config, Context } from '@netlify/edge-functions'

import { escapeHtml, isConfigured, listAllPublished, type EdgePost } from '../lib/firestore.ts'
import { postUrl, reciprocalTranslation, SITE_URL, SITE_NAME, validDate } from '../lib/blog-seo.ts'

/**
 * Dynamic `/rss.xml` and `/sitemap.xml`.
 *
 * Both are generated from Firestore at request time, so publishing a post
 * makes it discoverable without a rebuild. Clients may cache feeds briefly. Only
 * `published` posts appear: drafts are invisible and `unlisted` ones are
 * deliberately excluded, which is the whole point of that status.
 *
 * Configured upstream failures return 503 with Retry-After instead of
 * announcing that previously published URLs have disappeared.
 */

const AUTHOR_EMAIL = 'mgalvaoboni@gmail.com'

/** Static routes that always belong in the sitemap. */
const STATIC_ROUTES: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'monthly' },
  { path: '/blog', priority: '0.9', changefreq: 'weekly' },
  { path: '/developers', priority: '0.5', changefreq: 'yearly' },
  { path: '/about', priority: '0.7', changefreq: 'yearly' },
  { path: '/contact', priority: '0.7', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
]

export default async function handler(request: Request, context: Context) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next()
  const { pathname } = new URL(request.url)
  const wantsRss = pathname === '/rss.xml'

  if (!isConfigured) {
    const response = wantsRss ? xml(renderRss([])) : await context.next()
    return request.method === 'HEAD' ? new Response(null, response) : response
  }

  const result = await listAllPublished()
  if (result.state === 'unavailable' || result.posts.length + STATIC_ROUTES.length > 50000) {
    return new Response(request.method === 'HEAD' ? null : 'Feed temporariamente indisponível.', {
      status: 503, headers: { 'content-type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'Retry-After': '300' },
    })
  }
  const response = xml(wantsRss ? renderRss(result.posts) : renderSitemap(result.posts))
  return request.method === 'HEAD' ? new Response(null, response) : response
}

function xml(body: string): Response {
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=600, stale-while-revalidate=86400',
      'Cache-Control': 'public, max-age=600',
    },
  })
}

/** Date only — sitemap `lastmod` accepts W3C dates and full ISO is noise. */
function isoDate(value: string | null): string | undefined {
  return validDate(value)?.slice(0, 10)
}

function rfc822(value: string | null): string | undefined {
  const valid = validDate(value)
  return valid ? new Date(valid).toUTCString() : undefined
}

function renderSitemap(posts: EdgePost[]): string {
  const newest = posts.map((post) => validDate(post.updatedAt) ?? validDate(post.publishedAt))
    .filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
  const bySlug = new Map(posts.map((post) => [post.slug, post]))

  const staticEntries = STATIC_ROUTES.map(
    ({ path, priority, changefreq }) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    ${path === '/blog' && isoDate(newest) ? `<lastmod>${isoDate(newest)}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )

  const postEntries = posts.map((post) => {
    // A translated pair declares each other as alternates, which is what makes
    // Google serve the right language instead of picking one.
    const counterpart = post.translationOf ? bySlug.get(post.translationOf) : undefined
    const alternates = reciprocalTranslation(post, counterpart)
      ? `
    <xhtml:link rel="alternate" hreflang="${post.lang === 'pt' ? 'pt-BR' : 'en'}" href="${escapeHtml(postUrl(post.slug))}"/>
    <xhtml:link rel="alternate" hreflang="${post.lang === 'pt' ? 'en' : 'pt-BR'}" href="${escapeHtml(postUrl(counterpart!.slug))}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(postUrl(post.lang === 'pt' ? post.slug : counterpart!.slug))}"/>`
      : ''
    const modified = isoDate(post.updatedAt) ?? isoDate(post.publishedAt)
    return `  <url>
    <loc>${escapeHtml(postUrl(post.slug))}</loc>
    ${modified ? `<lastmod>${modified}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>${alternates}
  </url>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...staticEntries, ...postEntries].join('\n')}
</urlset>`
}

function renderRss(posts: EdgePost[]): string {
  const newest = posts.map((post) => validDate(post.updatedAt) ?? validDate(post.publishedAt))
    .filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
  const built = rfc822(newest)
  const items = posts.map((post) => {
    const url = postUrl(post.slug)
    const published = rfc822(post.publishedAt)
    return `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${escapeHtml(url)}</link>
      <guid isPermaLink="true">${escapeHtml(url)}</guid>
      ${published ? `<pubDate>${published}</pubDate>` : ''}
      <description>${escapeHtml(post.excerpt || post.subtitle || post.title)}</description>
      <dc:creator>${SITE_NAME}</dc:creator>
${post.tags.map((tag) => `      <category>${escapeHtml(tag)}</category>`).join('\n')}
    </item>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${SITE_NAME} — Notas de campo</title>
    <link>${SITE_URL}/blog</link>
    <description>Estudos, bastidores de projeto e notas técnicas de um engenheiro de software brasileiro.</description>
    <language>pt-br</language>
    <managingEditor>${AUTHOR_EMAIL} (${SITE_NAME})</managingEditor>
    ${built ? `<lastBuildDate>${built}</lastBuildDate>` : ''}
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`
}

export const config: Config = {
  path: ['/rss.xml', '/sitemap.xml'],
}
