import { useState, type ReactNode } from 'react'

import { Sparkline } from '@/admin/components/charts'
import {
  RANGES,
  deltaPercent,
  type Metric,
  type RangeKey,
} from '@/admin/services/analytics'
import { cn } from '@/lib/utils'

/* ─── Range filter ──────────────────────────────────────────────────────── */

/**
 * The single filter row. It sits above everything it scopes — never inside a
 * card, never per chart — so every number on the page describes the same slice
 * and they always agree with each other.
 */
export function RangeFilter({
  value,
  onChange,
  onExport,
  live,
}: {
  value: RangeKey
  onChange: (next: RangeKey) => void
  onExport: () => void
  live: boolean
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-line py-3">
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Período"
      >
        {(Object.keys(RANGES) as RangeKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-pressed={value === key}
            className={cn(
              'border px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors',
              value === key
                ? 'border-ember text-ember'
                : 'border-line text-smoke hover:border-bone/40 hover:text-bone-dim',
            )}
          >
            {RANGES[key].label}
          </button>
        ))}
      </div>

      <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
        <span
          aria-hidden
          className={cn(
            'size-1.5 rounded-full',
            live ? 'animate-pulse bg-ember' : 'bg-line',
          )}
        />
        {live ? 'ao vivo' : 'offline'}
      </span>

      <button
        type="button"
        onClick={onExport}
        className="ml-auto border border-line px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-bone-dim uppercase transition-colors hover:border-ember hover:text-ember"
      >
        Exportar CSV
      </button>
    </div>
  )
}

/* ─── Metric tile ───────────────────────────────────────────────────────── */

function formatValue(value: number, unit?: MetricUnit): string {
  if (unit === 'percent') return `${value}%`
  if (unit === 'duration') {
    if (value < 60) return `${value}s`
    const minutes = Math.floor(value / 60)
    const seconds = value % 60
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  }
  if (Math.abs(value) >= 10000) return `${Math.round(value / 1000)}K`
  return String(value)
}

type MetricUnit = 'count' | 'percent' | 'duration' | 'decimal'

/**
 * Stat tile: label · value · delta against the previous window of equal length
 * · optional sparkline.
 *
 * `higherIsBetter` exists because direction alone does not mean good: bounce
 * rate rising is bad, visits rising is good. The colour follows meaning, not
 * the sign.
 */
export function MetricTile({
  label,
  metric,
  unit = 'count',
  hint,
  trend,
  higherIsBetter = true,
  accent = false,
}: {
  label: string
  metric: Metric
  unit?: MetricUnit
  hint?: string
  trend?: number[]
  higherIsBetter?: boolean
  accent?: boolean
}) {
  const delta = deltaPercent(metric)
  const improved = delta === null ? null : higherIsBetter ? delta > 0 : delta < 0

  return (
    <div className="flex flex-col justify-between gap-3 bg-ink-soft/60 p-5">
      <p className="font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
        {label}
      </p>

      <div>
        <div className="flex items-baseline gap-2.5">
          {/* Proportional figures: `tabular-nums` makes a large standalone
              number look loose. Tabular is for columns, not headlines. */}
          <span
            className={cn(
              'font-display text-4xl leading-none md:text-5xl',
              accent ? 'text-ember' : 'text-bone',
            )}
          >
            {unit === 'decimal' ? metric.current : formatValue(metric.current, unit)}
          </span>
          {delta !== null && delta !== 0 && (
            <span
              className={cn(
                'font-mono text-[11px] tabular-nums',
                improved ? 'text-ember' : 'text-smoke',
              )}
              title={`${formatValue(metric.previous, unit)} no período anterior`}
            >
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%
            </span>
          )}
        </div>

        {trend && trend.length > 1 && (
          <div className="mt-2.5">
            <Sparkline values={trend} />
          </div>
        )}

        {/* Not uppercased: this line carries values, and `1m 35s` becomes the
            unreadable `1M 35S` under a blanket text-transform. */}
        <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-smoke">
          {hint ??
            (delta === null
              ? 'sem base de comparação'
              : `${formatValue(metric.previous, unit)} no período anterior`)}
        </p>
      </div>
    </div>
  )
}

/* ─── Chart card with a table twin ──────────────────────────────────────── */

export interface TableView {
  columns: string[]
  rows: (string | number)[][]
}

/**
 * Card wrapper for a chart.
 *
 * Every chart ships a table twin. A tooltip enhances but must never be the only
 * way to read a value — the table is the WCAG-clean equivalent and doubles as
 * the answer to "what was the exact number on the 14th".
 */
export function ChartCard({
  title,
  hint,
  table,
  action,
  children,
}: {
  title: string
  hint?: string
  table?: TableView
  action?: ReactNode
  children: ReactNode
}) {
  const [showTable, setShowTable] = useState(false)

  return (
    <section className="border border-line bg-ink-soft/60 p-5 md:p-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
            {title}
          </h2>
          {hint && <p className="mt-1.5 text-xs text-smoke">{hint}</p>}
        </div>
        <div className="flex items-center gap-3">
          {action}
          {table && (
            <button
              type="button"
              onClick={() => setShowTable((value) => !value)}
              aria-pressed={showTable}
              className="font-mono text-[10px] tracking-[0.16em] text-smoke uppercase transition-colors hover:text-ember"
            >
              {showTable ? 'Gráfico' : 'Tabela'}
            </button>
          )}
        </div>
      </header>

      {showTable && table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
                {table.columns.map((column) => (
                  <th key={column} className="py-2 pr-4 font-normal">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {table.rows.map((row, index) => (
                <tr key={index} className="text-bone-dim">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        'py-2 pr-4',
                        // Tabular figures here — these are columns that must align.
                        typeof cell === 'number' && 'font-mono text-xs tabular-nums',
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  )
}
