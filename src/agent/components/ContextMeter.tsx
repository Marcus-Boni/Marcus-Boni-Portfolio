import { AnimatePresence, motion } from 'framer-motion'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from 'react'

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

import { IconArrowUpRight } from './icons'

/**
 * Full Kokonut UI `AI-16` (AI Context Meter) ported to Signal & Ink.
 *
 * Replaces a heavy multi-item status footer with ONE sleek circular SVG ring
 * inside the prompt toolbar. Clicking opens a floating `origin-bottom-right`
 * breakdown popover featuring Kokonut's 4×4 Bayer pixel-dithered bar, segment
 * hover dimming, real CMS source counts, and direct OpenAPI 3.1 link.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

function pixelMask(
  columns: number,
  rows: number,
  density: number,
  cell: number,
): CSSProperties {
  let rects = ''
  const on = Math.round(density * 16)
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      if (BAYER[(y % 4) * 4 + (x % 4)] < on) {
        rects += `<rect x='${x}' y='${y}' width='1' height='1'/>`
      }
    }
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${columns}' height='${rows}' shape-rendering='crispEdges'>${rects}</svg>`
  const image = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  const size = `${columns * cell}px ${rows * cell}px`
  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskSize: size,
    WebkitMaskSize: size,
    maskPosition: 'left bottom',
    WebkitMaskPosition: 'left bottom',
  }
}

const FREE_DITHER = pixelMask(4, 4, 0.25, 2)

function useTweened(target: number, duration = 420) {
  const reduced = usePrefersReducedMotion()
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const valueRef = useRef(target)

  useEffect(() => {
    if (reduced) {
      valueRef.current = target
      return
    }
    fromRef.current = valueRef.current
    const start = performance.now()
    let frame = 0
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 3
      valueRef.current = fromRef.current + (target - fromRef.current) * eased
      setValue(valueRef.current)
      if (t < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration, reduced])

  return reduced ? target : value
}

function Ring({ share }: { share: number }) {
  const radius = 6
  const circumference = 2 * Math.PI * radius
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 -rotate-90"
      fill="none"
      viewBox="0 0 16 16"
    >
      <circle
        className="stroke-line"
        cx="8"
        cy="8"
        r={radius}
        strokeWidth="2"
      />
      <circle
        className="stroke-ember"
        cx="8"
        cy="8"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - Math.min(1, share))}
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

export function ContextMeter({
  projectCount,
  engagementCount,
  techCount,
  postCount,
  turnCount,
  source,
}: {
  projectCount: number
  engagementCount: number
  techCount: number
  postCount: number
  turnCount: number
  source: 'live' | 'static'
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (rootRef.current?.contains(document.activeElement)) {
          triggerRef.current?.focus()
        }
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Real indexed document segments (proportional to actual dossier entities)
  const segments = [
    { id: 'projects', label: t.agent.meter.projects, count: projectCount, weight: projectCount * 3, color: 'bg-ember' },
    { id: 'clients', label: t.agent.meter.clients, count: engagementCount, weight: engagementCount * 3, color: 'bg-bone' },
    { id: 'stack', label: t.agent.meter.stack, count: techCount, weight: Math.round(techCount * 0.8), color: 'bg-bone-dim' },
    ...(postCount > 0
      ? [{ id: 'posts', label: t.agent.meter.posts, count: postCount, weight: postCount * 2, color: 'bg-[var(--code-amber)]' }]
      : []),
    ...(turnCount > 0
      ? [{ id: 'turns', label: t.agent.meter.turns, count: turnCount, weight: turnCount * 4, color: 'bg-smoke' }]
      : []),
  ]

  const totalDocs = projectCount + engagementCount + techCount + postCount
  const usedWeight = segments.reduce((sum, s) => sum + s.weight, 0)
  const capacity = Math.max(usedWeight + 24, 100)
  const share = Math.min(0.96, usedWeight / capacity)
  const shownShare = useTweened(share)

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={t.agent.meter.ariaLabel(totalDocs)}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] text-bone-dim transition-colors hover:bg-ink hover:text-bone focus-visible:outline-1 focus-visible:outline-ember',
          open && 'bg-ink text-bone',
        )}
      >
        <Ring share={shownShare} />
        <span className="tabular-nums">{totalDocs}</span>
        <span className="hidden sm:inline">{t.agent.meter.sourcesUnit}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, scale: 0.96, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.96,
              y: 4,
              transition: { duration: 0.12, ease: EASE_OUT },
            }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className="absolute right-0 bottom-full z-30 mb-2 w-72 origin-bottom-right rounded-2xl border border-line bg-ink-soft p-3.5 shadow-[0_16px_40px_-12px_var(--shade)]"
          >
            <div className="mb-2.5 flex items-baseline justify-between gap-2">
              <p className="text-xs font-medium text-bone">
                {t.agent.meter.popoverTitle}
              </p>
              <span className="font-mono text-[10px] text-smoke uppercase">
                {source === 'live' ? t.agent.meter.liveCms : t.agent.meter.staticSeed}
              </span>
            </div>

            {/* Kokonut AI-16 segmented bar over 4×4 Bayer pixel-dithered track */}
            <div
              className="relative"
              onPointerLeave={() => setActiveId(null)}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-smoke"
                style={FREE_DITHER}
              />
              <div className="relative flex h-2 overflow-hidden rounded-full">
                {segments.map((seg, idx) => (
                  <span
                    key={seg.id}
                    onPointerEnter={() => setActiveId(seg.id)}
                    style={{ width: `${(seg.weight / capacity) * 100}%` }}
                    className={cn(
                      'h-full transition-[width,opacity] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                      idx > 0 && 'ml-px',
                      seg.color,
                      activeId && activeId !== seg.id && 'opacity-30',
                    )}
                  />
                ))}
              </div>
            </div>

            <ul className="mt-3 space-y-0.5" role="list">
              {segments.map((seg) => (
                <li
                  key={seg.id}
                  onPointerEnter={() => setActiveId(seg.id)}
                  onPointerLeave={() => setActiveId(null)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs transition-colors',
                    activeId === seg.id && 'bg-ink',
                  )}
                >
                  <span className={cn('size-2 rounded-[3px]', seg.color)} />
                  <span className="text-bone-dim">{seg.label}</span>
                  <span className="ml-auto font-mono text-[11px] text-bone tabular-nums">
                    {seg.count}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 font-mono text-[10px] text-smoke">
              <span>{t.agent.meter.runtimeLabel}</span>
              <a
                href="/developers"
                className="inline-flex items-center gap-1 text-bone-dim transition-colors hover:text-ember"
              >
                <span>OpenAPI 3.1</span>
                <IconArrowUpRight className="size-3" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
