import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useLenis } from 'lenis/react'

import { readingProgress, rememberProgress } from '@/blog/lib/reading-memory'
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

/**
 * Remembers how far the reader got, and on the next visit offers the way back
 * to that point. It only offers: landing someone in the middle of a page they
 * opened from the top would be the page deciding for them.
 */
export function ResumeReading({
  slug,
  targetRef,
}: {
  slug: string
  targetRef: React.RefObject<HTMLElement | null>
}) {
  const { t } = useLanguage()
  const lenis = useLenis()
  const percent = useReadingPercent()
  // Read once, before this visit starts writing over it.
  const [saved] = useState(() => readingProgress(slug))
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (percent > 0) rememberProgress(slug, percent)
  }, [slug, percent])

  // Worth offering only between "barely started" and "finished", and only
  // while the reader is still at the top of the entry.
  if (dismissed || saved < 8 || saved >= 100 || percent > 4) return null

  const resume = () => {
    const el = targetRef.current
    if (!el) return
    const top = el.offsetTop + ((el.offsetHeight - window.innerHeight) * saved) / 100
    if (lenis) lenis.scrollTo(top, { duration: 1.4 })
    else window.scrollTo({ top, behavior: 'smooth' })
    setDismissed(true)
  }

  return (
    <p className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border border-line px-4 py-3 text-sm text-bone-dim transition-[opacity,translate] duration-700 ease-out-expo starting:translate-y-2 starting:opacity-0">
      <span>{t.blog.post.resume(saved)}</span>
      <button
        type="button"
        onClick={resume}
        className="font-mono text-[10px] tracking-[0.2em] text-ember uppercase transition-colors hover:text-bone"
      >
        {t.blog.post.resumeAction}
      </button>
    </p>
  )
}

/* ─── Table of contents ─────────────────────────────────────────────────── */

/**
 * Which heading the reader is under: the last one that has crossed a line
 * 30% down the screen.
 *
 * The observer's root is stretched far above the viewport, so a heading counts
 * as "inside" for as long as it is above that line, however far it has been
 * scrolled past. Crossing the line in either direction is then always a
 * change the observer reports — also when the page jumps (an anchor, a quote
 * link, "pick up where I left off") and no heading ever passes through view.
 */
function useActiveHeading(entries: TocEntry[]): string {
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    if (entries.length === 0) return
    const targets = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((el): el is HTMLElement => el !== null)
    if (targets.length === 0) return

    const passed = new Set<string>()
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting) passed.add(record.target.id)
          else passed.delete(record.target.id)
        }
        let current = ''
        for (const entry of entries) if (passed.has(entry.id)) current = entry.id
        setActive(current)
      },
      { rootMargin: '100000px 0px -70% 0px', threshold: 0 },
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

const ordinal = (index: number) => String(index + 1).padStart(2, '0')

/**
 * The entry's sections, listed where the reading starts: number, title, and
 * how long each one takes. On a wide page it sits at the head of the margin;
 * otherwise it is a block above the first paragraph.
 */
export function SectionIndex({ entries, label }: { entries: TocEntry[]; label: string }) {
  const { t } = useLanguage()
  const sections = entries.filter((entry) => entry.depth === 2)
  if (sections.length < 2) return null

  return (
    <nav aria-label={label} className="in-margin mb-10 border-y border-line py-5">
      <p className="mb-3 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">{label}</p>
      <ol className="space-y-2.5">
        {sections.map((entry, index) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className="group flex items-baseline gap-3 text-[13px] leading-snug text-bone-dim transition-colors duration-300 hover:text-bone"
            >
              <span className="font-mono text-[10px] tracking-[0.2em] text-ember">
                {ordinal(index)}
              </span>
              <span className="min-w-0 flex-1 text-pretty">{entry.text}</span>
              {entry.minutes !== undefined && (
                <span className="shrink-0 font-mono text-[10px] tracking-[0.12em] text-smoke tabular-nums">
                  {t.blog.stats.minutes(entry.minutes)}
                </span>
              )}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * The reading rail of a wide page: the home's section rail, pointed at an
 * entry. One numbered tick per section in the page gutter, the current
 * section's title running up the page edge, and the position as a figure.
 * A title shows beside its tick on hover or keyboard focus.
 *
 * Narrower screens get `MobileReadingBar` instead.
 */
export function PostRail({
  entries,
  minutes,
  label,
}: {
  entries: TocEntry[]
  minutes: number
  label: string
}) {
  const { t } = useLanguage()
  const percent = useReadingPercent()
  const sections = useMemo(() => entries.filter((entry) => entry.depth === 2), [entries])
  const active = useActiveHeading(sections)
  const activeIndex = sections.findIndex((entry) => entry.id === active)
  const left = Math.ceil((minutes * (100 - percent)) / 100)

  return (
    <nav
      aria-label={label}
      className="fixed top-1/2 left-3 z-30 hidden -translate-y-1/2 items-center gap-2.5 xl:flex"
    >
      <span
        aria-hidden
        className="flex h-44 w-3 rotate-180 items-center justify-center font-mono text-[10px] leading-none tracking-[0.3em] text-bone-dim uppercase [writing-mode:vertical-rl]"
      >
        {activeIndex >= 0 && (
          // keyed so each new section title plays the entrance again
          <span
            key={active}
            className="block max-h-44 animate-rail-label overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {sections[activeIndex].text}
          </span>
        )}
      </span>

      <div className="flex flex-col gap-5">
        {sections.length >= 2 && (
          <ol className="flex flex-col gap-5">
            {sections.map((entry, index) => {
              const isActive = index === activeIndex
              return (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    data-cursor="link"
                    aria-current={isActive ? 'location' : undefined}
                    className="group flex items-center gap-3"
                  >
                    <span
                      className={cn(
                        'font-mono text-[10px] tracking-[0.2em] transition-colors duration-300',
                        isActive
                          ? 'text-ember'
                          : index < activeIndex
                            ? 'text-bone-dim group-hover:text-bone'
                            : 'text-smoke group-hover:text-bone',
                      )}
                    >
                      {ordinal(index)}
                    </span>
                    <span
                      className={cn(
                        'block h-px transition-[width,background-color,opacity] duration-500 ease-out-expo',
                        // Shorter than the home rail's: this gutter ends where
                        // the text begins, and list dashes start right there.
                        isActive
                          ? 'w-5 bg-ember'
                          : 'w-3 bg-bone opacity-40 group-hover:w-5 group-hover:opacity-80',
                      )}
                    />
                    <span className="max-w-72 -translate-x-2 truncate bg-ink/90 px-1.5 py-0.5 font-mono text-[10px] tracking-[0.2em] text-bone uppercase opacity-0 transition-[opacity,translate] duration-300 ease-out-expo group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                      {entry.text}
                    </span>
                  </a>
                </li>
              )
            })}
          </ol>
        )}

        <p className="font-mono text-[10px] leading-relaxed tracking-[0.2em] text-smoke uppercase">
          <span className="block text-ember tabular-nums">{percent}%</span>
          {percent < 100 && <span className="block">{t.blog.stats.minutes(left)}</span>}
        </p>
      </div>
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
        'fixed inset-x-3 bottom-3 z-40 border border-line bg-ink-soft shadow-[0_18px_40px_-12px_var(--shade)] transition-[translate,opacity] duration-500 ease-out-expo xl:hidden',
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
