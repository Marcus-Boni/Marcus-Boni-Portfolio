import type { Config, Context } from '@netlify/edge-functions'

import { renderArticle, renderAskPage, renderBlogIndex } from '../lib/blog-html.ts'
import {
  isBilingual,
  localizedBody,
  localizedMeta,
  type BlogLocale,
} from '../lib/blog-locale.ts'
import {
  articleSchema,
  askAlternates,
  askDescription,
  askSchema,
  askTitle,
  askUrl,
  blogDescription,
  blogIndexBreadcrumbSchema,
  blogIndexUrl,
  blogSchema,
  blogTitle,
  breadcrumbSchema,
  countMarkdownWords,
  DEFAULT_OG,
  DEFAULT_OG_META,
  defaultOgAlt,
  imageMimeType,
  postAlternates,
  postCanonicalUrl,
  postDescription,
  postUrl,
  reciprocalTranslation,
  safeImage,
  SITE_NAME,
  SITE_URL,
  validDate,
} from '../lib/blog-seo.ts'
import {
  escapeHtml, escapeJsonLd, getPostBody, listAllPublished, lookupPost, type EdgePost,
} from '../lib/firestore.ts'
import { blogRouteLang } from '../lib/routes.ts'

const HEAD_MARKER = /<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/
const BODY_MARKER = /<!-- BODY:START -->[\s\S]*?<!-- BODY:END -->/

interface ImageMeta {
  type?: string
  width?: number | string
  height?: number | string
  alt: string
}

