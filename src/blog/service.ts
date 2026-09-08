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

import { db, isFirebaseConfigured, requireDb } from '@/lib/firebase'

import { readingMinutes } from './lib/text'
import type { Post, PostBody, PostMeta } from './types'

/**
 * Firestore access for the blog.
 *
 * Layout:
 *   posts/{slug}                → PostMeta   (light; what the index lists)
 *   posts/{slug}/content/main   → PostBody   (the Markdown source)
 *
 * The split is what keeps the index cheap: listing 40 posts downloads 40 small
 * metadata docs instead of 40 full articles. It also lets the SEO edge function
 * build a post's `<head>` from one REST read.
 *
 * This module imports the Firebase SDK, so public code must reach it through a
 * dynamic `import()` (see `BlogDataContext`), never a top-level import.
 */

const POSTS = 'posts'
const BODY_DOC = ['content', 'main'] as const

function metaRef(slug: string) {
  return doc(requireDb(), POSTS, slug)
}

function bodyRef(slug: string) {
  return doc(requireDb(), POSTS, slug, ...BODY_DOC)
}

/** Fills in fields a stored doc may predate, so the UI never sees `undefined`. */
function normalizeMeta(slug: string, data: Partial<PostMeta>): PostMeta {
  return {
    slug,
    lang: data.lang === 'en' ? 'en' : 'pt',
    status: data.status ?? 'draft',
    title: data.title ?? '(sem título)',
    subtitle: data.subtitle ?? '',
    excerpt: data.excerpt ?? '',
    cover: data.cover,
    tags: Array.isArray(data.tags) ? data.tags : [],
    series: data.series,
    readingMinutes: data.readingMinutes ?? 1,
    publishedAt: data.publishedAt ?? null,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
    translationOf: data.translationOf,
    featured: data.featured ?? false,
  }
}

/**
 * Published posts, newest first.
 *
 * Language and tag filtering happen client-side on purpose: a personal blog
 * stays well inside a single page of metadata, and filtering locally means one
 * composite index instead of one per filter combination, plus instant
 * (read-free) filter switches in the UI.
 */
export async function fetchPublishedPosts(max = 100): Promise<PostMeta[]> {
  if (!isFirebaseConfigured || !db) return []
  const snap = await getDocs(
    query(
      collection(db, POSTS),
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc'),
      limitTo(max),
    ),
  )
  return snap.docs.map((d) => normalizeMeta(d.id, d.data() as Partial<PostMeta>))
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
 * One post with its body. Returns `null` for "no such post" — which includes a
 * draft requested by a signed-out visitor, since the rules reject that read and
 * a 404 is the right answer for someone with no business seeing it.
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
    return {
      ...meta,
      body: stored?.body ?? '',
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

/**
 * Writes metadata and body atomically.
 *
 * `status` is mirrored onto the body doc so security rules can gate it without
 * a `get()` on the parent — a rules `get()` bills a document read on every
 * single request. The batch is what guarantees the two copies never diverge.
 */
export async function savePost(post: Post): Promise<void> {
  const database = requireDb()
  if (!post.slug) throw new Error('Post precisa de um slug.')

  const now = new Date().toISOString()
  const meta: PostMeta = {
    slug: post.slug,
    lang: post.lang,
    status: post.status,
    title: post.title.trim(),
    subtitle: post.subtitle?.trim() || undefined,
    excerpt: post.excerpt.trim(),
    cover: post.cover,
    tags: post.tags.map((tag) => tag.trim()).filter(Boolean),
    series: post.series,
    readingMinutes: readingMinutes(post.body),
    // First publish stamps the date; re-publishing keeps the original.
    publishedAt:
      post.status === 'draft'
        ? post.publishedAt
        : (post.publishedAt ?? now),
    updatedAt: now,
    translationOf: post.translationOf || undefined,
    featured: post.featured ?? false,
  }

  const batch = writeBatch(database)
  batch.set(doc(database, POSTS, post.slug), stripUndefined(meta))
  batch.set(doc(database, POSTS, post.slug, ...BODY_DOC), {
    body: post.body,
    status: post.status,
    media: post.media ?? {},
  })
  await batch.commit()
}

/** Removes the post and its body document. */
export async function deletePost(slug: string): Promise<void> {
  const database = requireDb()
  const batch = writeBatch(database)
  batch.delete(doc(database, POSTS, slug, ...BODY_DOC))
  batch.delete(doc(database, POSTS, slug))
  await batch.commit()
}

/** True when the slug is already taken — the editor checks before a rename. */
export async function slugExists(slug: string): Promise<boolean> {
  if (!isFirebaseConfigured || !db) return false
  const snap = await getDoc(metaRef(slug))
  return snap.exists()
}

/**
 * Firestore rejects `undefined` field values outright, and optional metadata
 * (no cover, no series) legitimately produces them.
 */
function stripUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as T
}
