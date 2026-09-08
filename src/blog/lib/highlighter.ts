import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

import { signalInkTheme } from './shiki-theme'

/**
 * Shiki, assembled fine-grained.
 *
 * Two deliberate choices keep this affordable on a page that must not regress
 * the site's load budget:
 *
 *  1. `createHighlighterCore` + explicit imports instead of the default bundle,
 *     which would pull every language Shiki ships.
 *  2. `createJavaScriptRegexEngine` instead of the Oniguruma engine, which
 *     would drag in a ~500 KB WASM binary. The JS engine handles every grammar
 *     registered below.
 *
 * Grammars load on demand — a post with one SQL snippet never downloads the
 * C# grammar.
 */

/** Grammars worth carrying, matched to the stack this blog writes about. */
const LANGS = {
  typescript: () => import('@shikijs/langs/typescript'),
  tsx: () => import('@shikijs/langs/tsx'),
  javascript: () => import('@shikijs/langs/javascript'),
  jsx: () => import('@shikijs/langs/jsx'),
  json: () => import('@shikijs/langs/json'),
  bash: () => import('@shikijs/langs/bash'),
  sql: () => import('@shikijs/langs/sql'),
  csharp: () => import('@shikijs/langs/csharp'),
  python: () => import('@shikijs/langs/python'),
  yaml: () => import('@shikijs/langs/yaml'),
  docker: () => import('@shikijs/langs/docker'),
  html: () => import('@shikijs/langs/html'),
  css: () => import('@shikijs/langs/css'),
  markdown: () => import('@shikijs/langs/markdown'),
  diff: () => import('@shikijs/langs/diff'),
} as const

export type SupportedLang = keyof typeof LANGS

/** Common fence aliases mapped onto the grammars above. */
const ALIASES: Record<string, SupportedLang> = {
  ts: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsonc: 'json',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  cs: 'csharp',
  'c#': 'csharp',
  py: 'python',
  yml: 'yaml',
  dockerfile: 'docker',
  md: 'markdown',
  mdx: 'markdown',
  postgres: 'sql',
  psql: 'sql',
}

/** Resolves a fence tag to a grammar, or `null` when we have none for it. */
export function resolveLang(tag: string | undefined): SupportedLang | null {
  if (!tag) return null
  const key = tag.toLowerCase()
  if (key in LANGS) return key as SupportedLang
  return ALIASES[key] ?? null
}

let highlighterPromise: Promise<HighlighterCore> | null = null
const loaded = new Set<SupportedLang>()

function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: [signalInkTheme],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  })
  return highlighterPromise
}

/**
 * Highlights `code`, loading the grammar on first use. Returns `null` when the
 * language is unsupported so the caller can fall back to plain text rather
 * than render an error.
 */
export async function highlight(
  code: string,
  tag: string | undefined,
): Promise<string | null> {
  const lang = resolveLang(tag)
  if (!lang) return null

  const highlighter = await getHighlighter()
  if (!loaded.has(lang)) {
    const grammar = await LANGS[lang]()
    await highlighter.loadLanguage(grammar.default)
    loaded.add(lang)
  }

  return highlighter.codeToHtml(code, {
    lang,
    theme: signalInkTheme.name!,
    // The surrounding <figure> already paints the surface and padding.
    structure: 'classic',
  })
}
