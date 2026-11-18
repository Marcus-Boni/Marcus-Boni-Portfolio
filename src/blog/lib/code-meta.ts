/**
 * The text after the language on a code fence:
 *
 *   ```ts title="src/retry.ts" {2,4-6} add={8} del={7} numbers wrap
 *
 * Kept free of imports so the tests and the editor can read it without pulling
 * the highlighter.
 */
export interface FenceMeta {
  title: string | null
  /** Lines to call out, 1-based. */
  marked: Set<number>
  added: Set<number>
  removed: Set<number>
  numbers: boolean
  wrap: boolean
}

/** Longest range a single `a-b` may expand to; a typo must not build a huge set. */
const MAX_SPAN = 400

/** `"1,3-5"` → `{1, 3, 4, 5}`. Anything that is not a number or a range is skipped. */
export function parseLineRanges(spec: string | null | undefined): Set<number> {
  const lines = new Set<number>()
  for (const part of (spec ?? '').split(',')) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(part)
    if (!match) continue
    const from = Number(match[1])
    const to = Math.min(match[2] ? Number(match[2]) : from, from + MAX_SPAN)
    for (let line = from; line <= to; line++) if (line > 0) lines.add(line)
  }
  return lines
}

const TITLE = /(?:title|file)=("([^"]*)"|'([^']*)'|(\S+))/

export function parseFenceMeta(meta: string | null | undefined): FenceMeta {
  const source = meta ?? ''
  const title = TITLE.exec(source)
  // Flags are read from what is left, so a file called `wrap.ts` turns nothing on.
  const rest = source.replace(TITLE, ' ')
  const group = (pattern: RegExp) => parseLineRanges(pattern.exec(rest)?.[1])

  return {
    title: title ? (title[2] ?? title[3] ?? title[4] ?? null) : null,
    marked: group(/(?:^|\s)\{([\d\s,-]+)\}/),
    added: group(/\badd=\{?([\d,-]+)\}?/),
    removed: group(/\bdel=\{?([\d,-]+)\}?/),
    numbers: /(?:^|\s)numbers(?:\s|$)/.test(rest),
    wrap: /(?:^|\s)wrap(?:\s|$)/.test(rest),
  }
}
