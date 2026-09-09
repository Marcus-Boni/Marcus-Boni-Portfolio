/**
 * Deprecation signalling for the public API.
 *
 * "Agents avoid integrating against a surface that can change without warning."
 * A written policy is half the answer; the other half is the mechanism that
 * would carry it, present and tested before it is needed. Publishing a policy
 * whose implementation does not exist is how the first deprecation ends up
 * announced in a blog post nobody's client reads.
 *
 * Two published headers do the work:
 *
 *   RFC 9745  `Deprecation: @<unix-seconds>`  — when the endpoint became
 *             deprecated. A past date means "already deprecated".
 *   RFC 8594  `Sunset: <HTTP-date>`           — when it stops responding.
 *
 * Both are accompanied by `Link: <…>; rel="deprecation"` pointing at the
 * explanation, as RFC 9745 §2 recommends.
 *
 * `DEPRECATIONS` is empty, and that is the honest state: nothing has been
 * deprecated. `tests/deprecation.test.ts` exercises the machinery with
 * fixtures so it is known to work the day an entry lands here.
 *
 * Pure module: no Deno globals, no fetch.
 */

const SITE_URL = 'https://marcusboni.com.br'

/** How long a deprecated path keeps answering before it is removed. */
export const MINIMUM_NOTICE_DAYS = 180

export interface Deprecation {
  /** Exact pathname, as it appears in the OpenAPI document. */
  path: string
  /** ISO 8601 date the deprecation was announced. */
  deprecatedAt: string
  /** ISO 8601 date the path stops responding. */
  sunsetAt: string
  /** Where the reasoning and the migration live. */
  documentation: string
}

/**
 * Currently deprecated paths.
 *
 * Empty on purpose. Adding an entry is a public commitment: `sunsetAt` must be
 * at least `MINIMUM_NOTICE_DAYS` after `deprecatedAt`, which the test enforces
 * so the policy cannot be quietly undercut by a rushed removal.
 */
export const DEPRECATIONS: readonly Deprecation[] = []

export function findDeprecation(
  pathname: string,
  entries: readonly Deprecation[] = DEPRECATIONS,
): Deprecation | null {
  return entries.find((entry) => entry.path === pathname) ?? null
}

/**
 * The headers announcing a deprecation, or `{}` for a healthy path.
 *
 * Returned as a plain record so a caller can spread it into a response without
 * branching. `entries` is injectable purely so the tests can exercise the
 * formatting while `DEPRECATIONS` is legitimately empty.
 */
export function deprecationHeaders(
  pathname: string,
  entries: readonly Deprecation[] = DEPRECATIONS,
): Record<string, string> {
  const entry = findDeprecation(pathname, entries)
  if (!entry) return {}

  const deprecated = new Date(entry.deprecatedAt)
  const sunset = new Date(entry.sunsetAt)
  if (Number.isNaN(deprecated.getTime()) || Number.isNaN(sunset.getTime())) {
    // A malformed entry must not produce a header that says something false.
    return {}
  }

  return {
    // RFC 9745: an IMF-fixdate would also be legal, but the `@seconds` form is
    // what the RFC's own examples use and is unambiguous across parsers.
    Deprecation: `@${Math.floor(deprecated.getTime() / 1000)}`,
    Sunset: sunset.toUTCString(),
    Link: `<${entry.documentation}>; rel="deprecation"; type="text/html"`,
  }
}

/** The policy itself, stated once and reused by the docs and the spec. */
export const VERSIONING_POLICY = {
  scheme: 'URL path',
  current: '/api/v1',
  noticeDays: MINIMUM_NOTICE_DAYS,
  documentation: `${SITE_URL}/developers#versioning`,
} as const
