import { useEffect } from 'react'

import type { PostMeta } from '@/blog/types'
import { profile, socials } from '@/data/profile'
import type { Locale } from '@/i18n/translations'
import {
  articleSchema, BLOG_DESCRIPTION, BLOG_TITLE, blogSchema, breadcrumbSchema,
  DEFAULT_OG, DEFAULT_OG_META, postDescription, postUrl, reciprocalTranslation, safeImage,
  SITE_NAME, SITE_URL, validDate,
} from '../../../netlify/lib/blog-seo'

import { formatPostDate } from './text'

export { SITE_URL }

function removeHead(selector: string) {
  document.head.querySelectorAll(selector).forEach((node) => node.remove())
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
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
  imageAlt?: string
  type?: 'website' | 'article'
  locale?: Locale
  noindex?: boolean
  canonical?: boolean
  jsonLd?: object | null
}

function applyHead({ title, description, path, image = DEFAULT_OG, imageAlt = SITE_NAME,
  type = 'website', locale = 'pt', noindex = false, canonical = true, jsonLd = null,
}: HeadInput) {
  const url = `${SITE_URL}${path}`
  document.title = title
  document.documentElement.lang = locale === 'pt' ? 'pt-BR' : 'en'
  removeHead('meta[property^="article:"]')
  removeHead('meta[property="og:locale:alternate"]')
  removeHead('link[rel="canonical"]')
  removeHead('link[rel="alternate"][hreflang]')
  removeHead('link[rel="alternate"][type="text/markdown"]')
  removeHead('meta[name^="twitter:"]')
  removeHead('meta[property^="twitter:"]')
  removeHead('meta[property="og:image:width"]')
  removeHead('meta[property="og:image:height"]')
  removeHead('meta[property="og:image:type"]')
  setMeta('name', 'description', description)
  setMeta('name', 'title', title)
  setMeta('name', 'robots', noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large')
  if (canonical) {
    setLink('canonical', url)
    setLink('alternate', url, { type: 'text/markdown' })
  }
  for (const [key, value] of Object.entries({
    title, description, url, image, type, site_name: SITE_NAME,
    locale: locale === 'pt' ? 'pt_BR' : 'en_US', 'image:alt': imageAlt,
  })) setMeta('property', `og:${key}`, value)
  if (image === DEFAULT_OG) {
    for (const [key, value] of Object.entries(DEFAULT_OG_META)) setMeta('property', `og:image:${key}`, value)
  }
  for (const [key, value] of Object.entries({
    card: 'summary_large_image', title, description, image, url, 'image:alt': imageAlt,
  })) setMeta('name', `twitter:${key}`, value)
  setJsonLd(jsonLd)
}

/** Shared values keep a direct visit and SPA navigation consistent. */
export function applyBlogIndexHead(posts: PostMeta[] = [], locale: Locale = 'pt') {
  applyHead({
    title: BLOG_TITLE, description: BLOG_DESCRIPTION, path: '/blog', locale,
    jsonLd: { '@context': 'https://schema.org', ...blogSchema(posts) },
  })
}

export function useBlogIndexHead(posts: PostMeta[], locale: Locale) {
  useEffect(() => applyBlogIndexHead(posts, locale), [posts, locale])
}

export function applyPostHead(post: PostMeta, translation?: PostMeta | null) {
  const url = postUrl(post.slug)
  applyHead({
    title: `${post.title} — ${SITE_NAME}`, description: postDescription(post),
    path: new URL(url).pathname, image: safeImage(post.cover?.src) ?? DEFAULT_OG,
    imageAlt: post.cover?.alt || post.title, type: 'article', locale: post.lang,
    noindex: post.status !== 'published',
    jsonLd: { '@context': 'https://schema.org', '@graph': [articleSchema(post), breadcrumbSchema(post)] },
  })
  const published = validDate(post.publishedAt)
  const modified = validDate(post.updatedAt)
  if (published) setMeta('property', 'article:published_time', published)
  if (modified) setMeta('property', 'article:modified_time', modified)
  setMeta('property', 'article:author', `${SITE_URL}/about`)
  for (const tag of post.tags) {
    const meta = document.createElement('meta')
    meta.setAttribute('property', 'article:tag')
    meta.setAttribute('content', tag)
    document.head.appendChild(meta)
  }
  if (reciprocalTranslation(post, translation) && translation) {
    setLink('alternate', url, { hreflang: post.lang === 'pt' ? 'pt-BR' : 'en' })
    setLink('alternate', postUrl(translation.slug), { hreflang: translation.lang === 'pt' ? 'pt-BR' : 'en' })
    setLink('alternate', post.lang === 'pt' ? url : postUrl(translation.slug), { hreflang: 'x-default' })
    setMeta('property', 'og:locale:alternate', translation.lang === 'pt' ? 'pt_BR' : 'en_US')
  }
}

export function applyMissingPostHead(locale: Locale = 'pt', path = '/blog') {
  applyHead({
    title: `${locale === 'pt' ? 'Post não encontrado' : 'Post not found'} — ${SITE_NAME}`,
    description: locale === 'pt' ? 'Este artigo não existe. Consulte os artigos publicados no blog.' : 'This article does not exist. Browse the published articles on the blog.',
    path, locale, noindex: true, canonical: false,
  })
}

export function usePostHead(post: PostMeta | null, status: 'loading' | 'ready' | 'error',
  translation: PostMeta | null, locale: Locale, path: string) {
  useEffect(() => {
    if (post) applyPostHead(post, translation)
    else if (status === 'ready') applyMissingPostHead(locale, path)
  }, [post, status, translation, locale, path])
}

/** Restores the portfolio metadata after client-side navigation. */
export function restoreSiteHead(locale: Locale = 'pt') {
  const title = locale === 'pt' ? 'Marcus Boni — Engenheiro de Software' : 'Marcus Boni — Software Engineer'
  const description = locale === 'pt'
    ? 'Marcus Boni, engenheiro de software no Espírito Santo. Projetos com React, TypeScript e Node.js, integrações e artigos sobre desenvolvimento web.'
    : 'Marcus Boni — Brazilian software engineer crafting robust, modern web applications. React, TypeScript, Next.js, and backend solutions.'
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
