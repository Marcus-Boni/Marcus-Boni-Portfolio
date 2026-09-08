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
): Promise<{ body: string; media: Record<string, { src: string; alt?: string }> } | null> {
  if (!isConfigured || !slug) return null
  try {
    const response = await fetch(
      `${BASE}/posts/${encodeURIComponent(slug)}/content/main`,
      { headers: { accept: 'application/json' } },
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

/** `media` is a map of id → MediaRef; only `src` and `alt` are needed here. */
function decodeMedia(
  value: FsValue | undefined,
): Record<string, { src: string; alt?: string }> {
  const fields = value?.mapValue?.fields ?? {}
  const out: Record<string, { src: string; alt?: string }> = {}
  for (const [id, entry] of Object.entries(fields)) {
    const ref = entry.mapValue?.fields
    const src = ref?.src?.stringValue
    if (!src) continue
    out[id] = { src, alt: ref?.alt?.stringValue }
  }
  return out
}

/** Published posts, newest first. Used by the sitemap and the RSS feed. */
export async function listPublished(limit = 200): Promise<EdgePost[]> {
  if (!isConfigured) return []
  try {
    const response = await fetch(`${BASE}:runQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
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
          orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
          limit,
        },
      }),
    })
    if (!response.ok) return []
    const rows = (await response.json()) as {
      document?: { name?: string; fields?: Record<string, FsValue> }
    }[]
    return rows
      .filter((row) => row.document?.name && row.document.fields)
      .map((row) => decode(row.document!.name!, row.document!.fields!))
  } catch {
    return []
  }
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
