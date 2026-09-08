import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type { DayPoint, NamedCount } from '@/admin/services/analytics'
import { cn } from '@/lib/utils'

/**
 * Chart primitives for the admin.
 *
 * **One data hue, on purpose.** Signal & Ink is a warm monochrome plus a single
 * ember accent, and a warm monochrome cannot produce a legal categorical
 * palette: every neighbour of ember sits in the same red-orange band and
 * collapses under deuteranopia (measured — the closest candidates scored ΔE 4.2
 * to 7.4, against a floor of 8). So identity is never carried by hue here. It
 * is carried by position, direct labels and legends, and every breakdown is a
 * single-series bar list rather than a pie of near-indistinguishable wedges.
 *
 * The one place colour encodes magnitude — the heat map — uses a validated
 * 4-step sequential ramp of the ember hue.
 */

/* ─── Tokens ────────────────────────────────────────────────────────────── */

const EMBER = 'var(--color-ember)'
const SURFACE = 'var(--color-ink)'

/**
 * Sequential ember ramp, computed in OKLCH and validated: monotone lightness,
 * adjacent ΔL ≥ 0.06, light end 2.10:1 against the card surface. Four steps is
 * what the available lightness range allows with legal gaps — and four classes
 * read more cleanly than six anyway.
 */
const HEAT_RAMP = ['#743b29', '#984429', '#c04b21', '#e95111'] as const

