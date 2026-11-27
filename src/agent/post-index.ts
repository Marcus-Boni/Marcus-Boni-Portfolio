import { headingId, stripMarkdown } from '@/blog/lib/text'
import type { PostBodies, PostMeta } from '@/blog/types'
import type { Locale } from '@/i18n/translations'

/**
 * Pure Markdown section indexer for the technical journal (`/blog`).
 *
 * Splits published post bodies by headings using the exact `headingId` rules
 * shared with `extractToc` and `rehype-slug` (`github-slugger`), so every
 * matched section carries a verified `#heading` anchor that lands directly on
 * the corresponding section of the article.
 */

export interface MarkdownSection {
  /** Exact `rehype-slug` id, or empty string for the lead intro before the first heading. */
  headingId: string
  headingText: string
  depth: number
  text: string
  excerpt: string
}

export interface IndexedPostSection {
  slug: string
  postTitle: string
  locale: Locale
  headingId: string
  headingText: string
  depth: number
  text: string
  excerpt: string
  /** Canonical blog URL with `#headingId` when pointing to a specific section. */
  href: string
  tags: string[]
  readingMinutes: number
  publishedAt: string | null
}

/**
 * Strips Markdown formatting while preserving inline code identifiers (e.g.
 * `prefers-reduced-motion`, `LCP`, `pgvector`) so technical prose stays
 * discoverable during retrieval.
 */
