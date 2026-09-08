import { useEffect, useRef, useState, type ReactNode } from 'react'

interface CodeBlockProps {
  code: string
  /** Fence language tag, e.g. `ts` in a ```ts fence. */
  lang?: string
  /** Fence meta, e.g. `title="src/app.ts"`. */
  meta?: string
}

/** Pulls `title="…"` out of the fence meta string. */
function parseTitle(meta: string | undefined): string | null {
  if (!meta) return null
  const match = /(?:title|file)=("([^"]*)"|'([^']*)'|(\S+))/.exec(meta)
  return match ? (match[2] ?? match[3] ?? match[4] ?? null) : null
}

/**
 * Editorial code block: optional filename tab, copy button, Shiki highlighting
 * in the site's own theme.
 *
 * Shiki resolves asynchronously (one grammar per language), so the plain code
 * renders first inside the same `<pre>` geometry and is swapped in place. The
 * code stays readable if the highlighter never resolves, and there is no
 * layout jump when it does.
 */
export function CodeBlock({ code, lang, meta }: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const timeout = useRef<number | undefined>(undefined)
  const title = parseTitle(meta)

  useEffect(() => {
    let cancelled = false
    // Shiki is pulled in only once a code block actually mounts, so a post with
    // no fences never downloads the highlighter (~170 KB gzipped).
    void import('@/blog/lib/highlighter')
      .then(({ highlight }) => highlight(code, lang))
      .then((result) => {
        if (!cancelled && result) setHtml(result)
      })
      .catch(() => {
        /* highlighting is an enhancement — the plain <pre> below still reads */
      })
    return () => {
      cancelled = true
    }
  }, [code, lang])

  useEffect(() => () => window.clearTimeout(timeout.current), [])

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
          {title ?? lang ?? 'code'}
        </span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 font-mono text-[10px] tracking-[0.18em] text-smoke uppercase transition-colors hover:text-ember focus-visible:text-ember focus-visible:outline-none"
        >
          {copied ? 'copiado' : 'copiar'}
        </button>
      </figcaption>

      {html ? (
        /* Shiki escapes every token it emits, and the input is our own
           Markdown fence content — never third-party HTML. */
        <div
          className="shiki-host overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="shiki-host overflow-x-auto">
          <code>{code}</code>
        </pre>
      )}
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
