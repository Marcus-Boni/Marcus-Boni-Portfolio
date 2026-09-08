import type { Config, Context } from '@netlify/edge-functions'

import { escapeHtml, isConfigured, listPublished, type EdgePost } from './_firestore.ts'

/**
 * Dynamic `/rss.xml` and `/sitemap.xml`.
 *
 * Both are generated from Firestore at request time, so publishing a post
 * makes it discoverable immediately — no rebuild, no stale feed. Only
 * `published` posts appear: drafts are invisible and `unlisted` ones are
 * deliberately excluded, which is the whole point of that status.
 *
 * `public/sitemap.xml` stays in the repo as the fallback: if this function
 * cannot reach Firestore it hands the request back to the static file rather
 * than serving an empty sitemap, which search engines treat as a removal.
 */

const SITE_URL = 'https://marcusboni.com.br'
const SITE_NAME = 'Marcus Boni'
const AUTHOR_EMAIL = 'mgalvaoboni@gmail.com'

/** Static routes that always belong in the sitemap. */
const STATIC_ROUTES: { path: string; priority: string; changefreq: string }[] = [
  { path: '/', priority: '1.0', changefreq: 'monthly' },
  { path: '/blog', priority: '0.9', changefreq: 'weekly' },
]

export default async function handler(request: Request, context: Context) {
  const { pathname } = new URL(request.url)
  const wantsRss = pathname === '/rss.xml'

  if (!isConfigured) {
    return wantsRss ? xml(renderRss([])) : context.next()
  }

  const posts = await listPublished()

  // An empty result is ambiguous — no posts yet, or a failed read. Either way,
  // for the sitemap the static file is the safer answer.
  if (posts.length === 0 && !wantsRss) return context.next()

  return xml(wantsRss ? renderRss(posts) : renderSitemap(posts))
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
function isoDate(value: string | null): string {
  if (!value) return new Date().toISOString().slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10)
}

function rfc822(value: string | null): string {
  const date = value ? new Date(value) : new Date()
  return (Number.isNaN(date.getTime()) ? new Date() : date).toUTCString()
}

function renderSitemap(posts: EdgePost[]): string {
  const newest = posts[0]?.publishedAt ?? null

  const staticEntries = STATIC_ROUTES.map(
    ({ path, priority, changefreq }) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${isoDate(path === '/blog' ? newest : null)}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
  )

  const postEntries = posts.map((post) => {
    // A translated pair declares each other as alternates, which is what makes
    // Google serve the right language instead of picking one.
    const alternates = post.translationOf
      ? `
    <xhtml:link rel="alternate" hreflang="${post.lang}" href="${SITE_URL}/blog/${escapeHtml(post.slug)}"/>
    <xhtml:link rel="alternate" hreflang="${post.lang === 'pt' ? 'en' : 'pt'}" href="${SITE_URL}/blog/${escapeHtml(post.translationOf)}"/>`
      : ''
    return `  <url>
    <loc>${SITE_URL}/blog/${escapeHtml(post.slug)}</loc>
    <lastmod>${isoDate(post.updatedAt || post.publishedAt)}</lastmod>
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
  const items = posts.map((post) => {
    const url = `${SITE_URL}/blog/${post.slug}`
    return `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${escapeHtml(url)}</link>
      <guid isPermaLink="true">${escapeHtml(url)}</guid>
      <pubDate>${rfc822(post.publishedAt)}</pubDate>
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
    <lastBuildDate>${rfc822(posts[0]?.publishedAt ?? null)}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`
}

export const config: Config = {
  path: ['/rss.xml', '/sitemap.xml'],
}
