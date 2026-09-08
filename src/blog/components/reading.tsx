import { useEffect, useRef, useState } from 'react'

import type { TocEntry } from '@/blog/types'
import { cn } from '@/lib/utils'

/* ─── Reading progress ──────────────────────────────────────────────────── */

/**
 * Hairline progress bar pinned under the header.
 *
 * Written straight to the DOM inside a rAF instead of through React state —
 * a scroll handler that re-renders the whole article on every frame is exactly
 * the kind of thing that shows up as Total Blocking Time.
 */
export function ReadingProgress({
  targetRef,
}: {
  targetRef: React.RefObject<HTMLElement | null>
}) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bar = barRef.current
    if (!bar) return

    let frame = 0
    const update = () => {
      frame = 0
      const el = targetRef.current
      if (!el) return
      const start = el.offsetTop
      const total = el.offsetHeight - window.innerHeight
      const progress =
        total <= 0 ? 1 : (window.scrollY - start) / total
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`
    }

    const onScroll = () => {
      frame ||= requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [targetRef])

  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-40 h-px bg-line/40"
    >
      <div
        ref={barRef}
        className="h-full origin-left scale-x-0 bg-ember"
      />
    </div>
  )
}

/* ─── Table of contents ─────────────────────────────────────────────────── */

/**
 * Sticky TOC for wide screens. Active-heading tracking uses an
 * IntersectionObserver over a band near the top of the viewport, so the
 * highlight follows the heading you are actually reading under rather than
 * whichever one is technically on screen.
 */
export function TableOfContents({
  entries,
  label,
}: {
  entries: TocEntry[]
  label: string
}) {
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    if (entries.length === 0) return
    const targets = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((record) => record.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: 0 },
    )
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [entries])

  if (entries.length < 2) return null

  return (
    <nav
      aria-label={label}
      className="sticky top-28 hidden max-h-[calc(100svh-9rem)] overflow-y-auto xl:block"
    >
      <p className="mb-4 border-b border-line pb-2 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
        {label}
      </p>
      <ul className="space-y-1.5">
        {entries.map((entry) => (
          <li key={entry.id} className={entry.depth === 3 ? 'pl-4' : undefined}>
            <a
              href={`#${entry.id}`}
              className={cn(
                'block border-l py-0.5 pl-3 text-[13px] leading-snug transition-colors duration-300',
                active === entry.id
                  ? 'border-l-ember text-ember'
                  : 'border-l-line text-smoke hover:text-bone-dim',
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
