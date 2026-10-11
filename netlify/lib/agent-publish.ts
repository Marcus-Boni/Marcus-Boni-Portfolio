/**
 * Authenticated blog publishing for trusted agents.
 *
 * Public reads stay in `api.ts`; this module is a separate write surface with
 * its own bearer token and Google service-account credentials from env vars.
 */

const SITE_URL = 'https://marcusboni.com.br'
const JSON_TYPE = 'application/json; charset=utf-8'
const PROBLEM_TYPE = 'application/problem+json; charset=utf-8'
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore'

const PROJECT_ID =
  Deno.env.get('FIREBASE_PROJECT_ID') ?? Deno.env.get('VITE_FIREBASE_PROJECT_ID') ?? ''
const AGENT_TOKEN = Deno.env.get('AGENT_PUBLISH_TOKEN') ?? ''
const SERVICE_ACCOUNT_EMAIL = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_EMAIL') ?? ''
const SERVICE_ACCOUNT_PRIVATE_KEY =
  Deno.env.get('FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY')?.replace(/\\n/g, '\n') ?? ''

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const COMMIT = `${BASE}:commit`

type Status = 'published' | 'unlisted'
type Lang = 'pt' | 'en'
type Validator = (value: unknown) => boolean

interface FsValue {
  stringValue?: string
  integerValue?: string
  doubleValue?: number
  booleanValue?: boolean
  nullValue?: null
  mapValue?: { fields?: Record<string, FsValue> }
  arrayValue?: { values?: FsValue[] }
}

interface AgentPostInput {
  slug: string
  lang?: Lang
  status?: Status
  title?: string
  subtitle?: string
  excerpt?: string
  body?: string
  tags?: string[]
  cover?: Record<string, unknown>
  media?: Record<string, unknown>
  series?: Record<string, unknown>
  publishedAt?: string | null
  translationOf?: string
  featured?: boolean
}

interface AgentRequest {
  requestId: string
  post: AgentPostInput
}

interface ExistingPost {
  meta: Record<string, unknown>
  body: Record<string, unknown>
  publishedAt: string | null
  updateTime: string
  bodyUpdateTime: string | null
}

let cachedAccessToken: { value: string; expiresAt: number } | null = null