/** Useful HTML for every visitor, including crawlers that do not execute JavaScript. */
export default async function handler(request: Request, context: Context) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return context.next()
  // One URL per document: trailing-slash variants would otherwise answer 200 as
  // duplicates of their canonical form.
  const requested = new URL(request.url)
  if (
    requested.pathname !== '/' &&
    requested.pathname.endsWith('/')
  ) {
    requested.pathname = requested.pathname.replace(/\/+$/, '')
    return Response.redirect(requested.toString(), 301)
  }
  const response = await context.next()
  if (!(response.headers.get('content-type') ?? '').includes('text/html')) return response
  const path = requested.pathname

  let head: string
  let body: string
  let lang: string
  let unlisted = false

  if (path === '/ask' || path === '/en/ask') {
    const askLang: BlogLocale = path === '/en/ask' ? 'en' : 'pt'
    head = buildAskHead(askLang)
    body = renderAskPage(askLang)
    lang = askLang === 'en' ? 'en' : 'pt-BR'
  } else {
    const routeLang: BlogLocale = blogRouteLang(path)
    const prefix = routeLang === 'en' ? /^\/en\/blog\/?/ : /^\/blog\/?/
    let slug: string
    try { slug = decodeURIComponent(path.replace(prefix, '').replace(/\/$/, '')) }
    catch { return errorPage(request, 404, routeLang) }
    if (slug.includes('/')) return errorPage(request, 404, routeLang)

    if (!slug) {
      const result = await listAllPublished()
      if (result.state === 'unavailable') return errorPage(request, 503, routeLang)
      head = buildIndexHead(result.posts, routeLang)
      body = renderBlogIndex(result.posts, routeLang)
      lang = routeLang === 'en' ? 'en' : 'pt-BR'
    } else {
      const lookup = await lookupPost(slug)
      if (lookup.state === 'missing') return errorPage(request, 404, routeLang)
      if (lookup.state === 'unavailable') return errorPage(request, 503, routeLang)
      const post = lookup.post

      // `/en/blog/{slug}` only exists as the English variant of a bilingual post.
      // Single-language posts (whether PT or EN) live canonically at `/blog/{slug}`.
      if (routeLang === 'en' && !isBilingual(post)) {
        const canonical = new URL(request.url)
        canonical.pathname = `/blog/${encodeURIComponent(post.slug)}`
        return Response.redirect(canonical.toString(), 301)
      }

      const bilingual = isBilingual(post)
      const activeLang: BlogLocale = bilingual ? routeLang : post.lang

      const [content, translation] = await Promise.all([
        getPostBody(slug),
        !bilingual && post.status === 'published' && post.translationOf
          ? lookupPost(post.translationOf)
          : Promise.resolve(null),
      ])
      if (!content) return errorPage(request, 503, activeLang)
      const counterpart = translation?.state === 'found' && reciprocalTranslation(post, translation.post)
        ? translation.post : undefined
      const markdown = localizedBody({ ...post, ...content }, activeLang)
      const alternate = bilingual && post.status === 'published'
        ? {
            lang: (activeLang === 'pt' ? 'en' : 'pt') as BlogLocale,
            href: postUrl(post.slug, activeLang === 'pt' ? 'en' : 'pt'),
          }
        : counterpart
          ? { lang: counterpart.lang, href: postUrl(counterpart.slug, 'pt') }
          : undefined
      head = buildHead(post, activeLang, markdown, counterpart)
      try { body = renderArticle(post, markdown, content.media, activeLang, alternate) }
      catch { return errorPage(request, 503, activeLang) }
      lang = activeLang === 'pt' ? 'pt-BR' : 'en'
      unlisted = post.status === 'unlisted'
    }
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
  if (!HEAD_MARKER.test(html) || !BODY_MARKER.test(html)) return errorPage(request, 503, lang === 'en' ? 'en' : 'pt')
  const rewritten = html.replace(HEAD_MARKER, () => head)
    .replace(/<script\b[^>]*\bid=["']site-jsonld["'][^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(BODY_MARKER, () => `<!-- BODY:START -->${body}<!-- BODY:END -->`)
    .replace(/<html\b[^>]*>/i, `<html lang="${lang}">`)
  return new Response(rewritten, { status: 200, headers })
}

function errorPage(request: Request, status: 404 | 503, lang: BlogLocale = 'pt'): Response {
  const unavailable = status === 503
  const en = lang === 'en'
  const title = unavailable
    ? (en ? 'Blog temporarily unavailable' : 'Blog temporariamente indisponível')
    : (en ? 'Article not found' : 'Artigo não encontrado')
  const indexHref = en ? '/en/blog' : '/blog'
  return new Response(request.method === 'HEAD' ? null : `<!doctype html><html lang="${en ? 'en' : 'pt-BR'}"><head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} — ${SITE_NAME}</title><meta name="robots" content="noindex, follow">
    </head><body><main><h1>${title}</h1><p>${unavailable ? (en ? 'Please try again in a few minutes.' : 'Tente novamente em alguns minutos.') : (en ? 'This address does not match an available article.' : 'Este endereço não contém um artigo disponível.')}</p>
    <a href="${indexHref}">${en ? 'See articles' : 'Ver artigos'}</a><a href="/">Marcus Boni</a></main></body></html>`, {
    status, headers: {
      'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Netlify-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, follow',
      ...(unavailable ? { 'Retry-After': '300' } : {}),
    },
  })
}

function commonHead(
  title: string,
  description: string,
  url: string,
  image: string,
  type: string,
  robots: string,
  contentLang: 'pt-BR' | 'en',
  imageMeta: ImageMeta,
) {
  const metaLines: string[] = []
  if (imageMeta.type) metaLines.push(`<meta property="og:image:type" content="${escapeHtml(imageMeta.type)}">`)
  if (imageMeta.width) metaLines.push(`<meta property="og:image:width" content="${escapeHtml(String(imageMeta.width))}">`)
  if (imageMeta.height) metaLines.push(`<meta property="og:image:height" content="${escapeHtml(String(imageMeta.height))}">`)
  return `<title>${escapeHtml(title)}</title>
    <meta name="title" content="${escapeHtml(title)}">
    <meta name="description" content="${escapeHtml(description)}">
    <meta http-equiv="content-language" content="${contentLang}">
    <meta name="robots" content="${robots}">
    <link rel="canonical" href="${escapeHtml(url)}">
    <link rel="alternate" type="text/markdown" href="${escapeHtml(url)}">
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f1ede5">
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0d0c0a">
    <meta property="og:type" content="${type}">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    ${metaLines.join('\n    ')}
    <meta property="og:image:alt" content="${escapeHtml(imageMeta.alt)}">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:url" content="${escapeHtml(url)}">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <meta name="twitter:image:alt" content="${escapeHtml(imageMeta.alt)}">`
}

function buildAskHead(lang: BlogLocale): string {
  const alternates = askAlternates()
    .map((entry) => `<link rel="alternate" hreflang="${entry.hreflang}" href="${escapeHtml(entry.href)}">`)
    .join('\n    ')
  return `<!-- SEO:START -->${commonHead(
    askTitle(lang),
    askDescription(lang),
    askUrl(lang),
    DEFAULT_OG,
    'website',
    'index, follow, max-image-preview:large',
    lang === 'en' ? 'en' : 'pt-BR',
    { ...DEFAULT_OG_META, alt: defaultOgAlt(lang) },
  )}
    <meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'pt_BR'}">
    <meta property="og:locale:alternate" content="${lang === 'en' ? 'pt_BR' : 'en_US'}">
    ${alternates}
    <script id="blog-jsonld" type="application/ld+json">${escapeJsonLd(askSchema(lang))}</script>
    <!-- SEO:END -->`
}

function buildIndexHead(posts: EdgePost[], lang: BlogLocale): string {
  const ptHref = blogIndexUrl('pt')
  const enHref = blogIndexUrl('en')
  const rssAlt = lang === 'en'
    ? `<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} — Field notes (EN)" href="/en/rss.xml">`
    : ''
  return `<!-- SEO:START -->${commonHead(
    blogTitle(lang),
    blogDescription(lang),
    blogIndexUrl(lang),
    DEFAULT_OG,
    'website',
    'index, follow, max-image-preview:large',
    lang === 'en' ? 'en' : 'pt-BR',
    { ...DEFAULT_OG_META, alt: defaultOgAlt(lang) },
  )}
    <meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'pt_BR'}">
    <meta property="og:locale:alternate" content="${lang === 'en' ? 'pt_BR' : 'en_US'}">
    <link rel="alternate" hreflang="pt-BR" href="${escapeHtml(ptHref)}">
    <link rel="alternate" hreflang="en" href="${escapeHtml(enHref)}">
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(ptHref)}">
    ${rssAlt}
    <script id="blog-jsonld" type="application/ld+json">${escapeJsonLd({ '@context': 'https://schema.org', '@graph': [blogSchema(posts, lang), blogIndexBreadcrumbSchema(lang)] })}</script>
    <!-- SEO:END -->`
}

function buildHead(post: EdgePost, lang: BlogLocale, markdown: string, counterpart?: EdgePost): string {
  const view = localizedMeta(post, lang)
  const activeLang = view.lang
  const url = postCanonicalUrl(post, activeLang)
  const customImage = safeImage(post.coverUrl)
  const image = customImage ?? DEFAULT_OG
  const imageMeta: ImageMeta = customImage
    ? {
        type: imageMimeType(customImage),
        width: post.coverWidth,
        height: post.coverHeight,
        alt: view.coverAlt || view.title,
      }
    : {
        ...DEFAULT_OG_META,
        alt: view.coverAlt || view.title,
      }
  const published = validDate(post.publishedAt)
  const modified = validDate(post.updatedAt)
  const robots = post.status === 'unlisted' ? 'noindex, follow' : 'index, follow, max-image-preview:large'
  const altLinks = postAlternates(post, counterpart)
  const alternates = altLinks
    .map((entry) => `<link rel="alternate" hreflang="${entry.hreflang}" href="${escapeHtml(entry.href)}">`)
    .join('\n')
  const localeAlternate = altLinks.length > 0
    ? `<meta property="og:locale:alternate" content="${activeLang === 'pt' ? 'en_US' : 'pt_BR'}">`
    : ''
  const rssAlt = activeLang === 'en'
    ? `<link rel="alternate" type="application/rss+xml" title="${SITE_NAME} — Field notes (EN)" href="/en/rss.xml">`
    : ''
  const wordCount = countMarkdownWords(markdown)

  return `<!-- SEO:START -->${commonHead(
    `${view.title} — ${SITE_NAME}`,
    postDescription(post, activeLang),
    url,
    image,
    'article',
    robots,
    activeLang === 'pt' ? 'pt-BR' : 'en',
    imageMeta,
  )}
    <meta property="og:locale" content="${activeLang === 'pt' ? 'pt_BR' : 'en_US'}">
    ${localeAlternate}
    ${published ? `<meta property="article:published_time" content="${published}">` : ''}
    ${modified ? `<meta property="article:modified_time" content="${modified}">` : ''}
    <meta property="article:author" content="${SITE_URL}/about">
    ${view.tags[0] ? `<meta property="article:section" content="${escapeHtml(view.tags[0])}">` : ''}
    ${view.tags.map((tag) => `<meta property="article:tag" content="${escapeHtml(tag)}">`).join('\n')}
    ${alternates}
    ${rssAlt}
    <script id="blog-jsonld" type="application/ld+json">${escapeJsonLd({ '@context': 'https://schema.org', '@graph': [articleSchema(post, activeLang, { wordCount }), breadcrumbSchema(post, activeLang)] })}</script>
    <!-- SEO:END -->`
}

export const config: Config = { path: ['/blog', '/blog/*', '/en/blog', '/en/blog/*', '/ask', '/en/ask'] }
