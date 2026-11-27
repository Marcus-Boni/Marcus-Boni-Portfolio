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
export const DEFAULT_OG_ALT_PT = 'Marcus Boni — engenharia de software, sistemas e IA aplicada'
export const DEFAULT_OG_ALT_EN = 'Marcus Boni — software engineering, systems and applied AI'
/** Declared so the first share renders the large card before the scraper fetches the file. */
export const DEFAULT_OG_META = { type: 'image/jpeg', width: '1200', height: '630' } as const
export const AUTHOR_SAME_AS = [
  'https://github.com/Marcus-Boni',
  'https://www.linkedin.com/in/marcus-boni-729a52243',
] as const
export const BLOG_TITLE = `Blog de engenharia de software — ${SITE_NAME}`
export const BLOG_DESCRIPTION = 'Artigos sobre engenharia de software, arquitetura, inteligência artificial e bastidores de projetos, por Marcus Boni.'
export const BLOG_TITLE_EN = `Software engineering journal — ${SITE_NAME}`
export const BLOG_DESCRIPTION_EN = 'Articles on software engineering, architecture, applied AI and project post-mortems, by Marcus Boni.'
export const ASK_TITLE_PT = `Dossiê interativo — ${SITE_NAME}`
export const ASK_DESCRIPTION_PT = 'Consulte a trajetória, projetos, stack e entregas em produção de Marcus Boni ou cole uma vaga (/fit) para mapear evidências reais.'
export const ASK_TITLE_EN = `Interactive dossier — ${SITE_NAME}`
export const ASK_DESCRIPTION_EN = 'Query Marcus Boni’s stack, repositories, and production client work, or paste a job description (/fit) for an evidence-based role brief.'

export interface SeoPost {
  slug: string
  lang: BlogLocale
  status: string
  title: string
  excerpt: string
  subtitle?: string
  coverUrl?: string | null
  coverAlt?: string
  coverWidth?: number
  coverHeight?: number
  cover?: { src: string; alt?: string; caption?: string; width?: number; height?: number } | null
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

export function askTitle(lang: BlogLocale = 'pt'): string {
  return lang === 'en' ? ASK_TITLE_EN : ASK_TITLE_PT
}

export function askDescription(lang: BlogLocale = 'pt'): string {
  return lang === 'en' ? ASK_DESCRIPTION_EN : ASK_DESCRIPTION_PT
}

export function askPath(lang: BlogLocale = 'pt'): string {
  return lang === 'en' ? '/en/ask' : '/ask'
}

export function askUrl(lang: BlogLocale = 'pt'): string {
  return `${SITE_URL}${askPath(lang)}`
}

export function askAlternates(): HreflangAlternate[] {
  return [
    { hreflang: 'pt-BR', href: askUrl('pt') },
    { hreflang: 'en', href: askUrl('en') },
    { hreflang: 'x-default', href: askUrl('pt') },
  ]
}

export function defaultOgAlt(lang: BlogLocale = 'pt'): string {
  return lang === 'en' ? DEFAULT_OG_ALT_EN : DEFAULT_OG_ALT_PT
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

/** Infer MIME type from image URL path so social scrapers render cards on first fetch. */
export function imageMimeType(url: string | undefined): string | undefined {
  if (!url) return undefined
  const clean = url.split(/[?#]/)[0].toLowerCase()
  if (clean.endsWith('.webp')) return 'image/webp'
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg'
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.avif')) return 'image/avif'
  return undefined
}

/** Estimate readable word count from Markdown source for `BlogPosting.wordCount`. */
export function countMarkdownWords(markdown: string | undefined): number {
  if (!markdown) return 0
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^:::+[^\n]*$/gm, ' ')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain ? plain.split(' ').filter(Boolean).length : 0
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

const AUTHOR_ENTITY = {
  '@type': 'Person',
  '@id': `${SITE_URL}/about#person`,
  name: SITE_NAME,
  url: `${SITE_URL}/about`,
  jobTitle: 'Software Engineer',
  sameAs: [...AUTHOR_SAME_AS],
} as const

export function articleSchema(
  post: SeoPost,
  lang?: BlogLocale,
  options: { wordCount?: number } = {},
) {
  const view = localizedMeta(post, lang ?? post.lang)
  const url = postCanonicalUrl(post, view.lang)
  const coverUrl = safeImage(post.coverUrl ?? post.cover?.src)
  const width = post.coverWidth ?? post.cover?.width
  const height = post.coverHeight ?? post.cover?.height
  const image = coverUrl
    ? {
        '@type': 'ImageObject',
        url: coverUrl,
        ...(width && width > 0 ? { width } : {}),
        ...(height && height > 0 ? { height } : {}),
        ...(view.coverAlt ? { caption: view.coverAlt } : {}),
      }
    : undefined
  const wordCount = options.wordCount && options.wordCount > 0 ? options.wordCount : undefined
  const timeRequired = view.readingMinutes > 0 ? `PT${view.readingMinutes}M` : undefined

  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    url,
    headline: view.title,
    description: view.excerpt || view.subtitle || view.title,
    image,
    datePublished: validDate(post.publishedAt),
    dateModified: validDate(post.updatedAt),
    inLanguage: view.lang === 'pt' ? 'pt-BR' : 'en',
    articleSection: view.tags[0] || undefined,
    keywords: view.tags.length ? view.tags.join(', ') : undefined,
    wordCount,
    timeRequired,
    isAccessibleForFree: true,
    author: AUTHOR_ENTITY,
    publisher: {
      '@type': 'Person',
      '@id': `${SITE_URL}/about#person`,
      name: SITE_NAME,
      url: `${SITE_URL}/about`,
    },
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
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: indexHref },
      { '@type': 'ListItem', position: 3, name: view.title, item: postCanonicalUrl(post, view.lang) },
    ],
  }
}

export function blogIndexBreadcrumbSchema(lang: BlogLocale = 'pt') {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: lang === 'en' ? 'Journal' : 'Blog', item: blogIndexUrl(lang) },
    ],
  }
}