function toSearchableProse(markdown: string): string {
  const keepInlineCode = markdown.replace(/`([^`\n]+)`/g, '$1')
  return stripMarkdown(keepInlineCode)
}

function makeExcerpt(prose: string, max = 230): string {
  const clean = prose.trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

function normalizeForWindow(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
}

/**
 * Extracts a query-centered excerpt from a long article section so both the
 * citation preview card and Edge LLM grounding receive the exact sentences
 * answering the user's question (rather than always cutting at char 230).
 */
export function extractRelevantSnippet(
  prose: string,
  queryTokens: readonly string[],
  max = 460,
): string {
  const clean = prose.trim()
  if (clean.length <= max) return clean
  if (queryTokens.length === 0) return makeExcerpt(clean, max)

  // Split into sentence chunks and pick the best-scoring sentence window
  const sentences = clean.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean]
  if (sentences.length <= 1) return makeExcerpt(clean, max)

  const normTokens = queryTokens.map(normalizeForWindow).filter((t) => t.length >= 2)
  let bestIdx = 0
  let bestScore = -1

  for (let i = 0; i < sentences.length; i += 1) {
    const normSentence = normalizeForWindow(sentences[i])
    let score = 0
    for (const token of normTokens) {
      if (normSentence.includes(token)) score += token.length >= 4 ? 3 : 2
    }
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  if (bestScore <= 0) return makeExcerpt(clean, max)

  let snippet = sentences[bestIdx]
  let left = bestIdx - 1
  let right = bestIdx + 1

  while (right < sentences.length && snippet.length + 1 + sentences[right].length <= max) {
    snippet = `${snippet} ${sentences[right]}`
    right += 1
  }
  while (left >= 0 && snippet.length + 1 + sentences[left].length <= max) {
    snippet = `${sentences[left]} ${snippet}`
    left -= 1
  }

  if (snippet.length > max) {
    snippet = makeExcerpt(snippet, max)
  }
  return left >= 0 ? `… ${snippet}` : snippet
}

const HEADING_RE =
  /^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$|^([^\n]+)\n {0,3}(=+|-+)[ \t]*$/gm

/**
 * Splits a Markdown document into searchable sections with verified anchor IDs
 * matching `rehype-slug` / `extractToc` (including `-1`, `-2` duplicate suffixes).
 */
export function extractMarkdownSections(markdown: string): MarkdownSection[] {
  if (!markdown.trim()) return []

  // Drop fenced code blocks before finding headings so `# comment` lines inside
  // bash/python code snippets never turn into bogus section anchors.
  const withoutCode = markdown.replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1/g, '')
  const matches = [...withoutCode.matchAll(HEADING_RE)]
  const offset = matches.some(
    (match) => match[1]?.length === 1 || match[4]?.startsWith('='),
  )
    ? 1
    : 0

  const sections: MarkdownSection[] = []
  const seen = new Set<string>()

  // 1. Lead / intro section before the first heading
  const leadEnd = matches.length > 0 ? (matches[0].index ?? 0) : withoutCode.length
  const leadProse = toSearchableProse(withoutCode.slice(0, leadEnd))
  if (leadProse.length >= 24) {
    sections.push({
      headingId: '',
      headingText: '',
      depth: 1,
      text: leadProse,
      excerpt: makeExcerpt(leadProse),
    })
  }

  // 2. Every heading section from its heading line to the start of the next heading
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]
    const originalDepth = match[1]?.length ?? (match[4].startsWith('=') ? 1 : 2)
    const depth = Math.min(6, originalDepth + offset)
    const headingText = stripMarkdown((match[2] ?? match[3]).replace(/`([^`]+)`/g, '$1'))
    if (!headingText) continue

    const base = headingId(headingText)
    let id = base
    let count = 0
    while (seen.has(id)) id = `${base}-${++count}`
    seen.add(id)

    const bodyStart = (match.index ?? 0) + match[0].length
    const bodyEnd = i + 1 < matches.length ? (matches[i + 1].index ?? withoutCode.length) : withoutCode.length
    const prose = toSearchableProse(withoutCode.slice(bodyStart, bodyEnd))

    if (!prose) continue

    sections.push({
      headingId: id,
      headingText,
      depth,
      text: prose,
      excerpt: makeExcerpt(prose),
    })
  }

  return sections
}

function canonicalPostBasePath(post: PostMeta, locale: Locale): string {
  const bilingual = Boolean(post.locales?.pt && post.locales?.en)
  if (locale === 'en' && bilingual) return `/en/blog/${post.slug}`
  return `/blog/${post.slug}`
}

/**
 * Builds a flat searchable section index across all published posts and their
 * loaded Markdown bodies (both PT and EN when bilingual).
 */
export function buildPostSectionIndex(
  posts: readonly PostMeta[],
  bodiesBySlug: Readonly<Record<string, PostBodies | string | undefined>>,
): IndexedPostSection[] {
  const out: IndexedPostSection[] = []

  for (const post of posts) {
    const rawBodies = bodiesBySlug[post.slug]
    const localesToIndex: Locale[] = []
    if (post.locales?.pt || post.lang === 'pt') localesToIndex.push('pt')
    if (post.locales?.en || post.lang === 'en') localesToIndex.push('en')
    if (localesToIndex.length === 0) localesToIndex.push(post.lang)

    for (const loc of localesToIndex) {
      const view = post.locales?.[loc]
      const postTitle = view?.title || post.title
      const tags = view?.tags ?? post.tags
      const readingMinutes = view?.readingMinutes ?? post.readingMinutes
      const basePath = canonicalPostBasePath(post, loc)

      const markdown =
        typeof rawBodies === 'string'
          ? loc === post.lang
            ? rawBodies
            : ''
          : rawBodies?.[loc] ?? (loc === post.lang ? rawBodies?.[post.lang] ?? '' : '')

      const sections = markdown ? extractMarkdownSections(markdown) : []

      if (sections.length === 0) {
        const fallbackText = [view?.subtitle ?? post.subtitle ?? '', view?.excerpt || post.excerpt]
          .filter(Boolean)
          .join(' ')
          .trim()
        if (!fallbackText) continue
        out.push({
          slug: post.slug,
          postTitle,
          locale: loc,
          headingId: '',
          headingText: '',
          depth: 1,
          text: fallbackText,
          excerpt: makeExcerpt(fallbackText),
          href: basePath,
          tags,
          readingMinutes,
          publishedAt: post.publishedAt,
        })
        continue
      }

      for (const sec of sections) {
        out.push({
          slug: post.slug,
          postTitle,
          locale: loc,
          headingId: sec.headingId,
          headingText: sec.headingText,
          depth: sec.depth,
          text: sec.text,
          excerpt: sec.excerpt,
          href: sec.headingId ? `${basePath}#${sec.headingId}` : basePath,
          tags,
          readingMinutes,
          publishedAt: post.publishedAt,
        })
      }
    }
  }

  return out
}
