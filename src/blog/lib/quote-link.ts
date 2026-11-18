/**
 * Links to a passage of an entry: `/blog/slug#q=first words&e=last words`.
 *
 * The browser's own text fragments (`#:~:text=`) would be the obvious tool,
 * but they are resolved once, against the document as it first loads — and an
 * entry is rendered after its Markdown arrives. So the page keeps the quote in
 * an ordinary hash and finds the passage itself, when the text is on screen.
 *
 * The hash carries only the edges of the passage, each taken from a single
 * line, which keeps the link short and lets a quote span several paragraphs.
 */

export interface Quote {
  start: string
  /** Absent when the passage is short enough to travel whole in `start`. */
  end: string | null
}

const EDGE_WORDS = 8

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean)

export function quoteHash(selection: string): string {
  const lines = selection
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''

  const first = words(lines[0])
  const whole = lines.length === 1 && first.length <= EDGE_WORDS * 2
  const params = new URLSearchParams({
    q: (whole ? first : first.slice(0, EDGE_WORDS)).join(' '),
  })
  if (!whole) params.set('e', words(lines[lines.length - 1]).slice(-EDGE_WORDS).join(' '))
  return `#${params}`
}

/** `null` for any hash that is not a quote — a heading anchor, for instance. */
export function parseQuoteHash(hash: string): Quote | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const start = params.get('q')?.trim()
  return start ? { start, end: params.get('e')?.trim() || null } : null
}

/**
 * A snippet as a pattern that ignores how its words are spaced. Text read out
 * of the DOM has no spaces where one element ends and the next begins, while a
 * selection copied by the reader has line breaks there.
 */
function pattern(snippet: string): RegExp {
  return new RegExp(
    words(snippet)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s*'),
  )
}

/** Where the quoted passage sits in `text`, as `[from, to)`; `null` if it is gone. */
export function locateQuote(text: string, quote: Quote): [number, number] | null {
  const head = pattern(quote.start).exec(text)
  if (!head) return null
  const from = head.index
  const headEnd = from + head[0].length
  if (!quote.end) return [from, headEnd]

  // Searched from the start of the head: on a passage barely longer than one
  // edge, the two edges overlap.
  const tail = pattern(quote.end).exec(text.slice(from))
  return [from, tail ? Math.max(headEnd, from + tail.index + tail[0].length) : headEnd]
}
