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

/** One post's metadata, or `null` when missing, draft, or unreachable. */
export async function getPost(slug: string): Promise<EdgePost | null> {
  if (!isConfigured || !slug) return null
  try {
    const response = await fetch(`${BASE}/posts/${encodeURIComponent(slug)}`, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as {
      name?: string
      fields?: Record<string, FsValue>
    }
    if (!data.name || !data.fields) return null
    const post = decode(data.name, data.fields)
    // `unlisted` posts get full meta tags on purpose: the link is meant to be
    // shared, it is only kept out of the index and the feeds.
    return post.status === 'published' || post.status === 'unlisted' ? post : null
  } catch {
    return null
  }
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
