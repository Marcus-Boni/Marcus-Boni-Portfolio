import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useState } from 'react'

import type { ToolCallTrace, ToolName } from '@/agent/types'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

import {
  IconBriefcase,
  IconChevron,
  IconFileText,
  IconLayers,
  IconMail,
  IconSearch,
  IconSpark,
  IconUser,
} from './icons'

/**
 * Full Kokonut UI `AI-07` (AI Tool Calls) ported to Signal & Ink.
 *
 * - Minimal inline trigger (no heavy outer box) with a hairline spinner that
 *   morphs into an overlapping circular `IconStack` once all tools finish.
 * - Blur-transitioning status label (`Working` → `4 tools · 14ms`), vertical
 *   left guide rail (`ml-[9.5px] border-l border-line pl-[18px]`), live per-row
 *   timers that swap smoothly into concise results, and a 650ms auto-fold.
 * - Clicking any completed row expands its real OpenAPI 3.1 JSON payload.
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const FOLD_DELAY = 650

function iconForTool(name: ToolName) {
  switch (name) {
    case 'listTechnologies':
      return IconLayers
    case 'getExperience':
      return IconBriefcase
    case 'listProjects':
      return IconSearch
    case 'listPosts':
      return IconFileText
    case 'matchRole':
      return IconSpark
    case 'prepareHandoff':
      return IconMail
    case 'getProfile':
    default:
      return IconUser
  }
}

function Spinner() {
  return (
    <motion.svg
      animate={{ rotate: 360 }}
      aria-hidden="true"
      className="size-3.5 text-ember"
      fill="none"
      transition={{
        duration: 0.65,
        ease: 'linear',
        repeat: Number.POSITIVE_INFINITY,
      }}
      viewBox="0 0 16 16"
    >
      <circle
        cx="8"
        cy="8"
        opacity="0.2"
        r="6.25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </motion.svg>
  )
}

function IconStack({
  tools,
  still,
}: {
  tools: ToolCallTrace[]
  still: boolean
}) {
  return (
    <span className="flex items-center">
      {tools.map((tool, index) => {
        const Icon = iconForTool(tool.name)
        const isPrimary = index === 0
        return (
          <motion.span
            key={tool.id}
            initial={still ? false : { x: -6 * index, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            style={{ zIndex: tools.length - index }}
            className={cn(
              '-ml-1.5 flex size-5 items-center justify-center rounded-full ring-1 ring-ink first:ml-0',
              isPrimary
                ? 'bg-ember/15 text-ember'
                : 'bg-ink-soft text-bone-dim',
            )}
          >
            <Icon className="size-2.5" />
          </motion.span>
        )
      })}
    </span>
  )
}

function LiveMs({
  startedAt,
  durationMs,
  running,
}: {
  startedAt: number
  durationMs?: number
  running: boolean
}) {
  const reduced = usePrefersReducedMotion()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!running || reduced) return
    const id = window.setInterval(() => {
      setElapsed(Math.max(1, Date.now() - startedAt))
    }, 45)
    return () => window.clearInterval(id)
  }, [running, reduced, startedAt])

  if (running) {
    return <>{reduced ? '…' : `${elapsed}ms`}</>
  }
  return <>{`${durationMs ?? 1}ms`}</>
}

export function ToolCallsTrace({
  tools,
  streaming,
  evidenceCount,
}: {
  tools: ToolCallTrace[]
  streaming: boolean
  evidenceCount: number
}) {
  const { t } = useLanguage()
  const listId = useId()
  const finished = tools.length > 0 && tools.every((tool) => tool.status !== 'running')
  const [doneAtMount] = useState(finished && !streaming)
  const [open, setOpen] = useState(!doneAtMount)
  const [userToggled, setUserToggled] = useState(false)
  const [inspectedId, setInspectedId] = useState<string | null>(null)

  // Auto-fold a beat after the last tool finishes (exact Kokonut AI-07 rhythm)
  useEffect(() => {
    if (!finished || userToggled || doneAtMount) return
    const timer = window.setTimeout(() => setOpen(false), FOLD_DELAY)
    return () => window.clearTimeout(timer)
  }, [finished, userToggled, doneAtMount])

  if (tools.length === 0) return null

  const totalMs = tools.reduce((sum, tool) => sum + (tool.durationMs ?? 0), 0)

  return (
    <div className="mb-3" data-state={finished ? 'done' : 'running'}>
      <button
        type="button"
        aria-controls={listId}
        aria-expanded={open}
        disabled={!finished}
        onClick={() => {
          setUserToggled(true)
          setOpen((prev) => !prev)
        }}
        className="group flex h-7 items-center gap-2 rounded-full pr-2 text-left text-[13px] transition-colors focus-visible:outline-1 focus-visible:outline-ember disabled:cursor-default"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {finished ? (
            <motion.span
              key="stack"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <IconStack tools={tools} still={doneAtMount} />
            </motion.span>
          ) : (
            <motion.span
              key="spin"
              exit={{ opacity: 0 }}
              className="flex size-5 items-center justify-center"
            >
              <Spinner />
            </motion.span>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={finished ? 'used' : 'working'}
            initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className={cn(
              'text-[13px] font-medium transition-colors duration-150',
              finished
                ? 'text-bone-dim group-hover:text-bone'
                : 'text-bone',
            )}
          >
            {finished
              ? t.agent.tools.summary(tools.length, totalMs, evidenceCount)
              : t.agent.tools.running(tools.length)}
          </motion.span>
        </AnimatePresence>

        {finished && (
          <IconChevron
            className={cn(
              'size-3.5 text-smoke transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:text-ember',
              open && 'rotate-90 text-ember',
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={listId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <ol className="ml-[9.5px] border-l border-line pt-1 pl-[18px]">
              <AnimatePresence initial={false}>
                {tools.map((tool) => {
                  const Icon = iconForTool(tool.name)
                  const running = tool.status === 'running'
                  const showJson = inspectedId === tool.id
                  return (
                    <motion.li
                      key={tool.id}
                      initial={{ height: 0, opacity: 0, filter: 'blur(3px)' }}
                      animate={{ height: 'auto', opacity: 1, filter: 'blur(0px)' }}
                      transition={{ duration: 0.28, ease: EASE_OUT }}
                      className="list-none"
                    >
                      <div className="flex min-h-8 flex-wrap items-center gap-2 py-1 text-[13px]">
                        <Icon
                          className={cn(
                            'size-3.5 shrink-0',
                            running ? 'text-ember' : 'text-smoke',
                          )}
                        />
                        <span
                          className={cn(
                            'shrink-0',
                            running ? 'text-bone' : 'text-bone-dim',
                          )}
                        >
                          {tool.label}
                        </span>
                        <span className="min-w-0 truncate font-mono text-[11px] text-smoke">
                          {tool.endpoint}
                        </span>

                        <span className="ml-auto flex shrink-0 items-center gap-2.5 pl-2">
                          <AnimatePresence initial={false} mode="popLayout">
                            <motion.span
                              key={running ? 'time' : 'result'}
                              initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, y: -4, filter: 'blur(2px)' }}
                              transition={{ duration: 0.18, ease: EASE_OUT }}
                              className={cn(
                                'font-mono text-[11px] tabular-nums',
                                running ? 'text-ember' : 'text-smoke',
                              )}
                            >
                              {running ? (
                                <LiveMs startedAt={tool.startedAt} running />
                              ) : (
                                `${tool.durationMs ?? 1}ms`
                              )}
                            </motion.span>
                          </AnimatePresence>

                          {!running && tool.result !== undefined && (
                            <button
                              type="button"
                              aria-expanded={showJson}
                              onClick={() =>
                                setInspectedId((current) =>
                                  current === tool.id ? null : tool.id,
                                )
                              }
                              className={cn(
                                'rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase transition-colors',
                                showJson
                                  ? 'border-ember bg-ember text-ink'
                                  : 'border-line text-smoke hover:border-ember hover:text-bone',
                              )}
                            >
                              {showJson ? t.agent.tools.hideJson : t.agent.tools.viewJson}
                            </button>
                          )}
                        </span>
                      </div>

                      <AnimatePresence initial={false}>
                        {showJson && tool.result !== undefined && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: EASE_OUT }}
                            className="overflow-hidden"
                          >
                            <pre
                              tabIndex={0}
                              className="mt-1 mb-2 max-h-52 overflow-auto rounded-xl border border-line bg-ink-soft p-3 font-mono text-[11px] leading-relaxed text-bone-dim"
                            >
                              {JSON.stringify(
                                {
                                  operationId: tool.name,
                                  endpoint: tool.endpoint,
                                  args: tool.args,
                                  summary: tool.summary,
                                  data: tool.result,
                                },
                                null,
                                2,
                              )}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