export function blogSchema(posts: SeoPost[] = [], lang: BlogLocale = 'pt') {
  const published = posts.filter((post) => post.status === 'published')
  const entries = collapseLegacyPairs(published, lang)
  const indexHref = blogIndexUrl(lang)
  return {
    '@type': 'Blog',
    '@id': `${indexHref}#blog`,
    url: indexHref,
    name: blogTitle(lang),
    description: blogDescription(lang),
    inLanguage: lang === 'en' ? ['en', 'pt-BR'] : ['pt-BR', 'en'],
    author: AUTHOR_ENTITY,
    publisher: {
      '@type': 'Person',
      '@id': `${SITE_URL}/about#person`,
      name: SITE_NAME,
      url: `${SITE_URL}/about`,
    },
    blogPost: entries.map(({ post }) => {
      const view = localizedMeta(post, lang)
      const url = postCanonicalUrl(post, lang)
      return {
        '@type': 'BlogPosting',
        '@id': `${url}#article`,
        headline: view.title,
        url,
        datePublished: validDate(post.publishedAt),
        dateModified: validDate(post.updatedAt),
        inLanguage: view.lang === 'pt' ? 'pt-BR' : 'en',
        author: { '@id': `${SITE_URL}/about#person` },
      }
    }),
  }
}

export function askSchema(lang: BlogLocale = 'pt') {
  const url = askUrl(lang)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: askTitle(lang),
        description: askDescription(lang),
        inLanguage: lang === 'en' ? 'en' : 'pt-BR',
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/about#person` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: SITE_URL },
          {
            '@type': 'ListItem',
            position: 2,
            name: lang === 'en' ? 'Interactive dossier' : 'Dossiê interativo',
            item: url,
          },
        ],
      },
    ],
  }
}