export async function handleAgentPublish(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname
  const isHead = request.method === 'HEAD'

  if (request.method !== 'POST' && request.method !== 'PATCH' && !isHead) {
    return problemResponse(
      'method_not_allowed',
      405,
      `${request.method} is not supported. Agents can create with POST or revise with PATCH.`,
      path,
      'Use POST to create a published post or PATCH to update an existing one. DELETE is not available.',
      false,
    )
  }

  if (isHead) {
    return problemResponse(
      'method_not_allowed',
      405,
      'HEAD is not supported on the authenticated publishing endpoint.',
      path,
      'Use POST or PATCH with a JSON body and Authorization: Bearer <token>.',
      true,
    )
  }

  if (!isConfigured()) {
    return problemResponse(
      'upstream_unavailable',
      503,
      'The publishing endpoint is missing one or more required environment variables.',
      path,
      'Configure AGENT_PUBLISH_TOKEN plus Firebase project and service-account credentials in Netlify.',
      false,
    )
  }

  const auth = request.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${AGENT_TOKEN}`) {
    return problemResponse(
      'unauthorized',
      401,
      'The publishing token is missing or invalid.',
      path,
      'Send Authorization: Bearer <AGENT_PUBLISH_TOKEN> from a trusted server-side agent.',
      false,
    )
  }

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return problemResponse(
      'bad_request',
      400,
      'The request body must be JSON.',
      path,
      'Send Content-Type: application/json with requestId and post.',
      false,
    )
  }

  const payload = await parsePayload(request, path)
  if (payload instanceof Response) return payload

  const validation = validatePayload(payload, path, request.method)
  if (validation instanceof Response) return validation

  const token = await safeAccessToken(path)
  if (token instanceof Response) return token

  const existing = await readExistingPost(payload.post.slug, token)

  if (request.method === 'POST' && existing.state === 'found') {
    return problemResponse(
      'conflict',
      409,
      `A post with slug "${payload.post.slug}" already exists.`,
      path,
      'Use PATCH to revise that post, or choose a new slug for a new article.',
      false,
    )
  }

  if (request.method === 'PATCH' && existing.state === 'missing') {
    return problemResponse(
      'not_found',
      404,
      `No post with slug "${payload.post.slug}" exists to revise.`,
      path,
      'Use POST to create a new article, or PATCH with an existing slug.',
      false,
    )
  }

  if (
    request.method === 'PATCH' &&
    existing.state === 'found' &&
    !isReadableStatus(existing.post.meta.status)
  ) {
    return problemResponse(
      'forbidden',
      403,
      `The post "${payload.post.slug}" is a draft. Agents can only revise posts that are already published or unlisted.`,
      path,
      'Open the admin editor to publish the draft first, then use PATCH for agent revisions.',
      false,
    )
  }

  if (existing.state === 'unavailable') {
    return problemResponse(
      'upstream_unavailable',
      503,
      'The current post state could not be checked safely.',
      path,
      'Retry the same request in a few seconds.',
      false,
    )
  }

  const now = new Date().toISOString()
  const writeState = materializePost(payload, existing.post, path, {
    now,
    create: request.method === 'POST',
  })

  if (writeState instanceof Response) return writeState

  const write = buildCommit(payload, writeState, {
    actor: cleanOptional(request.headers.get('x-agent-name')) ?? 'agent',
    create: request.method === 'POST',
    updateTime: existing.post?.updateTime ?? null,
    bodyUpdateTime: existing.post?.bodyUpdateTime ?? null,
  })

  const committed = await commitWrite(write, token, path)
  if (committed instanceof Response) return committed

  return json(
    {
      slug: payload.post.slug,
      url: `${SITE_URL}/blog/${payload.post.slug}`,
      status: writeState.status,
      requestId: payload.requestId,
      created: request.method === 'POST',
      publishedAt: writeState.publishedAt,
      updatedAt: writeState.now,
    },
    request.method === 'POST' ? 201 : 200,
  )
}

function isConfigured(): boolean {
  return Boolean(PROJECT_ID && AGENT_TOKEN && SERVICE_ACCOUNT_EMAIL && SERVICE_ACCOUNT_PRIVATE_KEY)
}

async function parsePayload(request: Request, path: string): Promise<AgentRequest | Response> {
  try {
    return (await request.json()) as AgentRequest
  } catch {
    return problemResponse(
      'bad_request',
      400,
      'The request body is not valid JSON.',
      path,
      'Send a JSON object with requestId and post.',
      false,
    )
  }
}

function validatePayload(
  payload: AgentRequest,
  path: string,
  method: string,
): Response | null {
  if (!isPlainObject(payload) || !isCleanText(payload.requestId, 1, 120)) {
    return problemResponse(
      'bad_request',
      400,
      'A non-empty requestId is required as an audit correlation id for this publication request.',
      path,
      'Include a caller-supplied requestId, for example "api-explainer-2026-09-28". Authorization comes from the bearer token.',
      false,
    )
  }

  const post = payload.post
  if (!isPlainObject(post)) {
    return problemResponse(
      'bad_request',
      400,
      'The post object is required.',
      path,
      'Send post.slug, post.title, post.body and optional metadata.',
      false,
    )
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug ?? '')) {
    return problemResponse(
      'bad_request',
      400,
      'post.slug must be lowercase kebab-case.',
      path,
      'Use a URL-safe slug such as "explicando-apis".',
      false,
    )
  }

  if (method === 'POST' && (!isCleanText(post.title, 1, 160) || !isCleanText(post.body, 1, 120_000))) {
    return problemResponse(
      'bad_request',
      400,
      'post.title and post.body are required.',
      path,
      'Send the article title and Markdown body.',
      false,
    )
  }

  if (method === 'PATCH' && post.title !== undefined && !isCleanText(post.title, 1, 160)) {
    return problemResponse(
      'bad_request',
      400,
      'post.title must be a non-empty string when it is revised.',
      path,
      'Omit post.title to keep the current title, or send a replacement title.',
      false,
    )
  }

  if (method === 'PATCH' && post.body !== undefined && !isCleanText(post.body, 1, 120_000)) {
    return problemResponse(
      'bad_request',
      400,
      'post.body must be a non-empty Markdown string when it is revised.',
      path,
      'Omit post.body to keep the current Markdown body, or send a replacement body.',
      false,
    )
  }

  if (post.lang !== undefined && post.lang !== 'pt' && post.lang !== 'en') {
    return problemResponse(
      'bad_request',
      400,
      'post.lang must be "pt" or "en".',
      path,
      'Omit lang for Portuguese, or send "en" for English.',
      false,
    )
  }

  if (post.status !== undefined && post.status !== 'published' && post.status !== 'unlisted') {
    return problemResponse(
      'bad_request',
      400,
      'Agents can only publish or unlist posts; drafts remain an admin-editor concept.',
      path,
      'Use status "published" for public posts or "unlisted" for direct-link posts.',
      false,
    )
  }

  if (post.tags !== undefined && !isStringArray(post.tags, 20, 40)) {
    return problemResponse(
      'bad_request',
      400,
      'post.tags must be an array of short strings.',
      path,
      'Send at most 20 tags, each up to 40 characters.',
      false,
    )
  }

  const optionalError =
    validateOptionalField(post, 'subtitle', (value) => isOptionalText(value, 160)) ??
    validateOptionalField(post, 'excerpt', (value) => isOptionalText(value, 200)) ??
    validateOptionalField(post, 'translationOf', (value) => isOptionalSlug(value)) ??
    validateOptionalField(post, 'publishedAt', isOptionalIsoStringOrNull) ??
    validateOptionalField(post, 'featured', (value) => typeof value === 'boolean') ??
    validateOptionalField(post, 'cover', isMediaRef) ??
    validateOptionalField(post, 'media', isMediaMap) ??
    validateOptionalField(post, 'series', isSeries)

  if (optionalError) {
    return problemResponse(
      'bad_request',
      400,
      optionalError,
      path,
      'Remove the invalid field or send it in the documented blog post shape.',
      false,
    )
  }

  return null
}

async function readExistingPost(
  slug: string,
  token: string,
): Promise<
  | { state: 'found'; post: ExistingPost }
  | { state: 'missing'; post?: undefined }
  | { state: 'unavailable'; post?: undefined }
> {
  try {
    const response = await fetch(`${BASE}/posts/${encodeURIComponent(slug)}`, {
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    })
    if (response.status === 404) return { state: 'missing' }
    if (!response.ok) return { state: 'unavailable' }
    const data = (await response.json()) as {
      fields?: Record<string, FsValue>
      updateTime?: string
    }
    const bodyResponse = await fetch(
      `${BASE}/posts/${encodeURIComponent(slug)}/content/main`,
      { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } },
    )
    if (!bodyResponse.ok && bodyResponse.status !== 404) return { state: 'unavailable' }
    const bodyData =
      bodyResponse.status === 404
        ? null
        : ((await bodyResponse.json()) as {
            fields?: Record<string, FsValue>
            updateTime?: string
          })
    return {
      state: 'found',
      post: {
        meta: decodeMap(data.fields ?? {}),
        body: decodeMap(bodyData?.fields ?? {}),
        publishedAt: data.fields?.publishedAt?.stringValue ?? null,
        updateTime: data.updateTime ?? '',
        bodyUpdateTime: bodyData?.updateTime ?? null,
      },
    }
  } catch {
    return { state: 'unavailable' }
  }
}

interface MaterializedPost {
  meta: Record<string, unknown>
  body: Record<string, unknown>
  status: Status
  publishedAt: string | null
  now: string
}

function materializePost(
  payload: AgentRequest,
  existing: ExistingPost | undefined,
  path: string,
  options: { now: string; create: boolean },
): MaterializedPost | Response {
  const post = payload.post
  const previousMeta = options.create ? {} : existing?.meta ?? {}
  const previousBody = options.create ? {} : existing?.body ?? {}
  const bodyText = post.body ?? stringField(previousBody.body)
  const status = post.status ?? statusField(previousMeta.status)
  const publishedAt =
    status === 'published' || status === 'unlisted'
      ? (post.publishedAt ?? existing?.publishedAt ?? stringOrNull(previousMeta.publishedAt) ?? options.now)
      : null

  if (!bodyText) {
    return problemResponse(
      'upstream_unavailable',
      503,
      'The existing post body could not be read, so a partial revision would be unsafe.',
      path,
      'Retry, or send post.body explicitly so the body can be replaced deliberately.',
      false,
    )
  }

  const meta = stripNullish({
    ...previousMeta,
    slug: post.slug,
    lang: post.lang ?? langField(previousMeta.lang),
    status,
    title: post.title?.trim() ?? stringField(previousMeta.title),
    subtitle: hasOwn(post, 'subtitle')
      ? cleanOptional(post.subtitle)
      : previousMeta.subtitle,
    excerpt:
      (hasOwn(post, 'excerpt')
        ? cleanOptional(post.excerpt)
        : optionalStringField(previousMeta.excerpt)) ?? autoExcerpt(bodyText),
    cover: hasOwn(post, 'cover') ? post.cover : previousMeta.cover,
    tags: hasOwn(post, 'tags') ? cleanTags(post.tags) : (previousMeta.tags ?? []),
    series: hasOwn(post, 'series') ? post.series : previousMeta.series,
    readingMinutes: readingMinutes(bodyText),
    publishedAt,
    updatedAt: options.now,
    translationOf: hasOwn(post, 'translationOf')
      ? cleanOptional(post.translationOf)
      : previousMeta.translationOf,
    featured: hasOwn(post, 'featured') ? post.featured : (previousMeta.featured ?? false),
    agentRequestId: payload.requestId.trim(),
  })

  const body = stripNullish({
    ...previousBody,
    body: bodyText,
    status,
    media: hasOwn(post, 'media') ? (post.media ?? {}) : (previousBody.media ?? {}),
  })

  return { meta, body, status, publishedAt, now: options.now }
}

function buildCommit(
  payload: AgentRequest,
  post: MaterializedPost,
  options: {
    actor: string
    create: boolean
    updateTime: string | null
    bodyUpdateTime: string | null
  },
): Record<string, unknown> {
  const precondition = options.create
    ? { currentDocument: { exists: false } }
    : options.updateTime
      ? { currentDocument: { updateTime: options.updateTime } }
      : { currentDocument: { exists: true } }
  const bodyPrecondition = options.create
    ? { currentDocument: { exists: false } }
    : options.bodyUpdateTime
      ? { currentDocument: { updateTime: options.bodyUpdateTime } }
      : {}

  return {
    writes: [
      {
        update: {
          name: `${BASE}/posts/${payload.post.slug}`,
          fields: encodeMap({ ...post.meta, agentActor: options.actor }),
        },
        ...precondition,
      },
      {
        update: {
          name: `${BASE}/posts/${payload.post.slug}/content/main`,
          fields: encodeMap(post.body),
        },
        ...bodyPrecondition,
      },
    ],
  }
}

async function commitWrite(
  write: Record<string, unknown>,
  token: string,
  path: string,
): Promise<true | Response> {
  let committed: Response
  try {
    committed = await fetch(COMMIT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(write),
    })
  } catch {
    return problemResponse(
      'upstream_unavailable',
      503,
      'Firestore could not be reached for the write.',
      path,
      'Retry the same request in a few seconds.',
      false,
    )
  }

  if (committed.ok) {
    const result = (await committed.json().catch(() => null)) as
      | { writeResults?: unknown }
      | null
    if (Array.isArray(result?.writeResults) && result.writeResults.length >= 2) {
      return true
    }
    return problemResponse(
      'upstream_unavailable',
      503,
      'Firestore accepted the request but returned an unexpected commit response.',
      path,
      'Retry and inspect Netlify logs before assuming the post was published.',
      false,
    )
  }

  if (committed.status === 409 || committed.status === 412) {
    return problemResponse(
      'conflict',
      409,
      'The post changed between read and write, so the revision was not applied.',
      path,
      'Fetch the latest post state and retry the PATCH against the current version.',
      false,
    )
  }

  return problemResponse(
    'upstream_unavailable',
    503,
    `Firestore rejected the write with status ${committed.status}.`,
    path,
    'Check the service-account credentials and retry after confirming the slug state.',
    false,
  )
}

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) {
    return cachedAccessToken.value
  }

  const assertion = await serviceAccountAssertion(now)
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })
  if (!response.ok) throw new Error('Could not mint a Firebase access token.')
  const data = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) throw new Error('OAuth response did not include an access token.')
  cachedAccessToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
  }
  return cachedAccessToken.value
}

async function safeAccessToken(path: string): Promise<string | Response> {
  try {
    return await accessToken()
  } catch {
    return problemResponse(
      'upstream_unavailable',
      503,
      'The publishing endpoint could not obtain a Firebase access token.',
      path,
      'Check the service-account environment variables in Netlify and retry after they are fixed.',
      false,
    )
  }
}

async function serviceAccountAssertion(now: number): Promise<string> {
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' })
  const claim = base64UrlJson({
    iss: SERVICE_ACCOUNT_EMAIL,
    scope: FIRESTORE_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })
  const unsigned = `${header}.${claim}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(SERVICE_ACCOUNT_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  return `${unsigned}.${base64UrlBytes(new Uint8Array(signature))}`
}

function encodeMap(value: Record<string, unknown>): Record<string, FsValue> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, encodeValue(entry)]),
  )
}