function formatCompact(value: number): string {
  if (Math.abs(value) >= 10000) return `${Math.round(value / 1000)}K`
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

/* ─── Tooltip shell ─────────────────────────────────────────────────────── */

interface TooltipState {
  x: number
  y: number
  title: string
  rows: { label: string; value: string; muted?: boolean }[]
}

/**
 * Floating readout. Values lead and labels follow — the reader already knows
 * which series they are on and wants the number. Text goes in as children, so
 * untrusted labels never reach `innerHTML`.
 */
function Tooltip({ state, hostWidth }: { state: TooltipState; hostWidth: number }) {
  // Flip to the left of the pointer near the right edge so it never clips out.
  const flip = state.x > hostWidth * 0.6
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 min-w-36 border border-line bg-ink/95 px-3 py-2 shadow-[0_8px_28px_-12px_rgba(0,0,0,0.9)] backdrop-blur"
      style={{
        left: flip ? undefined : state.x + 14,
        right: flip ? hostWidth - state.x + 14 : undefined,
        top: Math.max(0, state.y - 12),
      }}
    >
      <p className="mb-1.5 font-mono text-[9px] tracking-[0.2em] text-smoke uppercase">
        {state.title}
      </p>
      <ul className="flex flex-col gap-1">
        {state.rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-px w-3 shrink-0"
              style={{ background: row.muted ? 'var(--color-smoke)' : EMBER }}
            />
            <span className="font-sans text-sm font-semibold text-bone">
              {row.value}
            </span>
            <span className="text-xs text-bone-dim">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ─── Time series ───────────────────────────────────────────────────────── */

export function TimeSeries({
  data,
  compare = true,
  className,
}: {
  data: DayPoint[]
  /** Overlay the preceding window as a recessive baseline. */
  compare?: boolean
  className?: string
}) {
  const gradientId = useId()
  const plotRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{ index: number; x: number; y: number } | null>(
    null,
  )

  /**
   * The plot is drawn at the container's real pixel width, so the viewBox maps
   * 1:1 to CSS pixels.
   *
   * A fixed viewBox with `w-full` does *not* work: the default
   * `preserveAspectRatio="xMidYMid meet"` scales the graphic to *fit*, so a
   * 720-wide viewBox in a 1100px card renders 720px of chart centred with ~190px
   * of dead space on each side — the drawing really is narrower than its div.
   * That is both a visible layout gap and the reason a pointer-to-index
   * calculation based on the div's width lands on the wrong day.
   *
   * `preserveAspectRatio="none"` would fill the box but stretch every glyph and
   * marker horizontally. Measuring is the only option that keeps text round and
   * hover exact.
   */
  const H = 240
  const [W, setW] = useState(720)

  const measure = useCallback(() => {
    const el = plotRef.current
    if (!el) return
    const width = el.getBoundingClientRect().width
    // A container that is not being rendered measures 0. Keep the last good
    // width instead of collapsing the chart to the floor.
    if (width > 0) {
      // The floor stops the axis labels colliding on very narrow screens.
      setW(Math.max(320, Math.round(width)))
    }
  }, [])

  // A layout effect measures before the first paint, so the chart never shows
  // at the fallback width. ResizeObserver then handles later resizes — but it
  // is not the only source: it does not deliver for an element that is not
  // being rendered (a hidden tab or collapsed pane), and relying on it alone
  // leaves the chart stuck at 720 in exactly that case.
  useLayoutEffect(() => {
    measure()
    const el = plotRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  const pad = { top: 18, right: 16, bottom: 30, left: 44 }
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom

  const showCompare = compare && data.some((d) => d.previousViews > 0)
  const rawMax = Math.max(
    1,
    ...data.map((d) => (showCompare ? Math.max(d.views, d.previousViews) : d.views)),
  )
  // Round the ceiling to a clean tick so the axis reads 0 / 5 / 10, not 0 / 3 / 7.
  const step = Math.max(1, Math.ceil(rawMax / 4))
  const max = step * 4

  const xAt = (i: number) =>
    pad.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2)
  const yAt = (v: number) => pad.top + innerH - (v / max) * innerH

  const path = (key: 'views' | 'previousViews') =>
    data
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d[key])}`)
      .join(' ')

  const areaPath = `${path('views')} L ${xAt(data.length - 1)} ${pad.top + innerH} L ${xAt(0)} ${pad.top + innerH} Z`

  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const plot = plotRef.current
    if (!plot || data.length === 0) return
    const rect = plot.getBoundingClientRect()

    // viewBox units are CSS pixels here, so the pointer needs no rescaling —
    // only the plot area's own left padding has to come off before inverting
    // `xAt`. Skipping that offset is what made the readout lag the cursor.
    const localX = event.clientX - rect.left
    const ratio = (localX - pad.left) / innerW
    // Snap to the nearest data position — the reader aims at a date, not a line.
    const index = Math.min(
      data.length - 1,
      Math.max(0, Math.round(ratio * (data.length - 1))),
    )
    setHover({
      index,
      x: xAt(index),
      y: yAt(data[index].views),
    })
  }

  const point = hover ? data[hover.index] : null

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Only the plot is the hover surface and the tooltip's positioning
          parent. Including the legend below would inflate the measured height
          and push the tooltip off the chart. */}
      <div
        ref={plotRef}
        className="relative"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block"
        role="img"
        aria-label="Visitas por dia"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMBER} stopOpacity="0.18" />
            <stop offset="100%" stopColor={EMBER} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Hairline grid + rounded y ticks. Solid, one step off surface. */}
        {[0, 1, 2, 3, 4].map((i) => {
          const value = step * i
          const y = yAt(value)
          return (
            <g key={i}>
              <line
                x1={pad.left}
                x2={pad.left + innerW}
                y1={y}
                y2={y}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
              <text
                x={pad.left - 10}
                y={y + 3.5}
                textAnchor="end"
                className="fill-smoke"
                style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCompact(value)}
              </text>
            </g>
          )
        })}

        {showCompare && (
          <path
            d={path('previousViews')}
            fill="none"
            stroke="var(--color-smoke)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.75}
          />
        )}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={path('views')}
          fill="none"
          stroke={EMBER}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crosshair */}
        {hover && (
          <line
            x1={xAt(hover.index)}
            x2={xAt(hover.index)}
            y1={pad.top}
            y2={pad.top + innerH}
            stroke="var(--color-bone-dim)"
            strokeWidth={1}
          />
        )}

        {/* End marker + the hovered point, each with a surface ring. */}
        {data.length > 0 && (
          <circle
            cx={xAt(data.length - 1)}
            cy={yAt(data[data.length - 1].views)}
            r={4}
            fill={EMBER}
            stroke={SURFACE}
            strokeWidth={2}
          />
        )}
        {hover && (
          <circle
            cx={xAt(hover.index)}
            cy={yAt(data[hover.index].views)}
            r={4.5}
            fill={EMBER}
            stroke={SURFACE}
            strokeWidth={2}
          />
        )}

        {/* X labels, thinned so they never collide. */}
        {data.map((d, i) => {
          const everyNth = Math.ceil(data.length / 7)
          if (i % everyNth !== 0 && i !== data.length - 1) return null
          return (
            <text
              key={d.date}
              x={xAt(i)}
              y={H - 8}
              textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
              className="fill-smoke"
              style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
            >
              {d.date.slice(5).replace('-', '/')}
            </text>
          )
        })}
      </svg>

      {hover && point && (
        <Tooltip
          hostWidth={W}
          state={{
            x: hover.x,
            y: hover.y,
            title: point.date,
            rows: [
              { label: 'visitas', value: String(point.views) },
              { label: 'visitantes', value: String(point.visitors) },
              ...(showCompare
                ? [
                    {
                      label: 'período anterior',
                      value: String(point.previousViews),
                      muted: true,
                    },
                  ]
                : []),
            ],
          }}
        />
      )}
      </div>

      {showCompare && (
        <div className="mt-1 flex items-center gap-5">
          <LegendKey label="Período atual" />
          <LegendKey label="Período anterior" muted />
        </div>
      )}
    </div>
  )
}

function LegendKey({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
      <span
        aria-hidden
        className="h-0.5 w-4"
        style={{ background: muted ? 'var(--color-smoke)' : EMBER }}
      />
      {label}
    </span>
  )
}

/* ─── Sparkline (stat tiles) ────────────────────────────────────────────── */

export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values)
  const W = 100
  const H = 24
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W
      const y = H - (v / max) * H
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-6 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke={EMBER}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        opacity={0.7}
      />
    </svg>
  )
}

/* ─── Bar list ──────────────────────────────────────────────────────────── */

/**
 * The workhorse breakdown. Nominal categories all wear slot-1 ember — colouring
 * each bar by its value would re-encode what bar length already shows and burn
 * the identity channel for nothing.
 */
export function BarList({
  data,
  emptyLabel = '—',
  showShare = true,
  formatName,
  max: maxItems,
}: {
  data: NamedCount[]
  emptyLabel?: string
  /** Show each row's share of the total alongside the count. */
  showShare?: boolean
  formatName?: (name: string) => string
  max?: number
}) {
  const rows = maxItems ? data.slice(0, maxItems) : data
  const max = Math.max(1, ...rows.map((d) => d.count))
  const total = rows.reduce((sum, d) => sum + d.count, 0)

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-smoke">{emptyLabel}</p>
  }

  return (
    <ul className="flex flex-col">
      {rows.map((d) => {
        const delta =
          d.previous !== undefined && d.previous > 0
            ? Math.round(((d.count - d.previous) / d.previous) * 100)
            : null
        return (
          <li
            key={d.name}
            className="group -mx-2 rounded-[2px] px-2 py-2 transition-colors hover:bg-bone/[0.04]"
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-bone-dim transition-colors group-hover:text-bone">
                {formatName ? formatName(d.name) : d.name}
              </span>
              <span className="flex shrink-0 items-baseline gap-2">
                {delta !== null && delta !== 0 && (
                  <span
                    className={cn(
                      'font-mono text-[10px] tabular-nums',
                      delta > 0 ? 'text-ember' : 'text-smoke',
                    )}
                  >
                    {delta > 0 ? '+' : ''}
                    {delta}%
                  </span>
                )}
                {showShare && total > 0 && (
                  <span className="font-mono text-[10px] text-smoke tabular-nums">
                    {Math.round((d.count / total) * 100)}%
                  </span>
                )}
                <span className="font-mono text-[11px] text-bone-dim tabular-nums">
                  {d.count}
                </span>
              </span>
            </div>
            <div className="h-1.5 w-full bg-line/60">
              <div
                className="h-full rounded-r-[2px] bg-ember/70 transition-[width,background-color] duration-500 group-hover:bg-ember"
                style={{ width: `${Math.max((d.count / max) * 100, 1.5)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ─── Weekday × hour heat map ───────────────────────────────────────────── */

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function HeatMap({ data }: { data: number[][] }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<TooltipState | null>(null)
  const [hostWidth, setHostWidth] = useState(600)

  const max = useMemo(
    () => Math.max(1, ...data.flatMap((row) => row)),
    [data],
  )

  /** Zero stays surface-coloured; non-zero maps onto the validated ramp. */
  const colorFor = (value: number): string => {
    if (value <= 0) return 'var(--color-line)'
    const index = Math.min(
      HEAT_RAMP.length - 1,
      Math.floor((value / max) * HEAT_RAMP.length),
    )
    return HEAT_RAMP[index]
  }

  const show = (
    event: React.PointerEvent | React.FocusEvent,
    weekday: number,
    hour: number,
    value: number,
  ) => {
    const host = hostRef.current
    if (!host) return
    const rect = host.getBoundingClientRect()
    const cell = (event.target as HTMLElement).getBoundingClientRect()
    setHostWidth(rect.width)
    setHover({
      x: cell.left - rect.left + cell.width / 2,
      y: cell.top - rect.top,
      title: `${WEEKDAYS[weekday]} · ${String(hour).padStart(2, '0')}:00`,
      rows: [{ label: 'visitas', value: String(value) }],
    })
  }

  return (
    <div ref={hostRef} className="relative">
      <div className="overflow-x-auto">
        <div className="min-w-[520px]">
          {/* Hour scale */}
          <div className="mb-1 flex pl-9">
            {Array.from({ length: 24 }, (_, hour) => (
              <span
                key={hour}
                className="flex-1 text-center font-mono text-[8px] text-smoke"
              >
                {hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}
              </span>
            ))}
          </div>

          {data.map((row, weekday) => (
            <div key={weekday} className="mb-[2px] flex items-center">
              <span className="w-9 shrink-0 font-mono text-[9px] tracking-[0.1em] text-smoke uppercase">
                {WEEKDAYS[weekday]}
              </span>
              {row.map((value, hour) => (
                <button
                  key={hour}
                  type="button"
                  // The 2px gap is the separator — never a border around the mark.
                  className="mr-[2px] h-5 flex-1 rounded-[1px] transition-transform last:mr-0 hover:scale-125 focus-visible:scale-125 focus-visible:outline-none"
                  style={{ background: colorFor(value) }}
                  onPointerEnter={(e) => show(e, weekday, hour, value)}
                  onFocus={(e) => show(e, weekday, hour, value)}
                  onPointerLeave={() => setHover(null)}
                  onBlur={() => setHover(null)}
                  aria-label={`${WEEKDAYS[weekday]} ${hour}:00 — ${value} visitas`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Scale legend — colour encodes magnitude, so it needs a key. */}
      <div className="mt-4 flex items-center gap-2">
        <span className="font-mono text-[9px] tracking-[0.16em] text-smoke uppercase">
          menos
        </span>
        <span className="h-3 w-4 rounded-[1px] bg-line" />
        {HEAT_RAMP.map((color) => (
          <span
            key={color}
            className="h-3 w-4 rounded-[1px]"
            style={{ background: color }}
          />
        ))}
        <span className="font-mono text-[9px] tracking-[0.16em] text-smoke uppercase">
          mais ({max})
        </span>
      </div>

      {hover && <Tooltip state={hover} hostWidth={hostWidth} />}
    </div>
  )
}
