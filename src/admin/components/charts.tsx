import { useId } from 'react'

import type { DayPoint, NamedCount } from '@/admin/services/analytics'
import { cn } from '@/lib/utils'

/* ─── Area / line timeseries ────────────────────────────────────────────── */

export function AreaChart({
  data,
  className,
}: {
  data: DayPoint[]
  className?: string
}) {
  const gradientId = useId()
  const w = 720
  const h = 220
  const pad = { top: 16, right: 8, bottom: 24, left: 8 }
  const max = Math.max(1, ...data.map((d) => d.views))
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const step = data.length > 1 ? innerW / (data.length - 1) : 0

  const points = data.map((d, i) => ({
    x: pad.left + i * step,
    y: pad.top + innerH - (d.views / max) * innerH,
    d,
  }))

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const area = `${line} L ${pad.left + innerW} ${pad.top + innerH} L ${pad.left} ${pad.top + innerH} Z`

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={cn('h-56 w-full', className)}
      preserveAspectRatio="none"
      role="img"
      aria-label="Visualizações por dia"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-ember)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-ember)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={pad.left}
          x2={pad.left + innerW}
          y1={pad.top + innerH * g}
          y2={pad.top + innerH * g}
          stroke="var(--color-line)"
          strokeWidth={1}
        />
      ))}

      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-ember)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      {points.map((p, i) => (
        <g key={p.d.date}>
          <circle cx={p.x} cy={p.y} r={2.5} fill="var(--color-ember)" />
          {i % 2 === 0 && (
            <text
              x={p.x}
              y={h - 6}
              textAnchor="middle"
              className="fill-smoke"
              style={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
            >
              {p.d.date.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

/* ─── Horizontal bar list ───────────────────────────────────────────────── */

export function BarList({
  data,
  emptyLabel = '—',
}: {
  data: NamedCount[]
  emptyLabel?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.count))
  if (data.length === 0) {
    return <p className="py-6 text-center text-sm text-smoke">{emptyLabel}</p>
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li key={d.name} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-bone-dim group-hover:text-bone">
              {d.name}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-smoke tabular-nums">
              {d.count}
            </span>
          </div>
          <div className="h-1.5 w-full bg-line">
            <div
              className="h-full bg-ember/70 transition-all duration-500 group-hover:bg-ember"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ─── Donut ─────────────────────────────────────────────────────────────── */

const DONUT_COLORS = [
  'var(--color-ember)',
  '#e0a07a',
  '#7a7368',
  '#b5afa4',
  '#c23005',
  '#4a463f',
]

export function Donut({ data }: { data: NamedCount[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0)
  const radius = 60
  const circ = 2 * Math.PI * radius

  if (total === 0) {
    return <p className="py-6 text-center text-sm text-smoke">—</p>
  }

  // Precompute dash + cumulative offset purely (no in-render reassignment).
  const dashes = data.map((d) => (d.count / total) * circ)
  const offsets = dashes.map((_, i) =>
    dashes.slice(0, i).reduce((sum, value) => sum + value, 0),
  )

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 160 160" className="size-36 shrink-0 -rotate-90">
        {data.map((d, i) => (
          <circle
            key={d.name}
            cx={80}
            cy={80}
            r={radius}
            fill="none"
            stroke={DONUT_COLORS[i % DONUT_COLORS.length]}
            strokeWidth={20}
            strokeDasharray={`${dashes[i]} ${circ - dashes[i]}`}
            strokeDashoffset={-offsets[i]}
          />
        ))}
      </svg>
      <ul className="flex flex-col gap-2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0"
              style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
            />
            <span className="text-bone-dim capitalize">{d.name}</span>
            <span className="font-mono text-[11px] text-smoke tabular-nums">
              {Math.round((d.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ─── Hour-of-day bars ──────────────────────────────────────────────────── */

export function HourBars({ data }: { data: number[] }) {
  const max = Math.max(1, ...data)
  return (
    <div className="flex h-28 items-end gap-[3px]">
      {data.map((value, hour) => (
        <div
          key={hour}
          className="group relative flex-1"
          title={`${hour}:00 — ${value}`}
        >
          <div
            className="w-full bg-line transition-colors group-hover:bg-ember/40"
            style={{ height: `${Math.max((value / max) * 100, 3)}%` }}
          />
          {hour % 6 === 0 && (
            <span className="absolute -bottom-5 left-0 font-mono text-[9px] text-smoke">
              {String(hour).padStart(2, '0')}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
