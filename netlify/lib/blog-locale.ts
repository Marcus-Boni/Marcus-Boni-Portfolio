/**
 * Pure bilingual post helpers shared across the browser app, admin editor, and
 * Netlify edge functions. Zero Deno globals, zero DOM, zero runtime deps.
 *
 * One publication = one Firestore document (`posts/{slug}`) that can hold
 * Portuguese (`pt`), English (`en`), or both. Public URLs remain distinct per
 * language for SEO and social sharing:
 *   • Bilingual post: `/blog/{slug}` (PT, default) and `/en/blog/{slug}` (EN)
 *   • Single-language post: `/blog/{slug}` (in whichever language it was written)
 *
 * Legacy separate posts linked via reciprocal `translationOf` are also
 * supported so existing Firestore entries keep working and stop duplicating
 * in the public index before the author unifies them in `/admin/blog`.
 */

export type BlogLocale = 'pt' | 'en'

export const BLOG_LOCALES: readonly BlogLocale[] = ['pt', 'en']

/** Per-language metadata kept light on `posts/{slug}` for index listing. */
export interface PostLocaleMeta {
  title: string
  subtitle?: string
  excerpt: string
  tags: string[]
  readingMinutes: number
  coverAlt?: string
  coverCaption?: string
}

export type PostLocales = Partial<Record<BlogLocale, PostLocaleMeta>>
export type PostBodies = Partial<Record<BlogLocale, string>>

/** Minimum post metadata shape shared by client `PostMeta` and edge `EdgePost`. */
export interface LocalizablePost {
  slug: string
  lang: BlogLocale
  status: string
  title: string
  subtitle?: string
  excerpt: string
  tags: string[]
  readingMinutes?: number
  coverAlt?: string
  cover?: { src: string; alt?: string; caption?: string } | null
  locales?: PostLocales
  translationOf?: string | null
  publishedAt?: string | null
  updatedAt?: string
}

export interface LocalizedPostView {
  lang: BlogLocale
  title: string
  subtitle: string
  excerpt: string
  tags: string[]
  readingMinutes: number
  coverAlt: string
  coverCaption?: string
  availableLangs: BlogLocale[]
  /** True when the requested locale was unavailable and the view fell back. */
  isFallback: boolean
}

export interface CollapsedEntry<T extends LocalizablePost> {
  /** The post record representing this unique publication in the chosen locale. */
  post: T
  /** Canonical slug used for ordinals, plates, and reading progress. */
  canonicalSlug: string
  /** All languages this publication can be read in (`['pt', 'en']`, `['pt']`, or `['en']`). */
  availableLangs: BlogLocale[]
  /** Legacy counterpart post, only populated when two separate docs were paired via `translationOf`. */
  legacyCounterpart?: T
}

