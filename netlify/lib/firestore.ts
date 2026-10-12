/**
 * Minimal Firestore REST client for the edge functions.
 *
 * These run on Deno at the edge, where the Firebase JS SDK is both unnecessary
 * and unwelcome, so this speaks the REST API directly. Reads are unauthenticated
 * and therefore subject to `firestore.rules` exactly as a browser would be:
 *
 *  • `GET posts/{slug}` returns 403 for a draft — which is the correct answer
 *    for a crawler, and is treated here as "no such post".
 *  • The feed query MUST filter `status == 'published'`, because the rules
 *    prove list access against the query itself.
 */

const PROJECT_ID =
  Deno.env.get('VITE_FIREBASE_PROJECT_ID') ??
  Deno.env.get('FIREBASE_PROJECT_ID') ??
  ''

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

export const isConfigured = PROJECT_ID.length > 0

/** The subset of `PostMeta` the edge functions actually need. */
export interface EdgePost {
  slug: string
  lang: 'pt' | 'en'
  status: string
  title: string
  subtitle: string
  excerpt: string
  coverUrl: string | null
  coverAlt?: string
  tags: string[]
  readingMinutes: number
  publishedAt: string | null
  updatedAt: string
  translationOf: string | null
}

/* ─── Firestore value decoding ──────────────────────────────────────────── */

interface FsValue {
  stringValue?: string
  integerValue?: string
  doubleValue?: number
  booleanValue?: boolean
  nullValue?: null
  mapValue?: { fields?: Record<string, FsValue> }
  arrayValue?: { values?: FsValue[] }
}

function str(value: FsValue | undefined, fallback = ''): string {
  return value?.stringValue ?? fallback
}

function num(value: FsValue | undefined, fallback = 0): number {
  if (value?.integerValue !== undefined) return Number(value.integerValue)
  if (value?.doubleValue !== undefined) return value.doubleValue
  return fallback
}

function strArray(value: FsValue | undefined): string[] {
  return (value?.arrayValue?.values ?? [])
    .map((entry) => entry.stringValue)
    .filter((entry): entry is string => typeof entry === 'string')
}

function decode(name: string, fields: Record<string, FsValue>): EdgePost {
  const slug = name.split('/').pop() ?? ''
  const lang = str(fields.lang) === 'en' ? 'en' : 'pt'
  return {
    slug,
    lang,
    status: str(fields.status, 'draft'),
    title: str(fields.title),
    subtitle: str(fields.subtitle),
    excerpt: str(fields.excerpt),
    // The cover is a nested map; `src` is the largest variant.
    coverUrl: fields.cover?.mapValue?.fields?.src?.stringValue ?? null,
    coverAlt: fields.cover?.mapValue?.fields?.alt?.stringValue,
    tags: strArray(fields.tags),
    readingMinutes: num(fields.readingMinutes, 1),
    publishedAt: fields.publishedAt?.stringValue ?? null,
    updatedAt: str(fields.updatedAt),
    translationOf: fields.translationOf?.stringValue ?? null,
  }
}

/* ─── Reads ─────────────────────────────────────────────────────────────── */

/**
 * The outcome of a post read.
 *
 * `missing` and `unavailable` used to collapse into one `null`, which was fine
 * while the only consumer degraded to the default `<head>` either way. It is
 * not fine now that a missing slug has to answer 404: a Firestore outage must
 * not turn every post on the site into a "gone" that crawlers act on.
 */
export type PostLookup =
  | { state: 'found'; post: EdgePost }
  | { state: 'missing' }
  | { state: 'unavailable' }

/** Firestore statuses a signed-out visitor is allowed to see. */
function isReadable(status: string): boolean {
  // `unlisted` is deliberate: the link is meant to be shared, it is only kept
  // out of the index and the feeds.
  return status === 'published' || status === 'unlisted'
}

/**
 * One post's metadata.
 *
 * A 404 or 403 from Firestore is a definite "no such post" — 403 is what the
 * rules return for a draft, which is exactly what a crawler should be told.
 * Anything else (5xx, a network error, no project id) is `unavailable`.
 */