function encodeValue(value: unknown): FsValue {
  if (value === null) return { nullValue: null }
  if (typeof value === 'string') return { stringValue: value }
  if (typeof value === 'number') return { integerValue: String(Math.trunc(value)) }
  if (typeof value === 'boolean') return { booleanValue: value }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((entry) => encodeValue(entry)) } }
  }
  if (isPlainObject(value)) return { mapValue: { fields: encodeMap(value) } }
  return { nullValue: null }
}

function decodeMap(fields: Record<string, FsValue>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  )
}

function decodeValue(value: FsValue): unknown {
  if (value.stringValue !== undefined) return value.stringValue
  if (value.integerValue !== undefined) return Number(value.integerValue)
  if (value.doubleValue !== undefined) return value.doubleValue
  if (value.booleanValue !== undefined) return value.booleanValue
  if (value.nullValue === null) return null
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeValue)
  if (value.mapValue) return decodeMap(value.mapValue.fields ?? {})
  return undefined
}

function stripNullish<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T
}

function cleanTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))].slice(0, 20)
}

function cleanOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optionalStringField(value: unknown): string | undefined {
  const text = stringField(value).trim()
  return text ? text : undefined
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function statusField(value: unknown): Status {
  return value === 'unlisted' ? 'unlisted' : 'published'
}

function langField(value: unknown): Lang {
  return value === 'en' ? 'en' : 'pt'
}

function isReadableStatus(value: unknown): boolean {
  return value === 'published' || value === 'unlisted'
}

function hasOwn<T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isCleanText(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max
}

function isStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((entry) => typeof entry === 'string' && entry.length <= maxLength)
  )
}