function hasText(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

/** Ensures `locales` always includes at least the post's primary language. */
export function normalizePostLocales(post: LocalizablePost): PostLocales {
  const out: PostLocales = {}
  for (const locale of BLOG_LOCALES) {
    const entry = post.locales?.[locale]
    if (entry && hasText(entry.title)) {
      out[locale] = {
        title: entry.title,
        subtitle: entry.subtitle ?? '',
        excerpt: entry.excerpt ?? '',
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        readingMinutes: entry.readingMinutes ?? post.readingMinutes ?? 1,
        ...(entry.coverAlt !== undefined ? { coverAlt: entry.coverAlt } : {}),
        ...(entry.coverCaption !== undefined ? { coverCaption: entry.coverCaption } : {}),
      }
    }
  }
  if (!out[post.lang]) {
    out[post.lang] = {
      title: post.title,
      subtitle: post.subtitle ?? '',
      excerpt: post.excerpt ?? '',
      tags: Array.isArray(post.tags) ? post.tags : [],
      readingMinutes: post.readingMinutes ?? 1,
    }
  }
  return out
}

/** Languages this single post document carries, in canonical order (`pt`, `en`). */
export function availableLangs(post: LocalizablePost): BlogLocale[] {
  const locales = normalizePostLocales(post)
  return BLOG_LOCALES.filter((locale) => Boolean(locales[locale]))
}

export function hasLocale(post: LocalizablePost, locale: BlogLocale): boolean {
  return availableLangs(post).includes(locale)
}

/** True when one post document natively holds both PT and EN. */
export function isBilingual(post: LocalizablePost): boolean {
  return availableLangs(post).length === 2
}

/** Default language of a post (`pt` when Portuguese exists, otherwise `en`). */
export function primaryLang(post: LocalizablePost): BlogLocale {
  const langs = availableLangs(post)
  return langs.includes('pt') ? 'pt' : (langs[0] ?? post.lang)
}

/** Resolves the best available language for a requested locale. */
export function resolvePostLocale(post: LocalizablePost, preferred: BlogLocale): BlogLocale {
  return hasLocale(post, preferred) ? preferred : primaryLang(post)
}

/** Projects a post's metadata into `preferred`, falling back cleanly when monolingual. */
export function localizedMeta(post: LocalizablePost, preferred: BlogLocale): LocalizedPostView {
  const locales = normalizePostLocales(post)
  const langs = BLOG_LOCALES.filter((locale) => Boolean(locales[locale]))
  const resolved = locales[preferred] ? preferred : primaryLang(post)
  const entry = locales[resolved]!
  const fallbackAlt = post.coverAlt ?? post.cover?.alt ?? ''
  const fallbackCaption = post.cover?.caption

  return {
    lang: resolved,
    title: entry.title,
    subtitle: entry.subtitle ?? '',
    excerpt: entry.excerpt ?? '',
    tags: entry.tags,
    readingMinutes: entry.readingMinutes,
    coverAlt: entry.coverAlt?.trim() || fallbackAlt,
    coverCaption: entry.coverCaption?.trim() || fallbackCaption,
    availableLangs: langs,
    isFallback: resolved !== preferred,
  }
}

/** Resolves the Markdown body for `preferred` (falling back to the primary body). */
export function localizedBody(
  post: LocalizablePost & { body: string; bodies?: PostBodies },
  preferred: BlogLocale,
): string {
  const resolved = resolvePostLocale(post, preferred)
  const stored = post.bodies?.[resolved]
  if (typeof stored === 'string' && stored.length > 0) return stored
  if (resolved === post.lang) return post.body
  return post.bodies?.[post.lang] ?? post.body
}

/** Public path of the journal index for a language. */
export function blogIndexPath(lang: BlogLocale): string {
  return lang === 'en' ? '/en/blog' : '/blog'
}

/**
 * Public path of a post in `lang`.
 *
 * Bilingual posts have `/blog/{slug}` (PT) and `/en/blog/{slug}` (EN).
 * Single-language posts always live at `/blog/{slug}` regardless of whether
 * they are written in PT or EN, preserving existing URLs and avoiding empty
 * alternate routes.
 */
export function postPath(post: LocalizablePost, lang?: BlogLocale): string {
  const encoded = encodeURIComponent(post.slug)
  if (isBilingual(post) && lang === 'en') return `/en/blog/${encoded}`
  return `/blog/${encoded}`
}

/** True when two legacy single-language posts point reciprocally at each other. */
export function isLegacyPair(a: LocalizablePost, b?: LocalizablePost | null): boolean {
  return Boolean(
    b &&
      !isBilingual(a) &&
      !isBilingual(b) &&
      a.status === b.status &&
      a.lang !== b.lang &&
      a.translationOf === b.slug &&
      b.translationOf === a.slug,
  )
}

/**
 * Collapses any legacy separate PT/EN posts paired via reciprocal
 * `translationOf` into one entry per publication, while leaving unified
 * bilingual posts untouched.
 *
 * The list order is preserved using the first appearance of each publication.
 */
export function collapseLegacyPairs<T extends LocalizablePost>(
  posts: readonly T[],
  preferred: BlogLocale,
): CollapsedEntry<T>[] {
  const bySlug = new Map(posts.map((post) => [post.slug, post]))
  const consumed = new Set<string>()
  const entries: CollapsedEntry<T>[] = []

  for (const post of posts) {
    if (consumed.has(post.slug)) continue

    if (!isBilingual(post) && post.translationOf) {
      const counterpart = bySlug.get(post.translationOf)
      if (counterpart && !consumed.has(counterpart.slug) && isLegacyPair(post, counterpart)) {
        consumed.add(post.slug)
        consumed.add(counterpart.slug)
        const ptPost = post.lang === 'pt' ? post : counterpart
        const enPost = post.lang === 'en' ? post : counterpart
        const chosen = preferred === 'en' ? enPost : ptPost
        const other = chosen === ptPost ? enPost : ptPost
        entries.push({
          post: chosen,
          canonicalSlug: ptPost.slug,
          availableLangs: ['pt', 'en'],
          legacyCounterpart: other,
        })
        continue
      }
    }

    consumed.add(post.slug)
    entries.push({
      post,
      canonicalSlug: post.slug,
      availableLangs: availableLangs(post),
    })
  }

  return entries
}

/** Finds reciprocal legacy PT/EN pairs in an admin post list for one-click merging. */
export function findLegacyPairs<T extends LocalizablePost>(
  posts: readonly T[],
): { pt: T; en: T }[] {
  const bySlug = new Map(posts.map((post) => [post.slug, post]))
  const seen = new Set<string>()
  const pairs: { pt: T; en: T }[] = []

  for (const post of posts) {
    if (seen.has(post.slug) || isBilingual(post) || !post.translationOf) continue
    const counterpart = bySlug.get(post.translationOf)
    if (
      counterpart &&
      !seen.has(counterpart.slug) &&
      !isBilingual(counterpart) &&
      post.lang !== counterpart.lang &&
      post.translationOf === counterpart.slug &&
      counterpart.translationOf === post.slug
    ) {
      seen.add(post.slug)
      seen.add(counterpart.slug)
      pairs.push(
        post.lang === 'pt' ? { pt: post, en: counterpart } : { pt: counterpart, en: post },
      )
    }
  }

  return pairs
}
