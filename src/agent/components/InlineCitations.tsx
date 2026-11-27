import { AnimatePresence, motion } from 'framer-motion'
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router-dom'

import type { Citation } from '@/agent/types'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

import { IconArrowUpRight, IconChevronDown } from './icons'

/**
 * Full Kokonut UI `AI-17` (AI Inline Citations) ported to Signal & Ink.
 *
 * Signature Kokonut interactions:
 * - Source pill chips sit right beside each claim (attached to the last word
 *   via `whitespace-nowrap` so a chip never wraps alone).
 * - Hovering, focusing, or tapping a chip lights up the backed claim sentence
 *   with a subtle ember wash and glides ONE shared floating preview card
 *   smoothly between chips (`x`, `y` transition).
 * - Below the prose sits a single ultra-quiet overlapping monogram pill
 *   (`4 fontes ▾`) that unfolds a clean linked list; hovering any source in
 *   that list highlights the corresponding claims inside the prose above!
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const CARD_WIDTH = 304
const OPEN_DELAY_MS = 110
const CLOSE_DELAY_MS = 100
const WARM_MS = 400
const CARD_GUESS = 170
const MARKER_RE = /\[(0\d|EXP·\d{2}|POST·\d{2}|DOC·\d{2}|GH·\d{2})\]/g
const INLINE_FORMAT_RE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*(?!\s)(?:[^*\n]*[^\s*\n])?\*)/g
const LAST_WORD_RE = /\S+\s*$/
const BULLET_RE = /^(?:[-*•])\s+/

interface Segment {
  text: string
  citeIds: string[]
}

/** Splits a line into claim spans paired with the trailing citation badge(s). */
function parseCitedSegments(line: string): Segment[] {
  const segments: Segment[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  MARKER_RE.lastIndex = 0

  while ((match = MARKER_RE.exec(line)) !== null) {
    const before = line.slice(cursor, match.index)
    const id = match[1]
    // Consecutive markers like `[DOC·01] [DOC·04]` collapse onto one chip group
    if (before.trim() === '' && segments.length > 0 && segments[segments.length - 1].citeIds.length > 0) {
      segments[segments.length - 1].citeIds.push(id)
    } else {
      segments.push({ text: before.trimEnd(), citeIds: [id] })
    }
    cursor = match.index + match[0].length
  }

  const tail = line.slice(cursor)
  if (tail) segments.push({ text: tail, citeIds: [] })
  return segments
}

function formatRichInline(text: string): ReactNode[] {
  const parts = text.split(INLINE_FORMAT_RE)
  return parts.map((part, idx) => {
    if (!part) return null
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-bone">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={idx}
          className="rounded-md border border-line bg-ink-soft px-1.5 py-0.5 font-mono text-[0.82em] text-bone"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="font-display italic text-[1.06em] text-bone">
          {part.slice(1, -1)}
        </em>
      )
    }
    return <Fragment key={idx}>{part}</Fragment>
  })
}

function shortChipLabel(citation: Citation): string {
  if (citation.kind === 'project') return citation.title
  if (citation.kind === 'experience') return citation.title.split(' — ')[0].split(' - ')[0]
  if (citation.kind === 'post') return citation.meta ?? 'Diário'
  return citation.meta ?? citation.id
}

function Monogram({
  citation,
  className,
}: {
  citation: Citation
  className?: string
}) {
  const letter = shortChipLabel(citation).charAt(0).toUpperCase() || '·'
  const isAccent = citation.kind === 'project' || citation.kind === 'experience'
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-medium uppercase',
        isAccent
          ? 'bg-ember/15 text-ember'
          : 'bg-bone/12 text-bone',
        className,
      )}
    >
      {letter}
    </span>
  )
}

interface PreviewState {
  key: string
  ids: string[]
  x: number
  y: number
  width: number
  below: boolean
}

function useFloatingPreview() {
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [warm, setWarm] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastClosed = useRef(0)

  const clear = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  const show = useCallback(
    (next: PreviewState, immediate = false) => {
      clear()
      const isWarm = preview !== null || Date.now() - lastClosed.current < WARM_MS
      if (immediate || isWarm) {
        setWarm(preview !== null)
        setPreview(next)
        return
      }
      openTimer.current = setTimeout(() => {
        setWarm(false)
        setPreview(next)
      }, OPEN_DELAY_MS)
    },
    [preview, clear],
  )

  const hide = useCallback(
    (immediate = false) => {
      clear()
      const close = () => {
        lastClosed.current = Date.now()
        setPreview(null)
      }
      if (immediate) {
        close()
        return
      }
      closeTimer.current = setTimeout(close, CLOSE_DELAY_MS)
    },
    [clear],
  )

  useEffect(() => clear, [clear])

  return { preview, warm, show, hide }
}

