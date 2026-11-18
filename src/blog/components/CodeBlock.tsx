import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ThemedToken } from 'shiki/core'

import { StageContext, useBodyLabels } from '@/blog/lib/body-context'
import { parseFenceMeta } from '@/blog/lib/code-meta'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  code: string
  /** Fence language tag, e.g. `ts` in a ```ts fence. */
  lang?: string
  /** Fence meta, e.g. `title="src/app.ts" {2,4-6}`. See `lib/code-meta.ts`. */
  meta?: string
}

/** Shiki's `fontStyle` is a bitmask: 1 italic, 2 bold, 4 underline. */
function tokenStyle(token: ThemedToken): React.CSSProperties {
  const style = token.fontStyle ?? 0
  return {
    color: token.color,
    fontStyle: style & 1 ? 'italic' : undefined,
    fontWeight: style & 2 ? 600 : undefined,
    textDecoration: style & 4 ? 'underline' : undefined,
  }
}

/**
 * Editorial code block: filename tab, copy button, Shiki highlighting in the
 * site's own theme, and lines that can be marked, numbered or shown as a diff.
 *
 * Every line is its own element from the first paint. Shiki resolves later
 * (one grammar per language) and only swaps the *contents* of each line for
 * coloured tokens, so nothing moves when it lands, the block reads fine if it
 * never does, and a marked line is marked before and after.
 *
 * Inside a walkthrough (`::::steps`) the lines to light come from the step
 * being read rather than from the fence, and the block scrolls itself to them.
 */
export function CodeBlock({ code, lang, meta }: CodeBlockProps) {
  const labels = useBodyLabels()
  const stage = useContext(StageContext)
  const [tokens, setTokens] = useState<ThemedToken[][] | null>(null)
  const [copied, setCopied] = useState(false)
  const timeout = useRef<number | undefined>(undefined)
  const scroller = useRef<HTMLPreElement>(null)

  const info = useMemo(() => parseFenceMeta(meta), [meta])
  const lines = useMemo(() => code.split('\n'), [code])
  const marked = stage ?? info.marked
  const hasDiff = info.added.size > 0 || info.removed.size > 0

  useEffect(() => {
    let cancelled = false
    // Shiki is pulled in only once a code block actually mounts, so a post with
    // no fences never downloads the highlighter (~170 KB gzipped).
    void import('@/blog/lib/highlighter')
      .then(({ highlight }) => highlight(code, lang))
      .then((result) => {
        if (!cancelled && result) setTokens(result)
      })
      .catch(() => {
        /* highlighting is an enhancement — the plain lines below still read */
      })
    return () => {
      cancelled = true
    }
  }, [code, lang])

  useEffect(() => () => window.clearTimeout(timeout.current), [])

  // In a walkthrough, bring the lines of the current step into the panel.
  useEffect(() => {
    const pre = scroller.current
    if (!stage || !pre) return
    const first = pre.querySelector<HTMLElement>('.line.is-marked')
    if (!first) return
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    pre.scrollTo({
      top: Math.max(0, first.offsetTop - pre.clientHeight * 0.3),
      behavior: calm ? 'auto' : 'smooth',
    })
  }, [stage])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      timeout.current = window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked by the browser — the code is still selectable */
    }
  }

  return (
    <figure className="group my-10 border border-line bg-ink">
      <figcaption className="flex items-center justify-between gap-4 border-b border-line px-4 py-2.5">
        <span className="truncate font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
          {info.title ?? lang ?? 'code'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 font-mono text-[10px] tracking-[0.18em] text-smoke uppercase transition-colors hover:text-ember focus-visible:text-ember"
        >
          <span aria-live="polite">{copied ? labels.copied : labels.copy}</span>
        </button>
      </figcaption>

      {/* Focusable so a keyboard can scroll a block wider than the column. */}
      <pre
        ref={scroller}
        tabIndex={0}
        aria-label={info.title ? `${labels.code}: ${info.title}` : labels.code}
        className={cn(
          'shiki-host',
          info.numbers && 'has-numbers',
          info.wrap && 'is-wrapped',
          hasDiff && 'has-diff',
          stage && stage.size > 0 && 'is-focused',
        )}
      >
        <code>
          {lines.map((line, index) => {
            const number = index + 1
            return (
              <span
                key={index}
                className={cn(
                  'line',
                  marked.has(number) && 'is-marked',
                  info.added.has(number) && 'is-added',
                  info.removed.has(number) && 'is-removed',
                )}
              >
                {tokens?.[index]
                  ? tokens[index].map((token, at) => (
                      <span key={at} style={tokenStyle(token)}>
                        {token.content}
                      </span>
                    ))
                  : line}
                {'\n'}
              </span>
            )
          })}
        </code>
      </pre>
    </figure>
  )
}

/** Inline code — an ember tint rather than a heavy chip. */
export function InlineCode({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-[2px] bg-ember/10 px-1.5 py-0.5 font-mono text-[0.85em] text-ember">
      {children}
    </code>
  )
}
