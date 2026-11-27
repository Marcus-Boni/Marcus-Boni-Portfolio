import { useEffect } from 'react'

import type { PostMeta } from '@/blog/types'
import { profile, socials } from '@/data/profile'
import type { Locale } from '@/i18n/translations'
import { blogIndexPath, localizedMeta } from '../../../netlify/lib/blog-locale'
import {
  articleSchema,
  blogDescription,
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
  safeImage,
  SITE_NAME,
  SITE_URL,
  validDate,
} from '../../../netlify/lib/blog-seo'

import { formatPostDate } from './text'

export { SITE_URL }

function removeHead(selector: string) {
  document.head.querySelectorAll(selector).forEach((node) => node.remove())
}

function setMeta(attr: 'name' | 'property' | 'http-equiv', key: string, content: string) {
  removeHead(`meta[${attr}="${key}"]`)
  const tag = document.createElement('meta')
  tag.setAttribute(attr, key)
  tag.setAttribute('content', content)
  document.head.appendChild(tag)
}

function setLink(rel: string, href: string, attributes: Record<string, string> = {}) {
  const tag = document.createElement('link')
  tag.setAttribute('rel', rel)
  tag.setAttribute('href', href)
  for (const [key, value] of Object.entries(attributes)) tag.setAttribute(key, value)
  document.head.appendChild(tag)
}

function setJsonLd(data: object | null) {
  // Older delivered HTML used an anonymous script. Remove it too so
  // navigation never leaves two conflicting articles in the same document.
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((node) => {
    if (node.id === 'blog-jsonld' || node.id === 'site-jsonld' || /"@type"\s*:\s*"(?:BlogPosting|Blog|BreadcrumbList)"/.test(node.textContent ?? '')) {
      node.remove()
    }
  })
  if (!data) return
  const script = document.createElement('script')
  script.id = 'blog-jsonld'
  script.setAttribute('type', 'application/ld+json')
  script.textContent = JSON.stringify(data)
  document.head.appendChild(script)
}

interface HeadInput {
  title: string
  description: string
  path: string
  image?: string
  imageWidth?: number
  imageHeight?: number
  imageType?: string
  imageAlt?: string
  type?: 'website' | 'article'
  locale?: Locale
  noindex?: boolean
  canonical?: boolean
  jsonLd?: object | null
}

function applyHead({
  title,
  description,
  path,
  image = DEFAULT_OG,
  imageWidth,
  imageHeight,
  imageType,
  imageAlt,
  type = 'website',
  locale = 'pt',
  noindex = false,
  canonical = true,
  jsonLd = null,
}: HeadInput) {
  const url = `${SITE_URL}${path}`
  const contentLang = locale === 'pt' ? 'pt-BR' : 'en'
  const resolvedAlt = imageAlt || defaultOgAlt(locale)
  document.title = title
  document.documentElement.lang = contentLang
  removeHead('meta[property^="article:"]')
  removeHead('meta[property="og:locale:alternate"]')
  removeHead('link[rel="canonical"]')
  removeHead('link[rel="alternate"][hreflang]')
  removeHead('link[rel="alternate"][type="text/markdown"]')
  removeHead('link[rel="alternate"][href="/en/rss.xml"]')
  removeHead('meta[name^="twitter:"]')
  removeHead('meta[property^="twitter:"]')
  removeHead('meta[property="og:image:width"]')
  removeHead('meta[property="og:image:height"]')
  removeHead('meta[property="og:image:type"]')
  setMeta('name', 'description', description)
  setMeta('name', 'title', title)
  setMeta('http-equiv', 'content-language', contentLang)
  setMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large')
  if (canonical) {
    setLink('canonical', url)
    setLink('alternate', url, { type: 'text/markdown' })
  }
  for (const [key, value] of Object.entries({
    title,
    description,
    url,
    image,
    type,
    site_name: SITE_NAME,
    locale: locale === 'pt' ? 'pt_BR' : 'en_US',
    'image:alt': resolvedAlt,
  })) setMeta('property', `og:${key}`, value)
  if (image === DEFAULT_OG) {
    for (const [key, value] of Object.entries(DEFAULT_OG_META)) setMeta('property', `og:image:${key}`, value)
  } else {
    const typeVal = imageType ?? imageMimeType(image)
    if (typeVal) setMeta('property', 'og:image:type', typeVal)
    if (imageWidth && imageWidth > 0) setMeta('property', 'og:image:width', String(imageWidth))
    if (imageHeight && imageHeight > 0) setMeta('property', 'og:image:height', String(imageHeight))
  }
  for (const [key, value] of Object.entries({
    card: 'summary_large_image',
    title,
    description,
    image,
    url,
    'image:alt': resolvedAlt,
  })) setMeta('name', `twitter:${key}`, value)
  setJsonLd(jsonLd)
}

/** Shared values keep a direct visit and SPA navigation consistent. */
export function applyBlogIndexHead(posts: PostMeta[] = [], locale: Locale = 'pt') {
  applyHead({
    title: blogTitle(locale),
    description: blogDescription(locale),
    path: blogIndexPath(locale),
    locale,
    jsonLd: { '@context': 'https://schema.org', ...blogSchema(posts, locale) },
  })
  const ptHref = blogIndexUrl('pt')
  const enHref = blogIndexUrl('en')
  setLink('alternate', ptHref, { hreflang: 'pt-BR' })
  setLink('alternate', enHref, { hreflang: 'en' })
  setLink('alternate', ptHref, { hreflang: 'x-default' })
  if (locale === 'en') {
    setLink('alternate', '/en/rss.xml', {
      type: 'application/rss+xml',
      title: `${SITE_NAME} — Field notes (EN)`,
    })
  }
  setMeta('property', 'og:locale:alternate', locale === 'pt' ? 'en_US' : 'pt_BR')
}

