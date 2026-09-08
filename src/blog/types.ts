import type { Locale } from '@/i18n/translations'

/**
 * Publication state. `unlisted` is deliberate: it keeps a post reachable by
 * direct link (for sharing a study inside a company meeting) while excluding
 * it from the index, the RSS feed and the sitemap.
 */
export type PostStatus = 'draft' | 'unlisted' | 'published'

/** Every status that a non-admin visitor is allowed to fetch. */
export const READABLE_STATUSES: readonly PostStatus[] = ['published', 'unlisted']

/**
 * One responsive image, fully resolved at upload time by `blog/lib/media.ts`.
 * The browser downscales and re-encodes to WebP before anything reaches
 * Storage, so no Cloud Function or image CDN sits in the path.
 */
export interface MediaRef {
  /** Largest variant — the `src` fallback for browsers without srcset. */
  src: string
  /** Ascending widths, rendered into a `srcset` attribute. */
  variants: { width: number; url: string }[]
  /** ~20px WebP data URI painted under the image while it loads. */
  lqip: string
  /** Intrinsic size of the largest variant, used to reserve space (CLS = 0). */
  width: number
  height: number
  alt: string
  caption?: string
  /** Storage path prefix, kept so the admin can delete every variant at once. */
  storagePath?: string
}

/** Grouping for multi-part write-ups ("Estudos de mercado", "Bastidores"). */
export interface PostSeries {
  id: string
  title: string
  order: number
}

/**
 * Post metadata — the `posts/{slug}` document.
 *
 * The Markdown body deliberately lives in a subcollection
 * (`posts/{slug}/content/main`) so listing the index does not download every
 * post's full text, and so the SEO edge function can resolve a post's `<head>`
 * with a single REST read.
 */
export interface PostMeta {
  /** Also the document id — URLs are `/blog/{slug}`. */
  slug: string
  /** Posts are written in one language; `translationOf` pairs them up. */
  lang: Locale
  status: PostStatus
  title: string
  /** Editorial dek shown under the title. */
  subtitle?: string
  /** Plain text, <= 200 chars. Feeds cards, meta description and RSS. */
  excerpt: string
  cover?: MediaRef
  tags: string[]
  series?: PostSeries
  /** Derived from the body on save — never hand-edited. */
  readingMinutes: number
  /** ISO string; `null` until the post is first published. */
  publishedAt: string | null
  updatedAt: string
  /** Slug of the counterpart in the other language, when one exists. */
  translationOf?: string
  /** Pins the post to the index hero slot. */
  featured?: boolean
}

/** The `posts/{slug}/content/main` document. */
export interface PostBody {
  /** Markdown source — the single source of truth for the post's content. */
  body: string
  /**
   * Mirrored from the parent so security rules can gate reads without a
   * `get()` lookup (which would bill an extra read per request). Written in
   * the same batch as the parent, so the two cannot drift.
   */
  status: PostStatus
  /**
   * Images used in the body, keyed by id. The Markdown references them as
   * `![alt](media:{id})` rather than a bare URL, so the renderer can emit a
   * full `srcset` plus the blur-up placeholder — impossible from a plain
   * `![alt](https://…)`. External URLs still work and render as plain images.
   */
  media?: Record<string, MediaRef>
}

/** Metadata + body, as consumed by the post page and the admin editor. */
export interface Post extends PostMeta, PostBody {}

/** A heading extracted from the body to build the table of contents. */
export interface TocEntry {
  id: string
  text: string
  depth: 2 | 3
}

/** Filters accepted by the public index. */
export interface PostQuery {
  lang?: Locale | 'all'
  tag?: string
  limit?: number
}

/** A fresh, unsaved post. Kept here so admin and service agree on defaults. */
export function emptyPost(lang: Locale): Post {
  return {
    slug: '',
    lang,
    status: 'draft',
    title: '',
    subtitle: '',
    excerpt: '',
    tags: [],
    readingMinutes: 0,
    publishedAt: null,
    updatedAt: new Date().toISOString(),
    body: '',
  }
}
