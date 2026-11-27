import type { AgentLens, RuntimePreference } from '@/agent/types'
import type { Locale } from '@/i18n/translations'

/**
 * Pure deep-link, shareable brief, and Markdown export helpers for Phase 3.
 * Zero React dependency — directly covered by `tests/agent-phase3.test.ts`.
 */

const MAX_QUERY_PARAM_CHARS = 2_000
const MAX_SHARE_PROMPT_CHARS = 1_500

export interface ParsedAskParams {
  prompt?: string
  lens?: AgentLens
  mode?: RuntimePreference
}

export function parseAskQueryParams(search: string): ParsedAskParams {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)

  const rawPrompt = params.get('q')?.trim()
  const prompt =
    rawPrompt && rawPrompt.length > 0
      ? rawPrompt.slice(0, MAX_QUERY_PARAM_CHARS)
      : undefined

  const rawLens = params.get('lens')?.trim().toLowerCase()
  const lens: AgentLens | undefined =
    rawLens === 'recruiter' || rawLens === 'engineer' || rawLens === 'client'
      ? rawLens
      : undefined

  const rawMode = params.get('mode')?.trim().toLowerCase()
  const mode: RuntimePreference | undefined =
    rawMode === 'auto' || rawMode === 'local' ? rawMode : undefined

  return { prompt, lens, mode }
}

export function buildShareableAskPath(options: {
  locale: Locale
  prompt: string
  lens?: AgentLens
}): string {
  const base = options.locale === 'en' ? '/en/ask' : '/ask'
  const params = new URLSearchParams()
  if (options.lens) params.set('lens', options.lens)
  const cleanPrompt = options.prompt.trim().slice(0, MAX_SHARE_PROMPT_CHARS)
  if (cleanPrompt) params.set('q', cleanPrompt)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function buildShareableAskUrl(options: {
  origin?: string
  locale: Locale
  prompt: string
  lens?: AgentLens
}): string {
  const path = buildShareableAskPath(options)
  const origin =
    options.origin ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://marcusboni.com.br')
  return `${origin.replace(/\/+$/, '')}${path}`
}

export function buildBlogAskPath(options: {
  locale: Locale
  title: string
  tags: string[]
}): string {
  const cleanTitle = options.title.trim().slice(0, 120)
  const tagNote =
    options.tags.length > 0 ? ` (${options.tags.slice(0, 3).join(', ')})` : ''
  const prompt =
    options.locale === 'en'
      ? `Tell me about the article "${cleanTitle}"${tagNote} and how it connects to Marcus's projects.`
      : `Fale sobre o artigo "${cleanTitle}"${tagNote} e como ele se conecta aos projetos do Marcus.`
  return buildShareableAskPath({
    locale: options.locale,
    lens: 'engineer',
    prompt,
  })
}

export function slugifyBriefFilename(roleHint?: string): string {
  if (!roleHint) return 'marcus-boni-fit-brief.md'
  const slug = roleHint
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug ? `marcus-boni-fit-${slug}.md` : 'marcus-boni-fit-brief.md'
}

export function downloadMarkdownFile(filename: string, content: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  try {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}