export function useBlogIndexHead(posts: PostMeta[], locale: Locale) {
  useEffect(() => applyBlogIndexHead(posts, locale), [posts, locale])
}

export function applyPostHead(
  post: PostMeta,
  translation?: PostMeta | null,
  lang?: Locale,
  markdownBody?: string,
) {
  const view = localizedMeta(post, lang ?? post.lang)
  const activeLang = view.lang
  const url = postCanonicalUrl(post, activeLang)
  const coverImage = safeImage(post.cover?.src)
  const wordCount = markdownBody ? countMarkdownWords(markdownBody) : undefined
  applyHead({
    title: `${view.title} — ${SITE_NAME}`,
    description: postDescription(post, activeLang),
    path: new URL(url).pathname,
    image: coverImage ?? DEFAULT_OG,
    imageWidth: coverImage ? post.cover?.width : undefined,
    imageHeight: coverImage ? post.cover?.height : undefined,
    imageAlt: view.coverAlt || view.title,
    type: 'article',
    locale: activeLang,
    noindex: post.status !== 'published',
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [articleSchema(post, activeLang, { wordCount }), breadcrumbSchema(post, activeLang)],
    },
  })
  const published = validDate(post.publishedAt)
  const modified = validDate(post.updatedAt)
  if (published) setMeta('property', 'article:published_time', published)
  if (modified) setMeta('property', 'article:modified_time', modified)
  setMeta('property', 'article:author', `${SITE_URL}/about`)
  if (view.tags[0]) setMeta('property', 'article:section', view.tags[0])
  for (const tag of view.tags) {
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'article:tag')
    meta.setAttribute('content', tag)
    document.head.appendChild(meta)
  }
  const alternates = postAlternates(post, translation)
  if (alternates.length > 0) {
    for (const entry of alternates) {
      setLink('alternate', entry.href, { hreflang: entry.hreflang })
    }
    setMeta('property', 'og:locale:alternate', activeLang === 'pt' ? 'en_US' : 'pt_BR')
  }
  if (activeLang === 'en') {
    setLink('alternate', '/en/rss.xml', {
      type: 'application/rss+xml',
      title: `${SITE_NAME} — Field notes (EN)`,
    })
  }
}

export function applyMissingPostHead(locale: Locale = 'pt', path = '/blog') {
  applyHead({
    title: `${locale === 'pt' ? 'Post não encontrado' : 'Post not found'} — ${SITE_NAME}`,
    description: locale === 'pt' ? 'Este artigo não existe. Consulte os artigos publicados no blog.' : 'This article does not exist. Browse the published articles on the blog.',
    path, locale, noindex: true, canonical: false,
  })
}

export function usePostHead(
  post: PostMeta | null,
  status: 'loading' | 'ready' | 'error',
  translation: PostMeta | null,
  locale: Locale,
  path: string,
  activeLang?: Locale,
  markdownBody?: string,
) {
  useEffect(() => {
    if (post) applyPostHead(post, translation, activeLang, markdownBody)
    else if (status === 'ready') applyMissingPostHead(locale, path)
  }, [post, status, translation, locale, path, activeLang, markdownBody])
}

/** Restores the portfolio metadata after client-side navigation. */
export function restoreSiteHead(locale: Locale = 'pt') {
  const title = locale === 'pt' ? 'Marcus Boni — Engenheiro de Software' : 'Marcus Boni — Software Engineer'
  const description = locale === 'pt'
    ? 'Marcus Boni, engenheiro de software no Espírito Santo. Software full-stack, sistemas nativos em Rust, IA aplicada (MCP e RAG) e artigos técnicos.'
    : 'Marcus Boni — Brazilian software engineer building full-stack software, native Rust tools, applied AI (MCP and RAG) and production systems.'
  applyHead({
    title, description,
    path: '/', locale,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Person', '@id': `${SITE_URL}/about#person`, name: profile.name,
          alternateName: profile.fullName, url: `${SITE_URL}/about`,
          image: `${SITE_URL}${profile.avatar}`, jobTitle: profile.role,
          sameAs: socials.map((link) => link.url) },
        { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`,
          name: SITE_NAME, inLanguage: locale === 'pt' ? 'pt-BR' : 'en',
          publisher: { '@id': `${SITE_URL}/about#person` } },
        { '@type': 'WebPage', '@id': `${SITE_URL}/#webpage`, url: `${SITE_URL}/`,
          name: title, description, inLanguage: locale === 'pt' ? 'pt-BR' : 'en',
          isPartOf: { '@id': `${SITE_URL}/#website` }, about: { '@id': `${SITE_URL}/about#person` } },
      ],
    },
  })
  const script = document.getElementById('blog-jsonld')
  if (script) script.id = 'site-jsonld'
}

export function postDateLine(post: PostMeta, locale: Locale): string {
  return formatPostDate(post.publishedAt, locale)
}
