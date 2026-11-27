import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore'

import type { Locale } from '@/i18n/translations'
import { db, isFirebaseConfigured, requireDb } from '@/lib/firebase'
import { BLOG_LOCALES, type PostBodies, type PostLocaleMeta, type PostLocales } from '../../netlify/lib/blog-locale'

import { autoExcerpt, readingMinutes } from './lib/text'
import type { Post, PostBody, PostMeta } from './types'

/**
 * Firestore access for the blog.
 *
 * Layout:
 *   posts/{slug}                → PostMeta   (light; includes `locales` for PT/EN)
 *   posts/{slug}/content/main   → PostBody   (includes `bodies` for PT/EN + shared media)
 *
 * The split is what keeps the index cheap: listing 40 posts downloads 40 small
 * metadata docs instead of 40 full articles. Putting both languages inside the
 * same publication eliminates duplicate posts while keeping language switches
 * instantaneous and read-free.
 *
 * This module imports the Firebase SDK, so public code must reach it through a
 * dynamic `import()` (see `usePosts.ts` / `PostsContext.tsx`), never a top-level import.
 */

const POSTS = 'posts'
const BODY_DOC = ['content', 'main'] as const
const publishedBodyCache = new Map<string, PostBodies>()

function metaRef(slug: string) {
  return doc(requireDb(), POSTS, slug)
}

function bodyRef(slug: string) {
  return doc(requireDb(), POSTS, slug, ...BODY_DOC)
}

function cleanTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

/** Normalizes stored per-language metadata, backfilling the primary language for older docs. */
function normalizeLocales(
  data: Partial<PostMeta>,
  primaryLang: Locale,
  primaryTitle: string,
  primarySubtitle: string,
  primaryExcerpt: string,
  primaryTags: string[],
  primaryMinutes: number,
): PostLocales {
  const out: PostLocales = {}
  const stored = data.locales
  if (stored && typeof stored === 'object') {
    for (const locale of BLOG_LOCALES) {
      const entry = stored[locale]
      if (!entry || typeof entry !== 'object') continue
      const title = typeof entry.title === 'string' ? entry.title : ''
      const subtitle = typeof entry.subtitle === 'string' ? entry.subtitle : ''
      const excerpt = typeof entry.excerpt === 'string' ? entry.excerpt : ''
      const tags = cleanTags(entry.tags)
      if (!title.trim() && !subtitle.trim() && !excerpt.trim() && tags.length === 0) continue
      out[locale] = {
        title,
        subtitle,
        excerpt,
        tags,
        readingMinutes: typeof entry.readingMinutes === 'number' ? entry.readingMinutes : 1,
        ...(typeof entry.coverAlt === 'string' && entry.coverAlt ? { coverAlt: entry.coverAlt } : {}),
        ...(typeof entry.coverCaption === 'string' && entry.coverCaption
          ? { coverCaption: entry.coverCaption }
          : {}),
      }
    }
  }
  if (!out[primaryLang]) {
    out[primaryLang] = {
      title: primaryTitle,
      subtitle: primarySubtitle,
      excerpt: primaryExcerpt,
      tags: primaryTags,
      readingMinutes: primaryMinutes,
    }
  }
  return out
}

/** Fills in fields a stored doc may predate, so the UI never sees `undefined`. */
function normalizeMeta(slug: string, data: Partial<PostMeta>): PostMeta {
  const lang: Locale = data.lang === 'en' ? 'en' : 'pt'
  const title = data.title ?? '(sem título)'
  const subtitle = data.subtitle ?? ''
  const excerpt = data.excerpt ?? ''
  const tags = cleanTags(data.tags)
  const minutes = data.readingMinutes ?? 1
  const locales = normalizeLocales(data, lang, title, subtitle, excerpt, tags, minutes)
  const primary = locales[lang]

  return {
    slug,
    lang,
    status: data.status ?? 'draft',
    title: primary?.title || title,
    subtitle: primary?.subtitle ?? subtitle,
    excerpt: primary?.excerpt ?? excerpt,
    cover: data.cover,
    tags: primary?.tags ?? tags,
    series: data.series,
    readingMinutes: primary?.readingMinutes ?? minutes,
    publishedAt: data.publishedAt ?? null,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
    locales,
    translationOf: data.translationOf,
    featured: data.featured ?? false,
  }
}

/**
 * Published posts, newest first.
 *
 * Tag filtering and localization happen client-side on purpose: a personal blog
 * stays well inside a single page of metadata, and filtering locally means one
 * composite index instead of one per filter combination, plus instant
 * (read-free) switches in the UI.
 */
