/**
 * `Accept` header parsing and content negotiation.
 *
 * Hand-written rather than pulled from npm: every dependency is a cold-start
 * cost at the edge and the whole algorithm is fifty lines. It follows the
 * ranking rules published at https://acceptmarkdown.com/guides/accept-parsing
 *
 *   1. sort by q descending
 *   2. break ties by specificity — `text/markdown` > `text/*` > `*\/*`
 *   3. treat `q=0` as an explicit refusal, never as a match
 *
 * The reason not to do this with `includes('text/markdown')`: Chrome sends
 * `text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*\/*;q=0.8`.
 * A substring check on the Markdown branch is fine there, but the mirror-image
 * bug — matching `*\/*;q=0.8` and serving Markdown to a browser — is one line
 * away, and `text/markdown;q=0` ("anything but Markdown") gets it exactly
 * backwards.
 *
 * Pure module: no Deno globals, no fetch. `tests/accept.test.ts` runs the
 * conformance vectors from the spec against it.
 */

export const HTML = 'text/html'
export const MARKDOWN = 'text/markdown'

/**
 * What this site can produce, in preference order. The first entry is the
 * default: it is what a request with no `Accept`, or with `*\/*`, gets.
 */
export const OFFERS: readonly string[] = [HTML, MARKDOWN]

/**
 * Media types treated as requests for the Markdown representation.
 * `text/x-markdown` predates RFC 7763 and is still sent by some clients;
 * honouring it costs nothing and the response is labelled `text/markdown`
 * either way.
 */
const ALIASES: Record<string, string> = {
  'text/x-markdown': MARKDOWN,
  'text/mdx': MARKDOWN,
}

export interface AcceptEntry {
  /** Lowercased `type/subtype`, parameters other than `q` dropped. */
  type: string
  /** Quality factor, 0…1. Absent `q` means 1. */
  quality: number
}

/**
 * Parses an `Accept` header into entries, most-preferred first.
 *
 * Unparseable entries are skipped rather than throwing — a malformed header
 * from one client must not take a page down.
 */
export function parseAccept(header: string | null | undefined): AcceptEntry[] {
  if (!header) return []

  const entries: AcceptEntry[] = []

  for (const raw of header.split(',')) {
    const [mediaType, ...params] = raw.split(';')
    const type = mediaType.trim().toLowerCase()
    // A bare `*` is not legal but is seen in the wild; read it as `*/*`.
    const normalized = type === '*' ? '*/*' : (ALIASES[type] ?? type)
    if (!normalized.includes('/')) continue

    let quality = 1
    for (const param of params) {
      const separator = param.indexOf('=')
      if (separator === -1) continue
      if (param.slice(0, separator).trim().toLowerCase() !== 'q') continue
      const parsed = Number.parseFloat(param.slice(separator + 1).trim())
      // An unparseable q is "no stated preference", i.e. the default of 1.
      quality = Number.isNaN(parsed) ? 1 : Math.min(Math.max(parsed, 0), 1)
    }

    entries.push({ type: normalized, quality })
  }

  // Stable sort by q descending keeps declaration order within a q band,
  // which is what `negotiate` relies on for its tie-breaks.
  return entries.sort((a, b) => b.quality - a.quality)
}

/**
 * Scores one offer against the parsed header.
 *
 * Specificity — not quality — picks *which* entry an offer is matched against,
 * so `Accept: text/*, text/html;q=0` correctly scores `text/html` at 0 rather
 * than at 1 via the wildcard.
 */
function score(offer: string, entries: readonly AcceptEntry[]): number {
  const [group] = offer.split('/')
  const candidates: [exact: number, subtype: number, any: number] = [-1, -1, -1]

  for (const entry of entries) {
    if (entry.type === offer) candidates[0] = Math.max(candidates[0], entry.quality)
    else if (entry.type === `${group}/*`) candidates[1] = Math.max(candidates[1], entry.quality)
    else if (entry.type === '*/*') candidates[2] = Math.max(candidates[2], entry.quality)
  }

  // First tier that matched at all wins, even when its q is 0 — that zero is
  // the client telling us not to send this representation.
  for (const quality of candidates) {
    if (quality >= 0) return quality
  }
  return 0
}

/**
 * Picks the representation to serve, or `null` when the client will not accept
 * anything this site produces — the one case that warrants a 406.
 *
 * A missing or empty header means "no constraint", not "nothing works", so it
 * resolves to the default offer. Same for `*\/*`. Returning 406 for either is
 * the most common implementation bug in content negotiation.
 */
export function negotiate(
  header: string | null | undefined,
  offers: readonly string[] = OFFERS,
): string | null {
  const entries = parseAccept(header)
  if (entries.length === 0) return offers[0] ?? null

  let best: string | null = null
  let bestScore = 0

  for (const offer of offers) {
    const value = score(offer, entries)
    // Strictly greater: ties fall to the earlier — more preferred — offer,
    // which is what makes `*/*` resolve to HTML rather than Markdown.
    if (value > bestScore) {
      best = offer
      bestScore = value
    }
  }

  return best
}

/**
 * True when the client asked for HTML *by name* — `text/html` or `text/*` at a
 * non-zero q — rather than shrugging with `*\/*` or sending no header at all.
 *
 * Used for one thing only: choosing the default representation of a **404
 * diagnostic**. A 404 body is not a representation of the requested resource
 * (there isn't one); it exists to tell the client where to look instead. Every
 * browser names `text/html` when it navigates, so a bare `*\/*` there is a
 * reliable signal of a programmatic client, and those are better served the
 * Markdown pointer list than a styled error page.
 *
 * Deliberately *not* used for content pages: on `/`, `/blog` and `/developers`,
 * `*\/*` means "anything is fine" and resolves to the default, per
 * https://acceptmarkdown.com/guides/accept-parsing — handing a shared cache a
 * Markdown copy of a real page under `*\/*` is the bug that guidance prevents.
 */
export function acceptsHtmlExplicitly(header: string | null | undefined): boolean {
  return parseAccept(header).some(
    (entry) =>
      entry.quality > 0 && (entry.type === HTML || entry.type === 'text/*'),
  )
}

/** Body for a 406, per RFC 9110's recommendation to list what is available. */
export function notAcceptableBody(requested: string | null | undefined): string {
  return [
    'This resource is available in:',
    ...OFFERS.map((offer) => `- ${offer}`),
    '',
    `You requested: ${requested?.trim() || '(empty Accept header)'}`,
    '',
    'See https://marcusboni.com.br/developers for the full list of',
    'machine-readable representations.',
    '',
  ].join('\n')
}

/**
 * Adds `Accept` to a `Vary` header without dropping what was already there.
 *
 * Both representations come from the same URL, so every cache between here and
 * the client has to key on `Accept`. Netlify's CDN already sends
 * `Vary: Accept-Encoding`; blindly overwriting it would let a gzip-capable
 * client's copy be served to one that cannot decode it.
 */
export function mergeVary(existing: string | null | undefined): string {
  const tokens = (existing ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)

  // `Vary: *` already means "never reuse this response" — narrowing it would
  // be a downgrade.
  if (tokens.some((token) => token === '*')) return '*'

  const seen = new Set(tokens.map((token) => token.toLowerCase()))
  return seen.has('accept') ? tokens.join(', ') : ['Accept', ...tokens].join(', ')
}
