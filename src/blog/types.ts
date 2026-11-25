import type { Locale } from '@/i18n/translations'
import type { PostBodies, PostLocaleMeta, PostLocales } from '../../netlify/lib/blog-locale'

export type { PostBodies, PostLocaleMeta, PostLocales }

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
 * One publication = one document, optionally carrying both Portuguese and
 * English metadata inside `locales`. The top-level fields (`lang`, `title`,
 * `subtitle`, `excerpt`, `tags`, `readingMinutes`) mirror the primary language
 * so existing queries, legacy documents, and console inspections keep working.
 *
 * The Markdown bodies live in a subcollection (`posts/{slug}/content/main`) so
 * listing the index does not download every post's full text, and so the SEO
 * edge function can resolve a post's `<head>` with a single REST read.
 */
export interface PostMeta {
  /** Also the document id — PT lives at `/blog/{slug}`, EN at `/en/blog/{slug}` when bilingual. */
  slug: string
  /** Primary / default language (`pt` whenever PT exists, otherwise `en`). */
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
  /** Derived from the primary body on save — never hand-edited. */
  readingMinutes: number
  /** ISO string; `null` until the post is first published. */
  publishedAt: string | null
  updatedAt: string
  /** Per-language metadata (`pt`, `en`) carried by this single publication. */
  locales?: PostLocales
  /** Legacy slug of a separate counterpart post (kept only for pre-unification docs). */
  translationOf?: string
  /** Pins the post to the index hero slot. */
  featured?: boolean
}

/** The `posts/{slug}/content/main` document. */
export interface PostBody {
  /** Primary language Markdown source (kept for backward compatibility). */
  body: string
  /**
   * Per-language Markdown sources (`{ pt?: string, en?: string }`).
   * Keeping both in the same `content/main` document lets the reader switch
   * between PT and EN instantaneously with zero extra Firestore reads.
   */
  bodies?: PostBodies
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
  /** Reading time of the section a depth-2 heading opens. */
  minutes?: number
}

/** Filters accepted by the public index. */
export interface PostQuery {
  tag?: string
  limit?: number
}

/** A fresh, unsaved post. Kept here so admin and service agree on defaults. */
export function emptyPost(lang: Locale = 'pt'): Post {
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