export async function fetchPublishedPosts(max?: number): Promise<PostMeta[]> {
  if (!isFirebaseConfigured || !db) return []
  const snap = await getDocs(
    query(
      collection(db, POSTS),
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc'),
      ...(max === undefined ? [] : [limitTo(max)]),
    ),
  )
  return snap.docs.map((d) => normalizeMeta(d.id, d.data() as Partial<PostMeta>))
}

/**
 * Fetches Markdown bodies for published posts (used lazily by the Dossier
 * console to index article sections and `#heading` anchors).
 *
 * Results are memoized in memory for the browser session so reopening `⌘K` or
 * switching routes never bills duplicate Firestore reads.
 */
export async function fetchPublishedPostBodies(
  posts: readonly Pick<PostMeta, 'slug' | 'lang'>[],
  max = 15,
): Promise<Record<string, PostBodies>> {
  const out: Record<string, PostBodies> = {}
  if (!isFirebaseConfigured || !db) return out

  const target = posts.slice(0, max)
  const missing: Pick<PostMeta, 'slug' | 'lang'>[] = []
  for (const post of target) {
    const cached = publishedBodyCache.get(post.slug)
    if (cached) out[post.slug] = cached
    else missing.push(post)
  }

  if (missing.length === 0) return out

  const settled = await Promise.allSettled(
    missing.map(async (post) => {
      const snap = await getDoc(bodyRef(post.slug))
      if (!snap.exists()) return { slug: post.slug, bodies: {} as PostBodies }
      const stored = snap.data() as PostBody | undefined
      const bodies: PostBodies = {}
      if (stored?.bodies && typeof stored.bodies === 'object') {
        for (const locale of BLOG_LOCALES) {
          if (typeof stored.bodies[locale] === 'string') {
            bodies[locale] = stored.bodies[locale]
          }
        }
      }
      if (bodies[post.lang] === undefined && typeof stored?.body === 'string') {
        bodies[post.lang] = stored.body
      }
      return { slug: post.slug, bodies }
    }),
  )

  for (const result of settled) {
    if (result.status !== 'fulfilled') continue
    publishedBodyCache.set(result.value.slug, result.value.bodies)
    out[result.value.slug] = result.value.bodies
  }

  return out
}

/** Every post including drafts — admin only; rules reject this when signed out. */
export async function fetchAllPosts(max = 300): Promise<PostMeta[]> {
  if (!isFirebaseConfigured || !db) return []
  const snap = await getDocs(
    query(collection(db, POSTS), orderBy('updatedAt', 'desc'), limitTo(max)),
  )
  return snap.docs.map((d) => normalizeMeta(d.id, d.data() as Partial<PostMeta>))
}

/**
 * One post with its body (all languages). Returns `null` for "no such post" —
 * which includes a draft requested by a signed-out visitor, since the rules
 * reject that read and a 404 is the right answer for someone with no business
 * seeing it.
 *
 * Any other failure (offline, quota) is rethrown so the page can show a retry
 * instead of claiming the post does not exist.
 */
export async function fetchPost(slug: string): Promise<Post | null> {
  if (!isFirebaseConfigured || !db) return null
  try {
    const [metaSnap, bodySnap] = await Promise.all([
      getDoc(metaRef(slug)),
      getDoc(bodyRef(slug)),
    ])
    if (!metaSnap.exists()) return null
    const meta = normalizeMeta(slug, metaSnap.data() as Partial<PostMeta>)
    const stored = bodySnap.data() as PostBody | undefined
    const bodies: PostBodies = {}
    if (stored?.bodies && typeof stored.bodies === 'object') {
      for (const locale of BLOG_LOCALES) {
        if (typeof stored.bodies[locale] === 'string') {
          bodies[locale] = stored.bodies[locale]
        }
      }
    }
    if (bodies[meta.lang] === undefined) {
      bodies[meta.lang] = stored?.body ?? ''
    }
    const primaryBody = bodies[meta.lang] ?? stored?.body ?? ''

    return {
      ...meta,
      body: primaryBody,
      bodies,
      media: stored?.media ?? {},
      status: meta.status,
    }
  } catch (error) {
    if (isPermissionDenied(error)) return null
    throw error
  }
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'permission-denied'
  )
}

function localeHasContent(meta: PostLocaleMeta | undefined, body: string): boolean {
  return Boolean(
    meta?.title.trim() ||
      meta?.subtitle?.trim() ||
      meta?.excerpt.trim() ||
      (meta?.tags && meta.tags.length > 0) ||
      body.trim(),
  )
}

