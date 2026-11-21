import { useEffect, useRef, useState } from 'react'

import { locateQuote, parseQuoteHash, quoteHash, type Quote } from '@/blog/lib/quote-link'
import { SITE_URL } from '@/blog/lib/seo'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'

/** Shorter than this, a selection is a word being looked up, not a quote. */
const MIN_QUOTE = 12

/**
 * How a passage reached through a quote link is painted: ember at 32% under
 * the type colour. It lives here, not in index.css, because the CSS minifier
 * does not know `::highlight()` yet and warns on every build; and it spells
 * the colours out because a highlight cannot be relied on to resolve `var()`.
 * Where it does not resolve `light-dark()` either, the text keeps its own
 * colour, which reads on that tint in both schemes.
 */
const QUOTE_MARK = '::highlight(quote){background-color:rgb(255 77 23/.32);color:light-dark(#14120f,#ece7df)}'

interface Selected {
  text: string
  top: number
  left: number
  /** A touch selection already has the system's menu above it. */
  below: boolean
}

/**
 * The passage a quote link points at, as a DOM range inside `root`.
 *
 * Text nodes that are not displayed (a folded margin note) are skipped, so the
 * text searched is the text a reader could have selected.
 */
function quoteRange(root: HTMLElement, quote: Quote): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: { node: Text; at: number }[] = []
  let text = ''
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (!node.parentElement?.getClientRects().length) continue
    nodes.push({ node, at: text.length })
    text += node.data
  }

  const found = locateQuote(text, quote)
  if (!found) return null

  const point = (offset: number): [Text, number] => {
    let hit = nodes[0]
    for (const item of nodes) {
      if (item.at > offset) break
      hit = item
    }
    return [hit.node, Math.min(offset - hit.at, hit.node.length)]
  }
  const range = document.createRange()
  range.setStart(...point(found[0]))
  range.setEnd(...point(found[1]))
  return range
}

/**
 * Quoting an entry.
 *
 * Selecting a passage brings up a small toolbar: copy a link that opens the
 * entry on that exact passage, copy it as a quote, or share it. Arriving
 * through such a link scrolls to the passage and marks it.
 *
 * Rendered inside the (positioned) article column, which it measures against.
 */
export function QuoteShare({
  containerRef,
  slug,
  title,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  slug: string
  title: string
}) {
  const { t } = useLanguage()
  const [selected, setSelected] = useState<Selected | null>(null)
  const [copied, setCopied] = useState<'link' | 'text' | null>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const timeout = useRef<number | undefined>(undefined)

  // Arriving on a quote link: find the passage, bring it into view, mark it.
  useEffect(() => {
    const show = () => {
      const container = containerRef.current
      const quote = parseQuoteHash(location.hash)
      if (!container || !quote) return
      const range = quoteRange(container, quote)
      if (!range) return
      // Painted through the Highlight API where it exists: no wrapper element
      // is added, so the article's markup stays exactly what React rendered.
      if ('highlights' in CSS) CSS.highlights.set('quote', new Highlight(range))
      const top = window.scrollY + range.getBoundingClientRect().top - window.innerHeight * 0.3
      window.scrollTo({ top: Math.max(0, top) })
    }
    // One frame later, so the article has been laid out.
    const frame = requestAnimationFrame(show)
    window.addEventListener('hashchange', show)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('hashchange', show)
      if ('highlights' in CSS) CSS.highlights.delete('quote')
    }
  }, [containerRef, slug])

  useEffect(() => {
    let dragging = false
    let frame = 0

    const read = () => {
      frame = 0
      const container = containerRef.current
      const selection = document.getSelection()
      if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSelected(null)
        return
      }
      const range = selection.getRangeAt(0)
      const text = selection.toString().trim()
      if (text.length < MIN_QUOTE || !container.contains(range.commonAncestorContainer)) {
        setSelected(null)
        return
      }
      const rect = range.getBoundingClientRect()
      const box = container.getBoundingClientRect()
      const below = window.matchMedia('(pointer: coarse)').matches
      setSelected({
        text,
        below,
        top: (below ? rect.bottom + 12 : rect.top - 12) - box.top,
        left: rect.left + rect.width / 2 - box.left,
      })
    }

    const onDown = (event: PointerEvent) => {
      if (toolbar.current?.contains(event.target as Node)) return
      dragging = true
      setSelected(null)
    }
    const onUp = () => {
      dragging = false
      // The selection settles after the pointer is released.
      frame ||= requestAnimationFrame(read)
    }
    // Keyboard selection, and the handles of a touch selection.
    const onChange = () => {
      if (!dragging) frame ||= requestAnimationFrame(read)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null)
    }

    document.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    document.addEventListener('selectionchange', onChange)
    document.addEventListener('keydown', onKey)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.clearTimeout(timeout.current)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      document.removeEventListener('selectionchange', onChange)
      document.removeEventListener('keydown', onKey)
    }
  }, [containerRef])

  if (!selected) return <style>{QUOTE_MARK}</style>

  const passage = selected.text.replace(/\s+/g, ' ')
  const url = `${SITE_URL}/blog/${slug}${quoteHash(selected.text)}`
  const clipped = passage.length > 200 ? `${passage.slice(0, 199).trimEnd()}…` : passage

  const copy = async (kind: 'link' | 'text') => {
    try {
      await navigator.clipboard.writeText(
        kind === 'link' ? url : `“${passage}”\n— Marcus Boni, ${title}\n${url}`,
      )
      setCopied(kind)
      window.clearTimeout(timeout.current)
      timeout.current = window.setTimeout(() => setCopied(null), 1800)
      trackEvent('post_share', { slug, channel: kind === 'link' ? 'quote_link' : 'quote_copy' })
    } catch {
      /* clipboard unavailable — the share links beside it still work */
    }
  }

  const item =
    'px-2.5 py-2.5 font-mono text-[10px] tracking-[0.16em] text-bone-dim uppercase transition-colors duration-300 hover:text-ember focus-visible:text-ember sm:px-3.5'

  return (
    <>
    <style>{QUOTE_MARK}</style>
    <div
      ref={toolbar}
      role="toolbar"
      aria-label={t.blog.post.quote.toolbar}
      // Keeps a click on the toolbar from clearing the selection it acts on.
      onPointerDown={(event) => event.preventDefault()}
      style={{ top: selected.top, left: `clamp(9.5rem, ${selected.left}px, 100% - 9.5rem)` }}
      className={cn(
        'absolute z-30 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap justify-center divide-x divide-line border border-line bg-ink-soft shadow-[0_18px_40px_-12px_var(--shade)] select-none',
        'transition-[opacity,scale] duration-300 ease-out-expo starting:scale-95 starting:opacity-0',
        selected.below ? 'origin-top' : 'origin-bottom -translate-y-full',
      )}
    >
      <button type="button" className={item} onClick={() => copy('link')}>
        <span aria-live="polite">
          {copied === 'link' ? t.blog.post.quote.copied : t.blog.post.quote.link}
        </span>
      </button>
      <button type="button" className={item} onClick={() => copy('text')}>
        <span aria-live="polite">
          {copied === 'text' ? t.blog.post.quote.copied : t.blog.post.quote.text}
        </span>
      </button>
      <a
        className={item}
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackEvent('post_share', { slug, channel: 'quote_linkedin' })}
      >
        LinkedIn
      </a>
      <a
        className={item}
        href={`https://x.com/intent/tweet?text=${encodeURIComponent(`“${clipped}”`)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => trackEvent('post_share', { slug, channel: 'quote_x' })}
      >
        X
      </a>
    </div>
    </>
  )
}
