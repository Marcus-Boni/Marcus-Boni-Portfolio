import { describe, expect, it } from 'vitest'

import { MINIMUM_NOTICE_DAYS as SPEC_NOTICE_DAYS } from '@/data/api'
import { openApiDocument } from '@/data/openapi'

import {
  DEPRECATIONS,
  deprecationHeaders,
  findDeprecation,
  MINIMUM_NOTICE_DAYS,
  VERSIONING_POLICY,
  type Deprecation,
} from '../netlify/lib/deprecation.ts'

/**
 * The deprecation policy, and the machinery that would carry it.
 *
 * `DEPRECATIONS` is empty, so nothing exercises this code in production yet.
 * That is exactly why it is tested: a policy whose implementation has never
 * run is a promise, and the first time it matters is the worst time to find
 * out the header was malformed.
 */

const DAY = 24 * 60 * 60 * 1000

/** A fixture standing in for a real entry, so the machinery is exercised. */
const retired: Deprecation = {
  path: '/api/v1/legacy',
  deprecatedAt: '2026-01-01T00:00:00.000Z',
  sunsetAt: '2026-12-31T00:00:00.000Z',
  documentation: 'https://marcusboni.com.br/developers#versioning',
}

describe('the published policy', () => {
  it('agrees with the number the specification prints', () => {
    // The spec is built from `src/`, the headers from `netlify/lib/`; the edge
    // runtime cannot import the former, so the constant exists twice.
    expect(MINIMUM_NOTICE_DAYS).toBe(SPEC_NOTICE_DAYS)
  })

  it('is stated in the OpenAPI description, where a client will read it', () => {
    const description = (openApiDocument().info as { description: string }).description
    expect(description).toContain('## Versioning and deprecation')
    expect(description).toContain('/api/v2')
    expect(description).toContain(String(MINIMUM_NOTICE_DAYS))
    expect(description).toContain('Deprecation')
    expect(description).toContain('Sunset')
  })

  it('versions in the URL path, matching what the paths actually do', () => {
    expect(VERSIONING_POLICY.scheme).toBe('URL path')
    for (const path of Object.keys(openApiDocument().paths as object)) {
      expect(path.startsWith(VERSIONING_POLICY.current)).toBe(true)
    }
  })
})

describe('current state', () => {
  it('deprecates nothing', () => {
    // If this fails, someone added an entry — check the notice period below.
    expect(DEPRECATIONS).toEqual([])
  })

  it('emits no headers for a live path', () => {
    expect(deprecationHeaders('/api/v1/profile')).toEqual({})
    expect(findDeprecation('/api/v1/profile')).toBeNull()
  })

  it('honours the notice period for every entry that is ever added', () => {
    for (const entry of DEPRECATIONS) {
      const notice =
        (new Date(entry.sunsetAt).getTime() - new Date(entry.deprecatedAt).getTime()) / DAY
      expect(
        notice,
        `${entry.path} gives ${notice} days; the published policy promises ${MINIMUM_NOTICE_DAYS}`,
      ).toBeGreaterThanOrEqual(MINIMUM_NOTICE_DAYS)
    }
  })
})

describe('the headers, exercised with a fixture', () => {
  const headers = deprecationHeaders(retired.path, [retired])

  it('formats Deprecation as RFC 9745 unix seconds', () => {
    expect(headers.Deprecation).toBe(`@${Date.UTC(2026, 0, 1) / 1000}`)
  })

  it('formats Sunset as an RFC 8594 HTTP date', () => {
    expect(headers.Sunset).toBe(new Date(retired.sunsetAt).toUTCString())
    // IMF-fixdate, e.g. "Thu, 31 Dec 2026 00:00:00 GMT".
    expect(headers.Sunset).toMatch(/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} .* GMT$/)
  })

  it('links the explanation with rel="deprecation"', () => {
    expect(headers.Link).toBe(
      `<${retired.documentation}>; rel="deprecation"; type="text/html"`,
    )
  })

  it('says nothing about a path that is not the deprecated one', () => {
    expect(deprecationHeaders('/api/v1/profile', [retired])).toEqual({})
  })

  it('stays silent rather than lying when a date is malformed', () => {
    const broken = { ...retired, sunsetAt: 'não é uma data' }
    expect(deprecationHeaders(broken.path, [broken])).toEqual({})
  })
})
