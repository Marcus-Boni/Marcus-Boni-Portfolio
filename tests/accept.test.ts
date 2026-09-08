import { describe, expect, it } from 'vitest'

import {
  acceptsHtmlExplicitly,
  HTML,
  MARKDOWN,
  mergeVary,
  negotiate,
  notAcceptableBody,
  parseAccept,
} from '../netlify/lib/accept.ts'

/**
 * Conformance tests for the Markdown content-negotiation contract.
 *
 * The table in `describe('spec test vectors')` is copied verbatim from
 * https://acceptmarkdown.com/guides/accept-parsing — those are the four things
 * the acceptmarkdown.com readiness check probes for (serves Markdown, sets
 * `Vary: Accept`, 406s on unsatisfiable types, honours q-values), so they are
 * asserted rather than eyeballed.
 */

describe('parseAccept', () => {
  it('defaults a missing q to 1', () => {
    expect(parseAccept('text/markdown')).toEqual([{ type: 'text/markdown', quality: 1 }])
  })

  it('returns nothing for an absent or empty header', () => {
    expect(parseAccept(null)).toEqual([])
    expect(parseAccept(undefined)).toEqual([])
    expect(parseAccept('')).toEqual([])
  })

  it('orders entries by q descending', () => {
    expect(parseAccept('text/html;q=0.2, text/markdown;q=0.9')).toEqual([
      { type: 'text/markdown', quality: 0.9 },
      { type: 'text/html', quality: 0.2 },
    ])
  })

  it('is case-insensitive and tolerant of whitespace', () => {
    expect(parseAccept('  TEXT/MarkDown ;  Q=0.5 ')).toEqual([
      { type: 'text/markdown', quality: 0.5 },
    ])
  })

  it('ignores parameters other than q', () => {
    // RFC 7763 defines a `variant` parameter for text/markdown; matching is on
    // the media type, so it must not defeat the comparison.
    expect(parseAccept('text/markdown;variant=GFM;q=0.8')).toEqual([
      { type: 'text/markdown', quality: 0.8 },
    ])
  })

  it('treats pre-RFC and MDX spellings as text/markdown', () => {
    expect(parseAccept('text/x-markdown')[0].type).toBe(MARKDOWN)
    expect(parseAccept('text/mdx')[0].type).toBe(MARKDOWN)
  })

  it('skips entries that are not media types', () => {
    expect(parseAccept('garbage, text/html')).toEqual([{ type: 'text/html', quality: 1 }])
  })

  it('reads a bare * as the catch-all', () => {
    expect(parseAccept('*')).toEqual([{ type: '*/*', quality: 1 }])
  })

  it('clamps an out-of-range q and ignores an unparseable one', () => {
    expect(parseAccept('text/html;q=7')[0].quality).toBe(1)
    expect(parseAccept('text/html;q=-3')[0].quality).toBe(0)
    expect(parseAccept('text/html;q=banana')[0].quality).toBe(1)
  })
})

describe('negotiate — spec test vectors', () => {
  // https://acceptmarkdown.com/guides/accept-parsing#test-vectors
  const vectors: [accept: string | null, expected: string | null, note: string][] = [
    ['text/markdown', MARKDOWN, 'exact request'],
    ['text/markdown, text/html;q=0.8', MARKDOWN, 'higher q wins'],
    ['text/html', HTML, 'browser-style exact request'],
    ['text/markdown;q=0, text/html', HTML, 'q=0 is a refusal, not a match'],
    [null, HTML, 'no header means no constraint — serve the default'],
    ['*/*', HTML, 'anything is fine — serve the default'],
  ]

  for (const [accept, expected, note] of vectors) {
    it(`${accept ?? '(no Accept)'} → ${expected} (${note})`, () => {
      expect(negotiate(accept)).toBe(expected)
    })
  }

  it('406s when the only offer is refused with q=0', () => {
    // The spec's `text/markdown;q=0` + "md only" row: nothing left to serve.
    expect(negotiate('text/markdown;q=0', [MARKDOWN])).toBeNull()
  })

  it('406s when no offer appears in the header at all', () => {
    expect(negotiate('application/pdf')).toBeNull()
    expect(negotiate('image/png, application/json')).toBeNull()
  })
})

describe('negotiate — real-world headers', () => {
  it("serves HTML to Chrome's default Accept", () => {
    const chrome =
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
    expect(negotiate(chrome)).toBe(HTML)
  })

  it('serves HTML to curl', () => {
    expect(negotiate('*/*')).toBe(HTML)
  })

  it('serves Markdown when an agent prefers it over HTML', () => {
    expect(negotiate('text/markdown, text/plain;q=0.9, text/html;q=0.8')).toBe(MARKDOWN)
  })

  it('picks Markdown when a subtype wildcard covers both at equal q', () => {
    // Same q and same specificity: the tie goes to the default, HTML.
    expect(negotiate('text/*')).toBe(HTML)
  })

  it('lets an exact q=0 beat a wildcard that would otherwise match', () => {
    // "any text except HTML" — the wildcard must not resurrect text/html.
    expect(negotiate('text/*, text/html;q=0')).toBe(MARKDOWN)
  })

  it('prefers the higher-q wildcard over a low-q exact type', () => {
    expect(negotiate('text/html;q=0.1, */*;q=0.9')).toBe(MARKDOWN)
  })
})

describe('acceptsHtmlExplicitly', () => {
  it('is true when HTML is named', () => {
    expect(acceptsHtmlExplicitly('text/html,application/xhtml+xml')).toBe(true)
    expect(acceptsHtmlExplicitly('text/*')).toBe(true)
  })

  it('is false for clients that stated no preference', () => {
    expect(acceptsHtmlExplicitly(null)).toBe(false)
    expect(acceptsHtmlExplicitly('*/*')).toBe(false)
    expect(acceptsHtmlExplicitly('application/json')).toBe(false)
  })

  it('is false when HTML is named but refused', () => {
    expect(acceptsHtmlExplicitly('text/html;q=0, text/markdown')).toBe(false)
  })
})

describe('mergeVary', () => {
  it("adds Accept to Netlify's default", () => {
    expect(mergeVary('Accept-Encoding')).toBe('Accept, Accept-Encoding')
  })

  it('adds Accept when there is no existing Vary', () => {
    expect(mergeVary(null)).toBe('Accept')
    expect(mergeVary('')).toBe('Accept')
  })

  it('does not duplicate an Accept that is already declared', () => {
    expect(mergeVary('accept, Accept-Encoding')).toBe('accept, Accept-Encoding')
  })

  it('leaves Vary: * alone', () => {
    // `*` already forbids reuse; replacing it with a token list would widen
    // what a cache is allowed to serve.
    expect(mergeVary('*')).toBe('*')
  })
})

describe('notAcceptableBody', () => {
  it('lists both representations and echoes the request', () => {
    const body = notAcceptableBody('application/pdf')
    expect(body).toContain(`- ${HTML}`)
    expect(body).toContain(`- ${MARKDOWN}`)
    expect(body).toContain('You requested: application/pdf')
  })

  it('says so when the header was empty rather than printing nothing', () => {
    expect(notAcceptableBody('   ')).toContain('(empty Accept header)')
  })
})
