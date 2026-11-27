import { useContext, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { buildShareableAskPath } from '@/agent/share'
import type { AgentLens } from '@/agent/types'
import { BodyContext } from '@/blog/lib/body-context'
import { parseTokenAlternatives } from '@/blog/lib/token-alternatives'
import { cn } from '@/lib/utils'

/**
 * Interactive Phase 4 blog directives anchored in Signal & Ink:
 *
 * 1. `:::dossier-ask{q="..." lens="engineer" label="..."}` (or leaf `::dossier-ask{...}`)
 *    — embeds a direct contextual jump into `/ask` right inside technical articles.
 * 2. `:::ai-tokens{prompt="..."}` — Kokonut `AI-20 Token Alternatives` ported to
 *    Signal & Ink so readers of LLM/AI articles can inspect top-k token
 *    probabilities and click alternatives live.
 */

function normalizeLens(raw?: string): AgentLens {
  if (raw === 'recruiter' || raw === 'engineer' || raw === 'client') return raw
  return 'engineer'
}

export function DossierAsk({
  q,
  lens,
  label,
  title,
  children,
}: {
  q?: string
  lens?: string
  label?: string
  title?: string
  children?: ReactNode
}) {
  const { lang } = useContext(BodyContext)
  const isPt = lang !== 'en'
  const prompt = (q ?? '').trim()
  if (!prompt) return null

  const activeLens = normalizeLens(lens)
  const href = buildShareableAskPath({
    locale: isPt ? 'pt' : 'en',
    lens: activeLens,
    prompt,
  })

  return (
    <aside className="my-10 rounded-2xl border border-line bg-ink-soft/60 px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.2em] text-ember uppercase">
            {title || (isPt ? 'Explorar no dossiê' : 'Explore in dossier')}
          </p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-bone">{prompt}</p>
          {children && (
            <div className="mt-1.5 text-xs leading-relaxed text-smoke">{children}</div>
          )}
        </div>

        <Link
          to={href}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-ember/50 bg-ember/12 px-4 font-mono text-[11px] text-ember transition-colors hover:border-ember hover:bg-ember hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
        >
          <span>{label || (isPt ? 'Perguntar no Dossiê' : 'Ask Dossier')}</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </aside>
  )
}

export function TokenAlternatives({
  prompt,
  spec,
  title,
}: {
  prompt?: string
  spec?: string
  title?: string
}) {
  const { lang } = useContext(BodyContext)
  const isPt = lang !== 'en'
  const slots = useMemo(() => parseTokenAlternatives(spec ?? ''), [spec])
  const [selectedIndex, setSelectedIndex] = useState<number>(() =>
    slots.findIndex((slot) => slot.alternatives.length > 0),
  )
  const [overrides, setOverrides] = useState<Record<number, string>>({})

  if (slots.length === 0) return null

  const activeSlot = selectedIndex >= 0 ? slots[selectedIndex] : undefined
  const activeCandidates = activeSlot
    ? [activeSlot.chosen, ...activeSlot.alternatives]
    : []

  return (
    <figure className="my-10 overflow-hidden rounded-2xl border border-line bg-ink-soft/60">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/80 px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">
          {title || (isPt ? 'Alternativas de tokens (Top-K)' : 'Token alternatives (Top-K)')}
        </span>
        {Object.keys(overrides).length > 0 && (
          <button
            type="button"
            onClick={() => setOverrides({})}
            className="font-mono text-[10px] text-smoke transition-colors hover:text-ember focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
          >
            {isPt ? 'Restaurar original' : 'Reset original'}
          </button>
        )}
      </div>

      <div className="px-4 py-4">
        <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-2 text-[15px] leading-relaxed">
          {prompt && <span className="text-smoke">{prompt}</span>}
          {slots.map((slot, index) => {
            const interactive = slot.alternatives.length > 0
            const shown = overrides[index] ?? slot.chosen.text
            const isSelected = selectedIndex === index
            const isSwapped = overrides[index] !== undefined && overrides[index] !== slot.chosen.text

            if (!interactive) {
              return (
                <span key={index} className="text-bone-dim">
                  {slot.chosen.text}
                </span>
              )
            }

            return (
              <button
                key={index}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedIndex(index)}
                className={cn(
                  'rounded-md border px-1.5 py-0.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember',
                  isSelected
                    ? 'border-ember bg-ember/15 text-bone'
                    : isSwapped
                      ? 'border-ember/50 bg-ink text-ember'
                      : 'border-line bg-ink text-bone hover:border-ember/60',
                )}
              >
                {shown}
              </button>
            )
          })}
        </p>

        {activeSlot && activeCandidates.length > 0 && (
          <div className="mt-4 border-t border-line/70 pt-3">
            <p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-smoke uppercase">
              {isPt
                ? 'Distribuição do token selecionado (clique para trocar)'
                : 'Selected token distribution (click to swap)'}
            </p>
            <ul className="space-y-1.5" role="list">
              {activeCandidates.map((cand, cIdx) => {
                const currentText = overrides[selectedIndex] ?? activeSlot.chosen.text
                const active = currentText === cand.text
                return (
                  <li key={`${cand.text}-${cIdx}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setOverrides((prev) => ({
                          ...prev,
                          [selectedIndex]: cand.text,
                        }))
                      }
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember',
                        active ? 'bg-ink text-bone' : 'hover:bg-ink/60 text-bone-dim',
                      )}
                    >
                      <span className="w-32 shrink-0 truncate font-mono text-xs">
                        {cand.text}
                      </span>
                      <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line/70">
                        <span
                          className={cn(
                            'block h-full rounded-full transition-[width] duration-300',
                            active ? 'bg-ember' : 'bg-bone-dim/50',
                          )}
                          style={{ width: `${Math.max(2, cand.prob)}%` }}
                        />
                      </span>
                      <span className="w-11 shrink-0 text-right font-mono text-[11px] tabular-nums text-smoke">
                        {cand.prob}%
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </figure>
  )
}