function validateOptionalField(
  post: Record<string, unknown>,
  field: string,
  validator: Validator,
): string | null {
  if (!hasOwn(post, field)) return null
  return validator(post[field]) ? null : `post.${field} has an invalid shape.`
}

function isOptionalText(value: unknown, maxLength: number): boolean {
  return value === null || (typeof value === 'string' && value.length <= maxLength)
}

function isOptionalSlug(value: unknown): boolean {
  return value === null || (typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
}

function isOptionalIsoStringOrNull(value: unknown): boolean {
  if (value === null) return true
  if (typeof value !== 'string') return false
  const date = new Date(value)
  return !Number.isNaN(date.getTime()) && date.toISOString() === value
}

function isSeries(value: unknown): boolean {
  if (value === null) return true
  if (!isPlainObject(value)) return false
  const order = value.order
  return (
    isCleanText(value.id, 1, 80) &&
    isCleanText(value.title, 1, 120) &&
    typeof order === 'number' &&
    Number.isInteger(order) &&
    order >= 1 &&
    order <= 999
  )
}

function isMediaMap(value: unknown): boolean {
  if (value === null) return true
  if (!isPlainObject(value)) return false
  return Object.entries(value).every(
    ([id, entry]) => /^[a-zA-Z0-9_-]{1,80}$/.test(id) && isMediaRef(entry),
  )
}

function isMediaRef(value: unknown): boolean {
  if (value === null) return true
  if (!isPlainObject(value)) return false
  return (
    isHttpUrl(value.src) &&
    Array.isArray(value.variants) &&
    value.variants.length <= 12 &&
    value.variants.every(isMediaVariant) &&
    typeof value.lqip === 'string' &&
    value.lqip.length <= 20_000 &&
    isPositiveFiniteNumber(value.width) &&
    isPositiveFiniteNumber(value.height) &&
    isCleanText(value.alt, 1, 300) &&
    (value.caption === undefined || isOptionalText(value.caption, 500)) &&
    (value.storagePath === undefined || isCleanText(value.storagePath, 1, 500))
  )
}

function isMediaVariant(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    isPositiveFiniteNumber(value.width) &&
    isHttpUrl(value.url)
  )
}

function isHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2_000) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^:{3,}[^\n]*$/gm, ' ')
    .replace(/^::[^\n]*$/gm, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readingMinutes(markdown: string): number {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

function autoExcerpt(markdown: string, max = 200): string {
  const text = stripMarkdown(markdown)
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`
}

function json(payload: unknown, status: number): Response {
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status,
    headers: {
      'content-type': JSON_TYPE,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

function problemResponse(
  code: string,
  status: number,
  detail: string,
  instance: string,
  hint: string,
  isHead: boolean,
): Response {
  const body = {
    type: `${SITE_URL}/developers#error-${code.replace(/_/g, '-')}`,
    title: titleFor(status),
    status,
    detail,
    instance,
    code,
    hint,
  }
  return new Response(isHead ? null : `${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: {
      'content-type': PROBLEM_TYPE,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

function titleFor(status: number): string {
  if (status === 400) return 'Bad request'
  if (status === 401) return 'Unauthorized'
  if (status === 403) return 'Forbidden'
  if (status === 404) return 'Not found'
  if (status === 405) return 'Method not allowed'
  if (status === 409) return 'Conflict'
  return 'Upstream unavailable'
}

function base64UrlJson(value: unknown): string {
  return base64UrlBytes(new TextEncoder().encode(JSON.stringify(value)))
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes.buffer
}
