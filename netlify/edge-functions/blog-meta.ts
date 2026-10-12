import type { Config, Context } from '@netlify/edge-functions'

import { renderArticle, renderBlogIndex } from '../lib/blog-html.ts'
import {
  articleSchema, BLOG_DESCRIPTION, BLOG_TITLE, blogSchema, breadcrumbSchema,
  DEFAULT_OG, DEFAULT_OG_META, postDescription, postUrl, reciprocalTranslation, safeImage, SITE_NAME, SITE_URL, validDate,
} from '../lib/blog-seo.ts'
import {
  escapeHtml, escapeJsonLd, getPostBody, listAllPublished, lookupPost, type EdgePost,
} from '../lib/firestore.ts'

const HEAD_MARKER = /<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/
const BODY_MARKER = /<!-- BODY:START -->[\s\S]*?<!-- BODY:END -->/

/** Useful HTML for every visitor, including crawlers that do not execute JavaScript. */
export default async function handler(request: Request, context: Context) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next()
  // One URL per document: `/blog/` and `/blog/slug/` would otherwise answer 200
  // as duplicates of their canonical form.
  const requested = new URL(request.url)
  if (requested.pathname !== '/blog' && requested.pathname.endsWith('/')) {
    requested.pathname = requested.pathname.replace(/\/+$/, '')
    return Response.redirect(requested.toString(), 301)
  }
  const response = await context.next()
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response
  const path = new URL(request.url).pathname
  let slug: string
  try { slug = decodeURIComponent(path.replace(/^\/blog\/?/, '').replace(/\/$/, '')) }
  catch { return errorPage(request, 404) }
  if (slug.includes('/')) return errorPage(request, 404)

  let head: string
  let body: string
  let lang = 'pt-BR'
  let unlisted = false
  if (!slug) {
    const result = await listAllPublished()
    if (result.state === 'unavailable') return errorPage(request, 503)
    head = buildIndexHead(result.posts)
    body = renderBlogIndex(result.posts)
  } else {
    const lookup = await lookupPost(slug)
    if (lookup.state === 'missing') return errorPage(request, 404)
    if (lookup.state === 'unavailable') return errorPage(request, 503)
    const post = lookup.post
    const [content, translation] = await Promise.all([
      getPostBody(slug),
      post.status === 'published' && post.translationOf ? lookupPost(post.translationOf) : Promise.resolve(null),
    ])
    if (!content) return errorPage(request, 503)
    const counterpart = translation?.state === 'found' && reciprocalTranslation(post, translation.post)
      ? translation.post : undefined
    head = buildHead(post, counterpart)
    try { body = renderArticle(post, content.body, content.media) }
    catch { return errorPage(request, 503) }
    lang = post.lang === 'pt' ? 'pt-BR' : 'en'
    unlisted = post.status === 'unlisted'
  }

  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.delete('last-modified')
  headers.delete('etag')
  headers.set('Netlify-CDN-Cache-Control', unlisted ? 'no-store' : 'public, s-maxage=300')
  headers.set('Cache-Control', unlisted ? 'no-store' : 'public, max-age=0, must-revalidate')
  if (unlisted) headers.set('X-Robots-Tag', 'noindex, follow')
  // The origin legitimately omits HEAD bytes, so status validation cannot rely on HTML markers.
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
  // Clone before reading: never return a response whose body has already been consumed.
  const html = await response.clone().text()
  if (!HEAD_MARKER.test(html) || !BODY_MARKER.test(html)) return errorPage(request, 503)
  const rewritten = html.replace(HEAD_MARKER, () => head)
    .replace(/<script\b[^>]*\bid=["']site-jsonld["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(BODY_MARKER, () => `<!-- BODY:START -->${body}<!-- BODY:END -->`)
    .replace(/<html\b[^>]*>/i, `<html lang="${lang}">`)
  return new Response(rewritten, { status: 200, headers })
}

function errorPage(request: Request, status: 404 | 503): Response {
  const unavailable = status === 503
  const title = unavailable ? 'Blog temporariamente indisponível' : 'Artigo não encontrado'
  return new Response(request.method === 'HEAD' ? null : `<!doctype html><html lang="pt-BR"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} — ${SITE_NAME}</title><meta name="robots" content="noindex, follow">
    </head><body><main><h1>${title}</h1><p>${unavailable ? 'Tente novamente em alguns minutos.' : 'Este endereço não contém um artigo disponível.'}</p>
    <a href="/blog">Ver artigos</a><a href="/">Marcus Boni</a></main></body></html>`, {
    status, headers: {
      'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, follow',
      ...(unavailable ? { 'Retry-After': '300' } : {}),
    },
  })
}

function commonHead(title: string, description: string, url: string, image: string, type: string, robots: string) {
  return `<title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="robots" content="${robots}">
    <link rel="canonical" href="${escapeHtml(url)}">
    <link rel="alternate" type="text/markdown" href="${escapeHtml(url)}">
    <meta name="theme-color" content="#0d0c0a">
    <meta property="og:type" content="${type}">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    ${image === DEFAULT_OG ? Object.entries(DEFAULT_OG_META).map(([key, value]) => `<meta property="og:image:${key}" content="${value}">`).join('\n    ') : ''}
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeHtml(url)}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">`
}

function buildIndexHead(posts: EdgePost[]): string {
  return `<!-- SEO:START -->${commonHead(BLOG_TITLE, BLOG_DESCRIPTION, `${SITE_URL}/blog`, DEFAULT_OG, 'website', 'index, follow, max-image-preview:large')}
    <meta property="og:locale" content="pt_BR">
    <script id="blog-jsonld" type="application/ld+json">${escapeJsonLd({ '@context': 'https://schema.org', '@graph': [blogSchema(posts)] })}</script>
    <!-- SEO:END -->`
}

function buildHead(post: EdgePost, counterpart?: EdgePost): string {
  const url = postUrl(post.slug)
  const image = safeImage(post.coverUrl) ?? DEFAULT_OG
  const published = validDate(post.publishedAt)
  const modified = validDate(post.updatedAt)
  const robots = post.status === 'unlisted' ? 'noindex, follow' : 'index, follow, max-image-preview:large'
  const alternates = counterpart ? [
    `<link rel="alternate" hreflang="${post.lang === 'pt' ? 'pt-BR' : 'en'}" href="${escapeHtml(url)}">`,
    `<link rel="alternate" hreflang="${counterpart.lang === 'pt' ? 'pt-BR' : 'en'}" href="${escapeHtml(postUrl(counterpart.slug))}">`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(postUrl(post.lang === 'pt' ? post.slug : counterpart.slug))}">`,
  ].join('\n') : ''
  return `<!-- SEO:START -->${commonHead(`${post.title} — ${SITE_NAME}`, postDescription(post), url, image, 'article', robots)}
    <meta property="og:locale" content="${post.lang === 'pt' ? 'pt_BR' : 'en_US'}">
    <meta property="og:image:alt" content="${escapeHtml(post.coverAlt || post.title)}">
    <meta name="twitter:image:alt" content="${escapeHtml(post.coverAlt || post.title)}">
    ${published ? `<meta property="article:published_time" content="${published}">` : ''}
    ${modified ? `<meta property="article:modified_time" content="${modified}">` : ''}
    <meta property="article:author" content="${SITE_URL}/about">
    ${post.tags.map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}">`).join('\n')}
    ${alternates}
    <script id="blog-jsonld" type="application/ld+json">${escapeJsonLd({ '@context': 'https://schema.org', '@graph': [articleSchema(post), breadcrumbSchema(post)] })}</script>
    <!-- SEO:END -->`
}

export const config: Config = { path: ['/blog', '/blog/*'] }
