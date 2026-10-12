/** Shared SEO values for client navigation, delivered HTML and feeds. */
export const SITE_URL = 'https://marcusboni.com.br'
export const SITE_NAME = 'Marcus Boni'
export const DEFAULT_OG = `${SITE_URL}/og-image.jpg`
/** Declared so the first share renders the large card before the scraper fetches the file. */
export const DEFAULT_OG_META = { type: 'image/jpeg', width: '1200', height: '630' } as const
export const BLOG_TITLE = `Blog de engenharia de software — ${SITE_NAME}`
export const BLOG_DESCRIPTION = 'Artigos sobre engenharia de software, arquitetura, inteligência artificial e bastidores de projetos, por Marcus Boni.'

export interface SeoPost {
  slug: string
  lang: 'pt' | 'en'
  status: string
  title: string
  excerpt: string
  subtitle?: string
  coverUrl?: string | null
  cover?: { src: string; alt?: string } | null
  tags: string[]
  publishedAt: string | null
  updatedAt: string
  translationOf?: string | null
}

export function postUrl(slug: string): string {
  return `${SITE_URL}/blog/${encodeURIComponent(slug)}`
}

export function postDescription(post: SeoPost): string {
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

export function articleSchema(post: SeoPost) {
  const url = postUrl(post.slug)
  return {
    '@type': 'BlogPosting', '@id': `${url}#article`, url,
    headline: post.title, description: postDescription(post),
    image: safeImage(post.coverUrl ?? post.cover?.src),
    datePublished: validDate(post.publishedAt), dateModified: validDate(post.updatedAt),
    inLanguage: post.lang === 'pt' ? 'pt-BR' : 'en',
    keywords: post.tags.length ? post.tags.join(', ') : undefined,
    author: { '@type': 'Person', '@id': `${SITE_URL}/about#person`, name: SITE_NAME, url: `${SITE_URL}/about` },
    publisher: { '@type': 'Person', '@id': `${SITE_URL}/about#person`, name: SITE_NAME, url: `${SITE_URL}/about` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@id': `${SITE_URL}/blog#blog` },
  }
}

export function breadcrumbSchema(post: SeoPost) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Marcus Boni', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: postUrl(post.slug) },
    ],
  }
}

export function blogSchema(posts: SeoPost[] = []) {
  return {
    '@type': 'Blog', '@id': `${SITE_URL}/blog#blog`, url: `${SITE_URL}/blog`,
    name: BLOG_TITLE, description: BLOG_DESCRIPTION, inLanguage: ['pt-BR', 'en'],
    author: { '@type': 'Person', name: SITE_NAME, url: `${SITE_URL}/about` },
    blogPost: posts.filter((post) => post.status === 'published').map((post) => ({
      '@type': 'BlogPosting', '@id': `${postUrl(post.slug)}#article`, headline: post.title, url: postUrl(post.slug),
    })),
  }
}
