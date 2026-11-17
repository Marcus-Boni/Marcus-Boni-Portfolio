import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'

import type { TocEntry } from '@/blog/types'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

/* ─── Reading position ──────────────────────────────────────────────────── */

/**
 * How far through the article the reader is, as a whole percentage.
 *
 * Kept outside React on purpose. The scroll handler writes the progress bar
 * straight to the DOM every frame, and only notifies subscribers when the
 * *integer* percentage changes — so the handful of components that print it
 * re-render at most a hundred times across a whole article, never per frame.
 */
const position = { percent: 0, listeners: new Set<() => void>() }

function publish(percent: number) {
  if (percent === position.percent) return
  position.percent = percent
  for (const listener of position.listeners) listener()
}

function subscribe(listener: () => void) {
  position.listeners.add(listener)
  return () => {
    position.listeners.delete(listener)
  }
}

function useReadingPercent(): number {
  return useSyncExternalStore(subscribe, () => position.percent, () => 0)
}

/**
 * Hairline progress bar pinned under the header, and the single source of
 * the reading position for everything else on the page.
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
        total <= 0 ? 1 : Math.min(1, Math.max(0, (window.scrollY - start) / total))
      bar.style.transform = `scaleX(${progress})`
      publish(Math.round(progress * 100))
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
      publish(0)
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

/** "4 min restantes", counting down from the post's reading time. */
function remainingLabel(
  percent: number,
  minutes: number,
  t: ReturnType<typeof useLanguage>['t'],
): string {
  if (percent >= 100) return t.blog.post.finished
  return t.blog.post.remaining(Math.ceil((minutes * (100 - percent)) / 100))
}

/** Time left and percentage read — the header of the desktop reading rail. */
export function ReadingStatus({ minutes }: { minutes: number }) {
  const { t } = useLanguage()
  const percent = useReadingPercent()

  return (
    <p className="flex items-baseline justify-between gap-4 border-b border-line pb-3 font-mono text-[10px] tracking-[0.2em] text-bone-dim uppercase">
      <span>{remainingLabel(percent, minutes, t)}</span>
      <span className="text-ember tabular-nums">{percent}%</span>
    </p>
  )
}

/* ─── Table of contents ─────────────────────────────────────────────────── */

/**
 * Which heading the reader is under. Uses an IntersectionObserver over a band
 * near the top of the viewport, so the highlight follows the heading you are
 * actually reading under rather than whichever one is technically on screen.
 */
function useActiveHeading(entries: TocEntry[]): string {
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

  return active
}

function TocList({
  entries,
  active,
  onNavigate,
}: {
  entries: TocEntry[]
  active: string
  onNavigate?: () => void
}) {
  const activeIndex = entries.findIndex((entry) => entry.id === active)

  return (
    <ul className="space-y-1">
      {entries.map((entry, index) => (
        <li key={entry.id} className={entry.depth === 3 ? 'pl-4' : undefined}>
          <a
            href={`#${entry.id}`}
            onClick={onNavigate}
            aria-current={active === entry.id ? 'location' : undefined}
            className={cn(
              'block border-l py-1 pl-3 text-[13px] leading-snug transition-colors duration-300',
              active === entry.id
                ? 'border-l-ember text-ember'
                : index < activeIndex
                  ? 'border-l-bone-dim/50 text-bone-dim hover:text-bone'
                  : 'border-l-line text-smoke hover:text-bone-dim',
            )}
          >
            {entry.text}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * Desktop table of contents. The sections already read stay a shade brighter
 * than the ones ahead, so the list doubles as a map of where you are.
 */
export function TableOfContents({
  entries,
  label,
}: {
  entries: TocEntry[]
  label: string
}) {
  const active = useActiveHeading(entries)
  if (entries.length < 2) return null

  return (
    <nav aria-label={label} className="mt-6">
      <p className="mb-4 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
        {label}
      </p>
      <TocList entries={entries} active={active} />
    </nav>
  )
}

/**
 * The reading rail for screens too narrow for a side column: a bar docked to
 * the bottom edge with the time left, and the table of contents one tap away.
 * It shows only while the article is actually being read — it stays out of the
 * masthead and steps aside again at the end.
 */
export function MobileReadingBar({
  entries,
  label,
  minutes,
}: {
  entries: TocEntry[]
  label: string
  minutes: number
}) {
  const { t } = useLanguage()
  const percent = useReadingPercent()
  const active = useActiveHeading(entries)
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const hasToc = entries.length >= 2
  const reading = percent > 0 && percent < 100

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const shown = reading || open

  return (
    <div
      className={cn(
        'fixed inset-x-3 bottom-3 z-40 border border-line bg-ink-soft shadow-[0_18px_40px_-12px_rgba(0,0,0,0.9)] transition-[translate,opacity] duration-500 ease-out-expo xl:hidden',
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[140%] opacity-0',
      )}
      inert={!shown}
    >
      {hasToc && (
        <nav
          id={panelId}
          aria-label={label}
          hidden={!open}
          className="max-h-[55svh] overflow-y-auto overscroll-contain border-b border-line px-4 py-4"
        >
          <TocList entries={entries} active={active} onNavigate={() => setOpen(false)} />
        </nav>
      )}

      <div className="flex min-h-12 items-center justify-between gap-4 px-4 font-mono text-[10px] tracking-[0.18em] text-bone-dim uppercase">
        <span className="flex items-center gap-3">
          <span className="text-ember tabular-nums">{percent}%</span>
          <span>{remainingLabel(percent, minutes, t)}</span>
        </span>
        {hasToc && (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="-mr-2 flex min-h-12 items-center gap-2 px-2 text-bone uppercase"
          >
            {label}
            <svg
              aria-hidden="true"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              className={cn('transition-transform duration-300', open && 'rotate-180')}
            >
              <path d="M1 6.5 5 2.5l4 4" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
