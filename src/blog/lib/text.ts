import type { TocEntry } from '@/blog/types'

/**
 * Pure text helpers shared by the public blog, the admin editor and the
 * Netlify edge functions. Deliberately dependency-free so the edge runtime
 * (Deno) can import the same logic the browser uses.
 */

/** Words per minute for technical prose — deliberately conservative. */
const WPM = 200

/**
 * URL-safe slug from a title. Strips Portuguese diacritics so
 * "Padrões de Concorrência" becomes `padroes-de-concorrencia`.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Strips Markdown down to readable prose. Used for reading time, excerpts and
 * the plain-text description the edge function injects into meta tags.
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    // fenced code — dropped entirely, nobody "reads" it at prose speed
    .replace(/```[\s\S]*?```/g, ' ')
    // container directives (:::callout … :::) keep their inner text
    .replace(/^:{3,}[^\n]*$/gm, ' ')
    // leaf directives (::youtube{...}) carry no prose
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

/** Reading time in whole minutes, never below 1. */
export function readingMinutes(markdown: string): number {
  const words = stripMarkdown(markdown).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / WPM))
}

/**
 * Auto-excerpt from the body, cut on a word boundary. Only a fallback — the
 * editor lets you write a deliberate one, which always wins.
 */
export function autoExcerpt(markdown: string, max = 200): string {
  const text = stripMarkdown(markdown)
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

/**
 * Heading ids must match what `rehype-slug` generates at render time, or the
 * table of contents links point at nothing. `rehype-slug` uses
 * github-slugger, whose rule is: lowercase, strip anything that is not a
 * word character / space / hyphen, then spaces to hyphens. Diacritics are
 * *kept* (unlike `slugify` above), so this cannot reuse it.
 */
function headingId(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-')
}

/**
 * Extracts h2/h3 headings for the table of contents. Runs on the raw Markdown
 * rather than the rendered DOM so the TOC is available before the (lazy)
 * renderer has mounted.
 */
export function extractToc(markdown: string): TocEntry[] {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '')
  const entries: TocEntry[] = []
  const seen = new Map<string, number>()

  for (const match of withoutCode.matchAll(/^(#{2,3})\s+(.+?)\s*#*$/gm)) {
    const depth = match[1].length as 2 | 3
    const text = stripMarkdown(match[2])
    if (!text) continue

    // github-slugger de-duplicates by appending -1, -2, … — mirror that.
    const base = headingId(text)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    entries.push({ id: count === 0 ? base : `${base}-${count}`, text, depth })
  }
  return entries
}

/** `2026-09-03` → `3 set 2026` (pt) / `Sep 3, 2026` (en). */
export function formatPostDate(iso: string | null, locale: 'pt' | 'en'): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(locale === 'pt' ? 'pt-BR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(date)
}