export async function lookupPost(slug: string): Promise<PostLookup> {
  if (!isConfigured || !slug) return { state: 'unavailable' }
  try {
    const response = await fetch(`${BASE}/posts/${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (response.status === 404 || response.status === 403) return { state: 'missing' }
    if (!response.ok) return { state: 'unavailable' }
    const data = (await response.json()) as {
      name?: string
      fields?: Record<string, FsValue>
    }
    if (!data.name || !data.fields) return { state: 'missing' }
    const post = decode(data.name, data.fields)
    return isReadable(post.status) ? { state: 'found', post } : { state: 'missing' }
  } catch {
    return { state: 'unavailable' }
  }
}

/** A post's Markdown source and its body images, or `null` when unreadable. */
export async function getPostBody(
  slug: string,
): Promise<{ body: string; media: Record<string, EdgeMedia> } | null> {
  if (!isConfigured || !slug) return null
  try {
    const response = await fetch(
      `${BASE}/posts/${encodeURIComponent(slug)}/content/main`,
      { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
    )
    if (!response.ok) return null
    const data = (await response.json()) as { fields?: Record<string, FsValue> }
    if (!data.fields) return null
    return {
      body: str(data.fields.body),
      media: decodeMedia(data.fields.media),
    }
  } catch {
    return null
  }
}

export interface EdgeMedia {
  src: string
  alt?: string
  caption?: string
  width?: number
  height?: number
}

/** Preserve meaningful image captions and dimensions in the delivered HTML. */
function decodeMedia(
  value: FsValue | undefined,
): Record<string, EdgeMedia> {
  const fields = value?.mapValue?.fields ?? {}
  const out: Record<string, EdgeMedia> = {}
  for (const [id, entry] of Object.entries(fields)) {
    const ref = entry.mapValue?.fields
    const src = ref?.src?.stringValue
    if (!src) continue
    out[id] = { src, alt: ref?.alt?.stringValue,
      caption: ref?.caption?.stringValue,
      width: ref?.width ? num(ref.width) : undefined,
      height: ref?.height ? num(ref.height) : undefined,
    }
  }
  return out
}

/** Published posts, newest first. Used by the sitemap and the RSS feed. */
export type PublishedLookup =
  | { state: 'found'; posts: EdgePost[] }
  | { state: 'unavailable' }

/** Query one page with a stable document cursor, distinguishing outages from empty collections. */
async function publishedPage(limit: number, cursor?: string): Promise<PublishedLookup> {
  if (!isConfigured) return { state: 'unavailable' }
  try {
    const response = await fetch(`${BASE}:runQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'posts' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'status' },
              op: 'EQUAL',
              value: { stringValue: 'published' },
            },
          },
          orderBy: [{ field: { fieldPath: '__name__' }, direction: 'ASCENDING' }],
          ...(cursor ? { startAt: { values: [{ referenceValue: `${BASE.replace('https://firestore.googleapis.com/v1/', '')}/posts/${cursor}` }], before: false } } : {}),
          limit,
        },
      }),
    })
    if (!response.ok) return { state: 'unavailable' }
    const rows = (await response.json()) as {
      error?: unknown
      document?: { name?: string; fields?: Record<string, FsValue> }
    }[]
    if (!Array.isArray(rows)) return { state: 'unavailable' }
    if (rows.some((row) => row.error || (row.document && (!row.document.name || !row.document.fields)))) return { state: 'unavailable' }
    const posts = rows
      .filter((row) => row.document?.name && row.document.fields)
      .map((row) => decode(row.document!.name!, row.document!.fields!))
      .filter((post) => post.status === 'published')
    return { state: 'found', posts }
  } catch {
    return { state: 'unavailable' }
  }
}

function newestFirst(posts: EdgePost[]): EdgePost[] {
  return posts.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
}

/** Read the whole publication catalog; exceeding the bound fails instead of silently dropping URLs. */
export async function listAllPublished(): Promise<PublishedLookup> {
  const posts: EdgePost[] = []
  const seen = new Set<string>()
  let cursor: string | undefined
  const started = Date.now()
  for (let page = 0; page < 50; page++) {
    if (Date.now() - started > 15000) return { state: 'unavailable' }
    const result = await publishedPage(1000, cursor)
    if (result.state !== 'found') return result
    for (const post of result.posts) {
      if (seen.has(post.slug)) return { state: 'unavailable' }
      seen.add(post.slug)
      posts.push(post)
    }
    if (result.posts.length < 1000) return { state: 'found', posts: newestFirst(posts) }
    cursor = result.posts.at(-1)?.slug
  }
  return { state: 'unavailable' }
}

/** Backward-compatible newest-first API used by public Markdown and JSON consumers. */
export async function listPublished(limit = 200): Promise<EdgePost[]> {
  const result = await listAllPublished()
  return result.state === 'found' ? result.posts.slice(0, limit) : []
}

/* ─── Escaping ──────────────────────────────────────────────────────────── */

/**
 * Escapes text for use inside an HTML attribute or element. Post content is
 * admin-authored, but it still ends up interpolated into markup — a stray
 * quote in a title would otherwise break out of the `content="…"` attribute.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Escapes a string for embedding in a JSON-LD `<script>` block. */
export function escapeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}
