import {
  blogIndexPath,
  collapseLegacyPairs,
  isBilingual,
  localizedMeta,
  postPath,
  type BlogLocale,
  type PostLocales,
} from './blog-locale.ts'

/** Shared SEO values for client navigation, delivered HTML and feeds. */
export const SITE_URL = 'https://marcusboni.com.br'
export const SITE_NAME = 'Marcus Boni'
export const DEFAULT_OG = `${SITE_URL}/og-image.jpg`
/** Declared so the first share renders the large card before the scraper fetches the file. */
export const DEFAULT_OG_META = { type: 'image/jpeg', width: '1200', height: '630' } as const
export const BLOG_TITLE = `Blog de engenharia de software — ${SITE_NAME}`
export const BLOG_DESCRIPTION = 'Artigos sobre engenharia de software, arquitetura, inteligência artificial e bastidores de projetos, por Marcus Boni.'
export const BLOG_TITLE_EN = `Software engineering journal — ${SITE_NAME}`
export const BLOG_DESCRIPTION_EN = 'Articles on software engineering, architecture, applied AI and project post-mortems, by Marcus Boni.'

export interface SeoPost {
  slug: string
  lang: BlogLocale
  status: string
  title: string
  excerpt: string
  subtitle?: string
  coverUrl?: string | null
  coverAlt?: string
  cover?: { src: string; alt?: string; caption?: string } | null
  tags: string[]
  readingMinutes?: number
  publishedAt: string | null
  updatedAt: string
  translationOf?: string | null
  locales?: PostLocales
}

export function blogTitle(lang: BlogLocale = 'pt'): string {
  return lang === 'en' ? BLOG_TITLE_EN : BLOG_TITLE
}

export function blogDescription(lang: BlogLocale = 'pt'): string {
  return lang === 'en' ? BLOG_DESCRIPTION_EN : BLOG_DESCRIPTION
}

export function blogIndexUrl(lang: BlogLocale = 'pt'): string {
  return `${SITE_URL}${blogIndexPath(lang)}`
}

export function postUrl(slug: string, lang: BlogLocale = 'pt'): string {
  const encoded = encodeURIComponent(slug)
  return lang === 'en' ? `${SITE_URL}/en/blog/${encoded}` : `${SITE_URL}/blog/${encoded}`
}

/** Canonical URL of a post in `lang` (`/en/blog/{slug}` only when bilingual and EN). */
export function postCanonicalUrl(post: SeoPost, lang?: BlogLocale): string {
  return `${SITE_URL}${postPath(post, lang)}`
}

export function postDescription(post: SeoPost, lang?: BlogLocale): string {
  const view = lang ? localizedMeta(post, lang) : null
  if (view) return view.excerpt || view.subtitle || view.title
  return post.excerpt || post.subtitle || post.title
}

export function validDate(value: string | null | undefined): string | undefined {
  if (!value || Number.isNaN(Date.parse(value))) return undefined
  return new Date(value).toISOString()
}

export function safeImage(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value, SITE_URL)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

export function reciprocalTranslation(post: SeoPost, candidate?: SeoPost | null): boolean {
  return Boolean(candidate && post.status === 'published' && candidate.status === 'published' &&
    candidate.lang !== post.lang && post.translationOf === candidate.slug && candidate.translationOf === post.slug)
}

export interface HreflangAlternate {
  hreflang: 'pt-BR' | 'en' | 'x-default'
  href: string
}

/**
 * Complete reciprocal hreflang set for a published post, or empty when the
 * entry is single-language, unlisted, or a draft.
 *
 * Works for both unified bilingual posts (`/blog/{slug}` + `/en/blog/{slug}`)
 * and legacy separate pairs linked via reciprocal `translationOf`.
 */
export function postAlternates(
  post: SeoPost,
  legacyCounterpart?: SeoPost | null,
): HreflangAlternate[] {
  if (post.status !== 'published') return []

  if (isBilingual(post)) {
    const ptHref = postUrl(post.slug, 'pt')
    const enHref = postUrl(post.slug, 'en')
    return [
      { hreflang: 'pt-BR', href: ptHref },
      { hreflang: 'en', href: enHref },
      { hreflang: 'x-default', href: ptHref },
    ]
  }

  if (reciprocalTranslation(post, legacyCounterpart) && legacyCounterpart) {
    const ptSlug = post.lang === 'pt' ? post.slug : legacyCounterpart.slug
    const enSlug = post.lang === 'en' ? post.slug : legacyCounterpart.slug
    const ptHref = postUrl(ptSlug, 'pt')
    const enHref = postUrl(enSlug, 'pt')
    const entries: HreflangAlternate[] = [
      { hreflang: post.lang === 'pt' ? 'pt-BR' : 'en', href: post.lang === 'pt' ? ptHref : enHref },
      { hreflang: legacyCounterpart.lang === 'pt' ? 'pt-BR' : 'en', href: legacyCounterpart.lang === 'pt' ? ptHref : enHref },
      { hreflang: 'x-default', href: ptHref },
    ]
    return entries
  }

  return []
}

export function articleSchema(post: SeoPost, lang?: BlogLocale) {
  const view = localizedMeta(post, lang ?? post.lang)
  const url = postCanonicalUrl(post, view.lang)
  return {
    '@type': 'BlogPosting', '@id': `${url}#article`, url,
    headline: view.title, description: view.excerpt || view.subtitle || view.title,
    image: safeImage(post.coverUrl ?? post.cover?.src),
    datePublished: validDate(post.publishedAt), dateModified: validDate(post.updatedAt),
    inLanguage: view.lang === 'pt' ? 'pt-BR' : 'en',
    keywords: view.tags.length ? view.tags.join(', ') : undefined,
    author: { '@type': 'Person', '@id': `${SITE_URL}/about#person`, name: SITE_NAME, url: `${SITE_URL}/about` },
    publisher: { '@type': 'Person', '@id': `${SITE_URL}/about#person`, name: SITE_NAME, url: `${SITE_URL}/about` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@id': `${blogIndexUrl(view.lang)}#blog` },
  }
}

export function breadcrumbSchema(post: SeoPost, lang?: BlogLocale) {
  const view = localizedMeta(post, lang ?? post.lang)
  const indexHref = isBilingual(post) ? blogIndexUrl(view.lang) : `${SITE_URL}/blog`
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Marcus Boni', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: indexHref },
      { '@type': 'ListItem', position: 3, name: view.title, item: postCanonicalUrl(post, view.lang) },
    ],
  }
}

export function blogSchema(posts: SeoPost[] = [], lang: BlogLocale = 'pt') {
  const published = posts.filter((post) => post.status === 'published')
  const entries = collapseLegacyPairs(published, lang)
  const indexHref = blogIndexUrl(lang)
  return {
    '@type': 'Blog', '@id': `${indexHref}#blog`, url: indexHref,
    name: blogTitle(lang), description: blogDescription(lang),
    inLanguage: lang === 'en' ? ['en', 'pt-BR'] : ['pt-BR', 'en'],
    author: { '@type': 'Person', name: SITE_NAME, url: `${SITE_URL}/about` },
    blogPost: entries.map(({ post }) => {
      const view = localizedMeta(post, lang)
      const url = postCanonicalUrl(post, lang)
      return {
        '@type': 'BlogPosting', '@id': `${url}#article`, headline: view.title, url,
      }
    }),
  }
}