/**
 * Writes metadata (all locales) and bodies atomically.
 *
 * `status` is mirrored onto the body doc so security rules can gate it without
 * a `get()` on the parent — a rules `get()` bills a document read on every
 * single request. The batch is what guarantees the two copies never diverge.
 */
export async function savePost(post: Post): Promise<void> {
  const database = requireDb()
  if (!post.slug) throw new Error('Post precisa de um slug.')

  const now = new Date().toISOString()

  // Assemble clean per-language metadata and bodies.
  const rawLocales: PostLocales = { ...(post.locales ?? {}) }
  const rawBodies: PostBodies = { ...(post.bodies ?? {}) }
  if (!rawLocales[post.lang]) {
    rawLocales[post.lang] = {
      title: post.title,
      subtitle: post.subtitle,
      excerpt: post.excerpt,
      tags: post.tags,
      readingMinutes: post.readingMinutes,
    }
  }
  if (rawBodies[post.lang] === undefined) {
    rawBodies[post.lang] = post.body
  }

  const locales: PostLocales = {}
  const bodies: PostBodies = {}
  for (const locale of BLOG_LOCALES) {
    const entry = rawLocales[locale]
    const body = rawBodies[locale] ?? ''
    if (!localeHasContent(entry, body)) continue
    const title = entry?.title.trim() ?? ''
    const subtitle = entry?.subtitle?.trim() || undefined
    const excerpt = entry?.excerpt.trim() || (body.trim() ? autoExcerpt(body) : '')
    const tags = cleanTags(entry?.tags)
    const minutes = body.trim() ? readingMinutes(body) : 1
    locales[locale] = {
      title,
      subtitle,
      excerpt,
      tags,
      readingMinutes: minutes,
      coverAlt: entry?.coverAlt?.trim() || undefined,
      coverCaption: entry?.coverCaption?.trim() || undefined,
    }
    bodies[locale] = body
  }

  // Portuguese is the primary language whenever present; otherwise English.
  const primaryLang: Locale = locales.pt ? 'pt' : locales.en ? 'en' : post.lang
  const primaryMeta = locales[primaryLang] ?? {
    title: post.title.trim(),
    subtitle: post.subtitle?.trim() || undefined,
    excerpt: post.excerpt.trim(),
    tags: cleanTags(post.tags),
    readingMinutes: readingMinutes(post.body),
  }
  const primaryBody = bodies[primaryLang] ?? post.body
  if (!locales[primaryLang]) locales[primaryLang] = primaryMeta
  if (bodies[primaryLang] === undefined) bodies[primaryLang] = primaryBody

  const bilingual = Boolean(locales.pt && locales.en)

  const meta: PostMeta = {
    slug: post.slug,
    lang: primaryLang,
    status: post.status,
    title: primaryMeta.title,
    subtitle: primaryMeta.subtitle,
    excerpt: primaryMeta.excerpt,
    cover: post.cover,
    tags: primaryMeta.tags,
    series: post.series,
    readingMinutes: primaryMeta.readingMinutes,
    // First publish stamps the date; re-publishing keeps the original.
    publishedAt:
      post.status === 'draft'
        ? post.publishedAt
        : (post.publishedAt ?? now),
    updatedAt: now,
    locales,
    // Unified bilingual posts carry both languages internally, so clear any legacy pair link.
    translationOf: bilingual ? undefined : (post.translationOf || undefined),
    featured: post.featured ?? false,
  }

  const batch = writeBatch(database)
  batch.set(doc(database, POSTS, post.slug), stripUndefinedDeep(meta))
  batch.set(
    doc(database, POSTS, post.slug, ...BODY_DOC),
    stripUndefinedDeep({
      body: primaryBody,
      bodies,
      status: post.status,
      media: post.media ?? {},
    }),
  )
  await batch.commit()
  publishedBodyCache.delete(post.slug)
}

/** Removes the post and its body document. */
export async function deletePost(slug: string): Promise<void> {
  const database = requireDb()
  const batch = writeBatch(database)
  batch.delete(doc(database, POSTS, slug, ...BODY_DOC))
  batch.delete(doc(database, POSTS, slug))
  await batch.commit()
  publishedBodyCache.delete(slug)
}

/** True when the slug is already taken — the editor checks before a rename. */
export async function slugExists(slug: string): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false
  const snap = await getDoc(metaRef(slug))
  return snap.exists()
}

/**
 * Firestore rejects `undefined` field values anywhere in a document tree, and
 * optional metadata (no cover, no series, empty subtitle in one locale)
 * legitimately produces them.
 */
function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (entry !== undefined) {
        out[key] = stripUndefinedDeep(entry)
      }
    }
    return out as T
  }
  return value
}
