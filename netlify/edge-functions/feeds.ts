import type { Config, Context } from '@netlify/edge-functions'

import {
  collapseLegacyPairs,
  hasLocale,
  isBilingual,
  localizedMeta,
  type BlogLocale,
} from '../lib/blog-locale.ts'
import {
  askAlternates,
  postAlternates,
  postCanonicalUrl,
  postUrl,
  safeImage,
  SITE_NAME,
  SITE_URL,
  validDate,
} from '../lib/blog-seo.ts'
import { escapeHtml, isConfigured, listAllPublished, type EdgePost } from '../lib/firestore.ts'

/**
 * Dynamic `/rss.xml`, `/en/rss.xml`, and `/sitemap.xml`.
 *
 * All feeds are generated from Firestore at request time, so publishing a post
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
  { path: '/en/blog', priority: '0.9', changefreq: 'weekly' },
  { path: '/ask', priority: '0.7', changefreq: 'monthly' },
  { path: '/en/ask', priority: '0.7', changefreq: 'monthly' },
  { path: '/developers', priority: '0.5', changefreq: 'yearly' },
  { path: '/about', priority: '0.7', changefreq: 'yearly' },
  { path: '/contact', priority: '0.7', changefreq: 'yearly' },
  { path: '/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/kit/front-end', priority: '0.6', changefreq: 'monthly' },
  { path: '/en/kit/front-end', priority: '0.6', changefreq: 'monthly' },
]

export default async function handler(request: Request, context: Context) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next()
  const { pathname } = new URL(request.url)
  const wantsRss = pathname === '/rss.xml' || pathname === '/en/rss.xml'
  const rssLang: BlogLocale = pathname === '/en/rss.xml' ? 'en' : 'pt'

  if (!isConfigured) {
    const response = wantsRss ? xml(renderRss([], rssLang)) : await context.next()
    return request.method === 'HEAD' ? new Response(null, response) : response
  }

  const result = await listAllPublished()
  const urlCount =
    result.state === 'found'
      ? result.posts.reduce((sum, post) => sum + (isBilingual(post) ? 2 : 1), STATIC_ROUTES.length)
      : 0
  if (result.state === 'unavailable' || urlCount > 50000) {
    return new Response(request.method === 'HEAD' ? null : 'Feed temporariamente indisponível.', {
      status: 503, headers: { 'content-type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'Retry-After': '300' },
    })
  }
  const response = xml(wantsRss ? renderRss(result.posts, rssLang) : renderSitemap(result.posts))
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

function renderAlternates(alternates: { hreflang: string; href: string }[]): string {
  if (alternates.length === 0) return ''
  return alternates
    .map(
      (entry) =>
        `\n    <xhtml:link rel="alternate" hreflang="${entry.hreflang}" href="${escapeHtml(entry.href)}"/>`,
    )
    .join('')
}

function renderImageTag(post: EdgePost, lang: BlogLocale): string {
  const image = safeImage(post.coverUrl)
  if (!image) return ''
  const view = localizedMeta(post, lang)
  const title = view.coverAlt || view.title
  return `\n    <image:image>\n      <image:loc>${escapeHtml(image)}</image:loc>\n      <image:title>${escapeHtml(title)}</image:title>\n    </image:image>`
}

function renderSitemap(posts: EdgePost[]): string {
  const newest = posts.map((post) => validDate(post.updatedAt) ?? validDate(post.publishedAt))
    .filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
  const bySlug = new Map(posts.map((post) => [post.slug, post]))
  const blogIndexAlternates = renderAlternates([
    { hreflang: 'pt-BR', href: `${SITE_URL}/blog` },
    { hreflang: 'en', href: `${SITE_URL}/en/blog` },
    { hreflang: 'x-default', href: `${SITE_URL}/blog` },
  ])
  const kitAlternates = renderAlternates([
    { hreflang: 'pt-BR', href: `${SITE_URL}/kit/front-end` },
    { hreflang: 'en', href: `${SITE_URL}/en/kit/front-end` },
    { hreflang: 'x-default', href: `${SITE_URL}/kit/front-end` },
  ])
  const askAltXml = renderAlternates(askAlternates())

  const staticEntries = STATIC_ROUTES.map(({ path, priority, changefreq }) => {
    const isBlogIndex = path === '/blog' || path === '/en/blog'
    const isKit = path === '/kit/front-end' || path === '/en/kit/front-end'
    const isAsk = path === '/ask' || path === '/en/ask'
    const alternates = isBlogIndex
      ? blogIndexAlternates
      : isKit
        ? kitAlternates
        : isAsk
          ? askAltXml
          : ''
    return `  <url>
    <loc>${SITE_URL}${path}</loc>
    ${isBlogIndex && isoDate(newest) ? `<lastmod>${isoDate(newest)}</lastmod>` : ''}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>${alternates}
  </url>`
  })

  const postEntries = posts.flatMap((post) => {
    const modified = isoDate(post.updatedAt) ?? isoDate(post.publishedAt)

    if (isBilingual(post)) {
      const alternates = renderAlternates(postAlternates(post))
      return (['pt', 'en'] as const).map(
        (lang) => `  <url>
    <loc>${escapeHtml(postUrl(post.slug, lang))}</loc>
    ${modified ? `<lastmod>${modified}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>${alternates}${renderImageTag(post, lang)}
  </url>`,
      )
    }

    // Legacy separate translated pairs keep reciprocal hreflang until merged.
    const counterpart = post.translationOf ? bySlug.get(post.translationOf) : undefined
    const alternates = renderAlternates(postAlternates(post, counterpart))
    return [
      `  <url>
    <loc>${escapeHtml(postUrl(post.slug))}</loc>
    ${modified ? `<lastmod>${modified}</lastmod>` : ''}
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>${alternates}${renderImageTag(post, post.lang)}
  </url>`,
    ]
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...staticEntries, ...postEntries].join('\n')}
</urlset>`
}

function renderRss(posts: EdgePost[], lang: BlogLocale = 'pt'): string {
  // One RSS item per publication — bilingual entries (and legacy reciprocal pairs)
  // are never duplicated in subscribers' feeds.
  const collapsed = collapseLegacyPairs(posts, lang)
  const entries = lang === 'en'
    ? collapsed.filter(({ post }) => hasLocale(post, 'en'))
    : collapsed
  const newest = entries
    .map(({ post }) => validDate(post.updatedAt) ?? validDate(post.publishedAt))
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null
  const built = rfc822(newest)
  const items = entries.map(({ post }) => {
    const view = localizedMeta(post, lang)
    const url = postCanonicalUrl(post, lang)
    const published = rfc822(post.publishedAt)
    const cover = safeImage(post.coverUrl)
    const mediaTag = cover
      ? `\n      <media:content url="${escapeHtml(cover)}" medium="image"${post.coverWidth ? ` width="${post.coverWidth}"` : ''}${post.coverHeight ? ` height="${post.coverHeight}"` : ''}/>`
      : ''
    return `    <item>
      <title>${escapeHtml(view.title)}</title>
      <link>${escapeHtml(url)}</link>
      <guid isPermaLink="true">${escapeHtml(url)}</guid>
      ${published ? `<pubDate>${published}</pubDate>` : ''}
      <description>${escapeHtml(view.excerpt || view.subtitle || view.title)}</description>
      <dc:creator>${SITE_NAME}</dc:creator>${mediaTag}
${view.tags.map((tag) => `      <category>${escapeHtml(tag)}</category>`).join('\n')}
    </item>`
  })

  const en = lang === 'en'
  const selfHref = en ? `${SITE_URL}/en/rss.xml` : `${SITE_URL}/rss.xml`
  const channelLink = en ? `${SITE_URL}/en/blog` : `${SITE_URL}/blog`
  const channelTitle = en ? `${SITE_NAME} — Field notes` : `${SITE_NAME} — Notas de campo`
  const channelDesc = en
    ? 'Studies, project post-mortems and technical notes from a Brazilian software engineer.'
    : 'Estudos, bastidores de projeto e notas técnicas de um engenheiro de software brasileiro.'

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>${channelTitle}</title>
    <link>${channelLink}</link>
    <description>${channelDesc}</description>
    <language>${en ? 'en-us' : 'pt-br'}</language>
    <managingEditor>${AUTHOR_EMAIL} (${SITE_NAME})</managingEditor>
    ${built ? `<lastBuildDate>${built}</lastBuildDate>` : ''}
    <atom:link href="${selfHref}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`
}

export const config: Config = {
  path: ['/rss.xml', '/en/rss.xml', '/sitemap.xml'],
}
