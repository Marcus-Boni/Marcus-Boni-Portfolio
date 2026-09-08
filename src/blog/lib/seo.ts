import { useEffect } from 'react'

import type { PostMeta } from '@/blog/types'

import { formatPostDate } from './text'

/**
 * Client-side `<head>` management for blog routes.
 *
 * This is the *second* half of the SEO story, not the whole of it. Social
 * crawlers (LinkedIn, Slack, WhatsApp, X) never run JavaScript, so the tags
 * that matter for link previews are injected at the edge before the HTML is
 * served — see `netlify/edge-functions/blog-meta.ts`. What runs here keeps the
 * document honest during client-side navigation, where no new HTML is fetched:
 * the tab title, the canonical URL, and the structured data.
 *
 * Both paths write the same values, so a crawler and a reader always agree.
 */

export const SITE_URL = 'https://marcusboni.com.br'
const SITE_NAME = 'Marcus Boni'
const DEFAULT_OG = `${SITE_URL}/og-image.png`

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setLink(rel: string, href: string, hreflang?: string) {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`
  let tag = document.head.querySelector<HTMLLinkElement>(selector)
  if (!tag) {
    tag = document.createElement('link')
    tag.rel = rel
    if (hreflang) tag.hreflang = hreflang
    document.head.appendChild(tag)
  }
  tag.href = href
}

const JSONLD_ID = 'blog-jsonld'

function setJsonLd(data: object | null) {
  const existing = document.getElementById(JSONLD_ID)
  if (!data) {
    existing?.remove()
    return
  }
  const script =
    existing ?? Object.assign(document.createElement('script'), { id: JSONLD_ID })
  script.setAttribute('type', 'application/ld+json')
  script.textContent = JSON.stringify(data)
  if (!existing) document.head.appendChild(script)
}

interface HeadInput {
  title: string
  description: string
  path: string
  image?: string
  type?: 'website' | 'article'
  locale?: 'pt' | 'en'
  jsonLd?: object | null
}

function applyHead({
  title,
  description,
  path,
  image = DEFAULT_OG,
  type = 'website',
  locale = 'pt',
  jsonLd = null,
}: HeadInput) {
  const url = `${SITE_URL}${path}`
  document.title = title

  setMeta('meta[name="description"]', 'name', 'description', description)
  setMeta('meta[name="title"]', 'name', 'title', title)
  setLink('canonical', url)

  setMeta('meta[property="og:title"]', 'property', 'og:title', title)
  setMeta('meta[property="og:description"]', 'property', 'og:description', description)
  setMeta('meta[property="og:url"]', 'property', 'og:url', url)
  setMeta('meta[property="og:image"]', 'property', 'og:image', image)
  setMeta('meta[property="og:type"]', 'property', 'og:type', type)
  setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME)
  setMeta(
    'meta[property="og:locale"]',
    'property',
    'og:locale',
    locale === 'pt' ? 'pt_BR' : 'en_US',
  )

  setMeta('meta[property="twitter:title"]', 'property', 'twitter:title', title)
  setMeta(
    'meta[property="twitter:description"]',
    'property',
    'twitter:description',
    description,
  )
  setMeta('meta[property="twitter:image"]', 'property', 'twitter:image', image)
  setMeta('meta[property="twitter:url"]', 'property', 'twitter:url', url)

  setJsonLd(jsonLd)
}

/** Head for the blog index. */
export function useBlogIndexHead(title: string, description: string) {
  useEffect(() => {
    applyHead({ title: `${title} — ${SITE_NAME}`, description, path: '/blog' })
  }, [title, description])
}

/** Head for a single post, including `Article` structured data. */
export function usePostHead(post: PostMeta | null) {
  useEffect(() => {
    if (!post) return

    const path = `/blog/${post.slug}`
    const description = post.excerpt || post.subtitle || ''

    applyHead({
      title: `${post.title} — ${SITE_NAME}`,
      description,
      path,
      image: post.cover?.src ?? DEFAULT_OG,
      type: 'article',
      locale: post.lang,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description,
        image: post.cover?.src ?? DEFAULT_OG,
        datePublished: post.publishedAt ?? undefined,
        dateModified: post.updatedAt,
        inLanguage: post.lang === 'pt' ? 'pt-BR' : 'en',
        keywords: post.tags.join(', ') || undefined,
        author: {
          '@type': 'Person',
          name: SITE_NAME,
          url: SITE_URL,
        },
        publisher: { '@type': 'Person', name: SITE_NAME, url: SITE_URL },
        mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${path}` },
      },
    })

    // A translated counterpart makes the pair eligible for hreflang; a lone
    // post must not claim one, or Google sees a broken alternate.
    if (post.translationOf) {
      const other = post.lang === 'pt' ? 'en' : 'pt'
      setLink('alternate', `${SITE_URL}${path}`, post.lang)
      setLink('alternate', `${SITE_URL}/blog/${post.translationOf}`, other)
    } else {
      document.head
        .querySelectorAll('link[rel="alternate"][hreflang]')
        .forEach((node) => node.remove())
    }
  }, [post])
}

/** Restores the portfolio's own head when leaving the blog. */
export function restoreSiteHead() {
  applyHead({
    title: 'Marcus Boni — Software Engineer',
    description:
      'Marcus Boni — Brazilian software engineer crafting robust, modern web applications. React, TypeScript, Next.js, and backend solutions.',
    path: '/',
  })
  document.head
    .querySelectorAll('link[rel="alternate"][hreflang]')
    .forEach((node) => node.remove())
}

/** Shared by the post header and the edge function's `<meta>` output. */
export function postDateLine(post: PostMeta, locale: 'pt' | 'en'): string {
  return formatPostDate(post.publishedAt, locale)
}