export function GroundedProse({
  text,
  citations,
  streaming,
  onNavigateInternal,
}: {
  text: string
  citations: Citation[]
  streaming?: boolean
  onNavigateInternal?: (href: string) => void
}) {
  const { t } = useLanguage()
  const rootRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const cardHeight = useRef(CARD_GUESS)
  const { preview, warm, show, hide } = useFloatingPreview()
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const previewId = useId()
  const listId = useId()

  const byId = new Map(citations.map((item) => [item.id, item]))

  useLayoutEffect(() => {
    if (preview && cardRef.current) {
      cardHeight.current = cardRef.current.offsetHeight
    }
  })

  useEffect(() => {
    if (!preview) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide(true)
    }
    const onPointer = (event: PointerEvent) => {
      if (
        !(
          event.target instanceof Element &&
          event.target.closest('[data-citation-chip], [data-citation-card]')
        )
      ) {
        hide(true)
      }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [preview, hide])

  const place = (key: string, ids: string[], chip: HTMLElement): PreviewState => {
    const root = rootRef.current?.getBoundingClientRect()
    const rect = chip.getBoundingClientRect()
    const width = Math.min(CARD_WIDTH, root?.width ?? CARD_WIDTH)
    const left = rect.left - (root?.left ?? 0) + rect.width / 2 - width / 2
    const max = (root?.width ?? width) - width
    const below = rect.top < cardHeight.current + 80
    return {
      key,
      ids,
      x: Math.min(Math.max(0, left), Math.max(0, max)),
      y: below
        ? rect.bottom - (root?.top ?? 0) + 8
        : rect.top - (root?.top ?? 0) - 8,
      width,
      below,
    }
  }

  const renderCitedLine = (line: string, lineKey: string) => {
    const segments = parseCitedSegments(line)
    return segments.map((seg, segIdx) => {
      const resolved = seg.citeIds
        .map((id) => byId.get(id))
        .filter((item): item is Citation => Boolean(item))

      if (resolved.length === 0) {
        return <Fragment key={segIdx}>{formatRichInline(seg.text)}</Fragment>
      }

      const key = `${lineKey}-${segIdx}`
      const first = resolved[0]
      const isActive = preview?.key === key
      const isLinked = resolved.some((src) => src.id === hoveredSourceId)

      const claimClass = cn(
        'rounded-[3px] decoration-1 underline-offset-4 transition-[background-color,text-decoration-color] duration-150',
        isActive || isLinked
          ? 'bg-ember/12 underline decoration-ember/60'
          : 'bg-transparent underline decoration-transparent',
      )

      const tail = seg.text.match(LAST_WORD_RE)?.[0].trimEnd() ?? ''
      const head = seg.text.slice(0, seg.text.length - tail.length)

      return (
        <span key={segIdx}>
          {head && <span className={claimClass}>{formatRichInline(head)}</span>}
          <span className="whitespace-nowrap">
            {tail && <span className={claimClass}>{formatRichInline(tail)}</span>}
            {'\u00a0'}
            <button
              type="button"
              data-citation-chip=""
              aria-describedby={isActive ? previewId : undefined}
              aria-expanded={isActive}
              aria-label={resolved.map((item) => item.title).join(', ')}
              onClick={(event) => {
                if (isActive) hide(true)
                else show(place(key, seg.citeIds, event.currentTarget), true)
              }}
              onFocus={(event) =>
                show(place(key, seg.citeIds, event.currentTarget), true)
              }
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') {
                  show(place(key, seg.citeIds, event.currentTarget))
                }
              }}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse') hide()
              }}
              className={cn(
                'inline-flex h-5 translate-y-[-1px] items-center gap-1 rounded-full py-0 pr-2 pl-0.5 align-middle font-mono text-[10px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember',
                isActive || isLinked
                  ? 'bg-bone text-ink'
                  : 'border border-line bg-ink-soft text-bone-dim hover:border-ember hover:text-bone',
              )}
            >
              <Monogram
                citation={first}
                className={
                  isActive || isLinked ? 'bg-ink/15 text-ink' : undefined
                }
              />
              <span>{shortChipLabel(first)}</span>
              {resolved.length > 1 && (
                <span className="opacity-65">+{resolved.length - 1}</span>
              )}
            </button>
          </span>
        </span>
      )
    })
  }

  const cleanedText = text.replace(/[ \t]+([.,;:!?])/g, '$1')
  const rawBlocks = cleanedText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  // Group mixed paragraph + bullet runs within a single block (e.g. a lead-in
  // line followed directly by `* item` without an extra blank line).
  const blocks: Array<{ kind: 'list' | 'paragraph'; lines: string[] }> = []
  for (const raw of rawBlocks) {
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const kind = BULLET_RE.test(line) ? 'list' : 'paragraph'
      const prev = blocks[blocks.length - 1]
      if (prev && prev.kind === kind && i > 0) {
        prev.lines.push(line)
      } else {
        blocks.push({ kind, lines: [line] })
      }
    }
  }

  const activeSources = (preview?.ids ?? [])
    .map((id) => byId.get(id))
    .filter((item): item is Citation => Boolean(item))

  return (
    <div ref={rootRef} className="relative">
      <div className="max-w-[66ch] space-y-3 text-[15px] leading-[1.72] text-bone-dim">
        {blocks.map((block, blockIdx) => {
          const isLastBlock = blockIdx === blocks.length - 1
          if (block.kind === 'list') {
            return (
              <ul key={blockIdx} className="space-y-2 pl-4" role="list">
                {block.lines.map((line, lineIdx) => (
                  <li key={lineIdx} className="relative pl-3">
                    <span
                      aria-hidden
                      className="absolute top-0 left-0 font-mono text-ember"
                    >
                      —
                    </span>
                    {renderCitedLine(line.replace(BULLET_RE, ''), `${blockIdx}-${lineIdx}`)}
                    {streaming && isLastBlock && lineIdx === block.lines.length - 1 && (
                      <span
                        aria-hidden
                        className="ml-1 inline-block h-3.5 w-1.5 align-middle bg-ember motion-safe:animate-pulse"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )
          }

          return (
            <p key={blockIdx} className="text-pretty">
              {block.lines.map((line, lineIdx) => (
                <Fragment key={lineIdx}>
                  {lineIdx > 0 && <br />}
                  {renderCitedLine(line, `${blockIdx}-${lineIdx}`)}
                </Fragment>
              ))}
              {streaming && isLastBlock && (
                <span
                  aria-hidden
                  className="ml-1 inline-block h-3.5 w-1.5 align-middle bg-ember motion-safe:animate-pulse"
                />
              )}
            </p>
          )
        })}
      </div>

      {/* Kokonut AI-17 signature: ONE shared floating preview gliding smoothly between chips */}
      <AnimatePresence>
        {preview && activeSources.length > 0 && (
          <motion.div
            id={previewId}
            role="dialog"
            data-citation-card=""
            initial={{ opacity: 0, scale: 0.97, x: preview.x, y: preview.y }}
            animate={{ opacity: 1, scale: 1, x: preview.x, y: preview.y }}
            exit={{
              opacity: 0,
              scale: 0.97,
              transition: { duration: 0.1, ease: EASE_OUT },
            }}
            transition={{
              opacity: { duration: 0.14, ease: EASE_OUT },
              scale: { duration: 0.14, ease: EASE_OUT },
              x: warm ? { duration: 0.22, ease: EASE_OUT } : { duration: 0 },
              y: warm ? { duration: 0.22, ease: EASE_OUT } : { duration: 0 },
            }}
            onPointerEnter={() => {
              if (preview) show(preview, true)
            }}
            onPointerLeave={() => hide()}
            style={{
              transformOrigin: '50% 0%',
              width: preview.width,
            }}
            className="absolute top-0 left-0 z-20"
          >
            <div
              ref={cardRef}
              className={cn(
                'rounded-2xl border border-line bg-ink-soft p-1.5 shadow-[0_14px_38px_-12px_var(--shade)]',
                !preview.below && '-translate-y-full',
              )}
            >
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={preview.key}
                  initial={{ opacity: 0, filter: 'blur(2px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(2px)' }}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                  className="divide-y divide-line/60"
                >
                  {activeSources.map((source) => (
                    <div key={source.id} className="p-2.5">
                      <div className="flex items-center gap-2 font-mono text-[10px] text-smoke">
                        <Monogram citation={source} />
                        <span className="truncate uppercase">
                          {source.meta ?? source.kind}
                        </span>
                        <span className="ml-auto shrink-0 tabular-nums text-ember">
                          {source.id}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium leading-snug text-bone">
                        {source.title}
                      </p>
                      {source.excerpt && (
                        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-bone-dim">
                          {source.excerpt}
                        </p>
                      )}
                      <div className="mt-2">
                        <SourceActionLink
                          citation={source}
                          label={t.agent.citations.openSource}
                          onNavigateInternal={onNavigateInternal}
                        />
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kokonut AI-17 quiet collapsible sources pill with overlapping monograms */}
      {citations.length > 0 && !streaming && (
        <div className="mt-3.5">
          <button
            type="button"
            aria-controls={listId}
            aria-expanded={listOpen}
            onClick={() => setListOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 font-mono text-[11px] text-bone-dim transition-colors hover:bg-ink-soft hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
          >
            <span className="flex -space-x-1">
              {citations.slice(0, 4).map((source) => (
                <Monogram
                  key={source.id}
                  citation={source}
                  className="size-5 ring-2 ring-ink"
                />
              ))}
            </span>
            <span>
              {citations.length} {t.agent.citations.sourcesLabel.toLowerCase()}
            </span>
            <IconChevronDown
              className={cn(
                'size-3.5 text-smoke transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]',
                listOpen && 'rotate-180 text-ember',
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {listOpen && (
              <motion.ol
                id={listId}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                {citations.map((source, index) => (
                  <li key={source.id} className="pt-1 first:pt-2">
                    <SourceRow
                      citation={source}
                      ordinal={index + 1}
                      onHighlight={(id) => setHoveredSourceId(id)}
                      onNavigateInternal={onNavigateInternal}
                    />
                  </li>
                ))}
              </motion.ol>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function SourceActionLink({
  citation,
  label,
  onNavigateInternal,
}: {
  citation: Citation
  label: string
  onNavigateInternal?: (href: string) => void
}) {
  const cls =
    'inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.12em] text-ember uppercase transition-colors hover:text-bone'

  if (
    citation.external ||
    citation.href.startsWith('/developers') ||
    citation.href.startsWith('/about') ||
    citation.href.startsWith('/contact')
  ) {
    return (
      <a
        href={citation.href}
        target={citation.external ? '_blank' : undefined}
        rel={citation.external ? 'noreferrer' : undefined}
        className={cls}
      >
        <span>{label}</span>
        <IconArrowUpRight className="size-3" />
      </a>
    )
  }

  if (citation.href.startsWith('/#') && onNavigateInternal) {
    return (
      <button
        type="button"
        onClick={() => onNavigateInternal(citation.href)}
        className={cls}
      >
        <span>{label}</span>
        <IconArrowUpRight className="size-3" />
      </button>
    )
  }

  return (
    <Link
      to={citation.href}
      onClick={() => onNavigateInternal?.(citation.href)}
      className={cls}
    >
      <span>{label}</span>
      <IconArrowUpRight className="size-3" />
    </Link>
  )
}

function SourceRow({
  citation,
  ordinal,
  onHighlight,
  onNavigateInternal,
}: {
  citation: Citation
  ordinal: number
  onHighlight: (id: string | null) => void
  onNavigateInternal?: (href: string) => void
}) {
  const rowCls =
    'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-ink-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember'

  const inner = (
    <>
      <span className="w-3.5 shrink-0 text-right font-mono text-[11px] text-smoke tabular-nums">
        {ordinal}
      </span>
      <Monogram citation={citation} />
      <span className="min-w-0 flex-1 truncate text-sm text-bone">
        {citation.title}
      </span>
      <span className="hidden shrink-0 font-mono text-[11px] text-smoke sm:inline">
        {citation.meta ?? citation.kind}
      </span>
      <IconArrowUpRight className="size-3.5 shrink-0 text-smoke transition-colors group-hover:text-ember" />
    </>
  )

  const commonHandlers = {
    onPointerEnter: () => onHighlight(citation.id),
    onPointerLeave: () => onHighlight(null),
    onFocus: () => onHighlight(citation.id),
    onBlur: () => onHighlight(null),
  }

  if (
    citation.external ||
    citation.href.startsWith('/developers') ||
    citation.href.startsWith('/about') ||
    citation.href.startsWith('/contact')
  ) {
    return (
      <a
        href={citation.href}
        target={citation.external ? '_blank' : undefined}
        rel={citation.external ? 'noreferrer' : undefined}
        className={rowCls}
        {...commonHandlers}
      >
        {inner}
      </a>
    )
  }

  if (citation.href.startsWith('/#') && onNavigateInternal) {
    return (
      <button
        type="button"
        onClick={() => onNavigateInternal(citation.href)}
        className={rowCls}
        {...commonHandlers}
      >
        {inner}
      </button>
    )
  }

  return (
    <Link
      to={citation.href}
      onClick={() => onNavigateInternal?.(citation.href)}
      className={rowCls}
      {...commonHandlers}
    >
      {inner}
    </Link>
  )
}
