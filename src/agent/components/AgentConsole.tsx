import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'

import { SAMPLE_JOB_DESCRIPTIONS, STARTER_PROMPTS } from '@/agent/knowledge'
import { defaultAgentRuntime } from '@/agent/runtime'
import {
  clearAgentSession,
  getAgentSession,
  setAgentLens,
  setAgentTurns,
  subscribeAgentSession,
} from '@/agent/session'
import type { AgentLens, AgentTurn, ApprovalAction } from '@/agent/types'
import type { PostMeta } from '@/blog/types'
import { useSiteContent } from '@/content/SiteContentContext'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { cn } from '@/lib/utils'

import { FitReportView } from './FitReportView'
import { IconReset, IconSpark } from './icons'
import { GroundedProse } from './InlineCitations'
import { PromptBar } from './PromptBar'
import { TextLoading } from './TextLoading'
import { ToolApprovalCard } from './ToolApprovalCard'
import { ToolCallsTrace } from './ToolCallsTrace'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Serene, canvas-first agentic workspace combining the full Kokonut UI AI
 * component suite (`AI-01`, `AI-04`, `AI-05`, `AI-07`, `AI-10`, `AI-16`, `AI-17`)
 * inside Signal & Ink:
 * - Landing state: centered sculptural greeting, floating composer, 4 airy pills.
 * - Active conversation: clean open prose stream with a sticky docked composer.
 */
export function AgentConsole({
  variant = 'page',
  initialPrompt,
  onCloseDrawer,
}: {
  variant?: 'page' | 'drawer'
  initialPrompt?: string
  onCloseDrawer?: () => void
}) {
  const { locale, t } = useLanguage()
  const { content, source } = useSiteContent()
  const reduced = usePrefersReducedMotion()
  const navigate = useNavigate()

  const session = useSyncExternalStore(subscribeAgentSession, getAgentSession)
  const { lens, turns } = session

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [posts, setPosts] = useState<PostMeta[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevTurnCountRef = useRef(turns.length)
  const consumedInitialRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    if (!isFirebaseConfigured) return
    void import('@/blog/service')
      .then(({ fetchPublishedPosts }) => fetchPublishedPosts(30))
      .then((list) => {
        if (!cancelled) setPosts(list)
      })
      .catch(() => {
        /* best-effort; portfolio data remains fully searchable */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const lastTurn = turns[turns.length - 1]
  const lastTurnText = lastTurn?.text
  const lastTurnToolCount = lastTurn?.tools.length ?? 0

  useEffect(() => {
    const turnAdded = turns.length > prevTurnCountRef.current
    prevTurnCountRef.current = turns.length
    if (turns.length === 0) return

    if (variant === 'drawer') {
      const container = scrollContainerRef.current
      if (!container) return
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight
      if (turnAdded || distanceFromBottom < 140) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: reduced ? 'instant' : 'smooth',
        })
      }
      return
    }

    bottomRef.current?.scrollIntoView({
      behavior: reduced ? 'instant' : 'smooth',
      block: 'end',
    })
  }, [turns.length, lastTurnText, lastTurnToolCount, reduced, variant])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const runPrompt = useCallback(
    async (rawPrompt: string) => {
      const trimmed = rawPrompt.trim()
      if (!trimmed) return

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStreaming(true)

      const userTurn: AgentTurn = {
        id: createId('user'),
        role: 'user',
        text: trimmed,
        lens,
        locale,
        tools: [],
        citations: [],
        createdAt: Date.now(),
      }

      const assistantId = createId('asst')
      const assistantTurn: AgentTurn = {
        id: assistantId,
        role: 'assistant',
        text: '',
        lens,
        locale,
        tools: [],
        citations: [],
        streaming: true,
        createdAt: Date.now(),
      }

      setAgentTurns((prev) => [...prev, userTurn, assistantTurn])

      const patchAssistant = (updater: (turn: AgentTurn) => AgentTurn) => {
        setAgentTurns((prev) =>
          prev.map((turn) => (turn.id === assistantId ? updater(turn) : turn)),
        )
      }

      try {
        for await (const event of defaultAgentRuntime.streamTurn(trimmed, {
          content,
          posts,
          locale,
          lens,
          reducedMotion: reduced,
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) break

          switch (event.type) {
            case 'status':
              patchAssistant((turn) => ({ ...turn, statusLabel: event.label }))
              break
            case 'tool_start':
              patchAssistant((turn) => ({
                ...turn,
                tools: [...turn.tools, event.tool],
              }))
              break
            case 'tool_result':
              patchAssistant((turn) => ({
                ...turn,
                tools: turn.tools.map((tool) =>
                  tool.id === event.id
                    ? {
                        ...tool,
                        status: 'done',
                        durationMs: event.durationMs,
                        summary: event.summary,
                        result: event.result,
                      }
                    : tool,
                ),
              }))
              break
            case 'citations':
              patchAssistant((turn) => ({ ...turn, citations: event.citations }))
              break
            case 'text_delta':
              patchAssistant((turn) => ({
                ...turn,
                statusLabel: undefined,
                text: turn.text + event.delta,
              }))
              break
            case 'fit_report':
              patchAssistant((turn) => ({ ...turn, fitReport: event.report }))
              trackEvent('agent_fit', {
                matched: event.report.matched.length,
                gaps: event.report.gaps.length,
                lens,
              })
              break
            case 'approval_request':
              patchAssistant((turn) => ({ ...turn, approval: event.approval }))
              break
            case 'done':
              patchAssistant((turn) => ({
                ...turn,
                intent: event.intent,
                statusLabel: undefined,
                streaming: false,
              }))
              trackEvent('agent_query', {
                intent: event.intent,
                lens,
                surface: variant,
              })
              break
            case 'error':
              patchAssistant((turn) => ({
                ...turn,
                text: event.message,
                statusLabel: undefined,
                streaming: false,
              }))
              break
          }
        }
      } finally {
        if (controller.signal.aborted) {
          patchAssistant((turn) => ({
            ...turn,
            streaming: false,
            stopped: true,
            statusLabel: undefined,
          }))
        }
        setStreaming(false)
      }
    },
    [content, posts, locale, lens, reduced, variant],
  )

  useEffect(() => {
    if (initialPrompt && consumedInitialRef.current !== initialPrompt) {
      consumedInitialRef.current = initialPrompt
      void runPrompt(initialPrompt)
    }
  }, [initialPrompt, runPrompt])

  const handleStop = () => {
    abortRef.current?.abort()
    setStreaming(false)
  }

  const handleLensChange = (nextLens: AgentLens) => {
    setAgentLens(nextLens)
  }

  const handleApprovalUpdate = (turnId: string, next: ApprovalAction) => {
    setAgentTurns((prev) =>
      prev.map((turn) => (turn.id === turnId ? { ...turn, approval: next } : turn)),
    )
  }

  const handleReset = () => {
    abortRef.current?.abort()
    setStreaming(false)
    clearAgentSession()
  }

  const handleNavigateInternal = (href: string) => {
    onCloseDrawer?.()
    if (href.startsWith('/#')) {
      const sectionId = href.slice(2)
      if (window.location.pathname === '/') {
        window.setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({
            behavior: reduced ? 'instant' : 'smooth',
          })
        }, 120)
        return
      }
      navigate('/')
      window.setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({
          behavior: reduced ? 'instant' : 'smooth',
        })
      }, 280)
      return
    }
    navigate(href)
  }

  const starters = STARTER_PROMPTS[locale][lens]
  const sampleJd = SAMPLE_JOB_DESCRIPTIONS[locale]
  const isEmpty = turns.length === 0

  const composer = (
    <PromptBar
      value={input}
      onChange={setInput}
      onSubmit={(prompt) => void runPrompt(prompt)}
      onStop={handleStop}
      streaming={streaming}
      lens={lens}
      onLensChange={handleLensChange}
      projectCount={content.projects.length}
      engagementCount={content.experience.projects.length}
      techCount={content.techStack.length}
      postCount={posts.length}
      turnCount={turns.length}
      source={source}
      menuSide={isEmpty ? 'bottom' : 'top'}
      autoFocus={variant === 'drawer'}
    />
  )

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          'flex w-full flex-col',
          variant === 'drawer' ? 'h-full min-h-0' : 'min-h-[calc(100svh-4.5rem)]',
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isEmpty ? (
            /* ─── Serene centered landing state (zero boxes, generous space) ─── */
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.16, ease: EASE_OUT } }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className={cn(
                'mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-5',
                variant === 'page' ? 'py-10 md:py-16' : 'pt-4 pb-20',
              )}
            >
              <div className="mb-7 text-center">
                {variant === 'page' ? (
                  <h1 className="font-display text-[clamp(2.4rem,6vw,4rem)] leading-[1.06] tracking-normal text-bone text-balance">
                    {t.agent.pageHeading}
                  </h1>
                ) : (
                  <p className="font-display text-3xl leading-[1.1] tracking-normal text-bone text-balance">
                    {t.agent.pageHeading}
                  </p>
                )}
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-smoke text-pretty">
                  {t.agent.pageSubtitle}
                </p>
              </div>

              {composer}

              {/* Four clean pill suggestions — zero heavy grid cards */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void runPrompt(sampleJd.text)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ember/50 bg-ember/10 px-3.5 py-1.5 text-xs font-medium text-ember transition-colors hover:border-ember hover:bg-ember hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                >
                  <IconSpark className="size-3.5" />
                  <span>{sampleJd.label}</span>
                </button>

                {starters.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void runPrompt(prompt)}
                    className="rounded-full border border-line bg-ink-soft/60 px-3.5 py-1.5 text-xs text-bone-dim transition-colors hover:border-bone/35 hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            /* ─── Active conversation state: open stream + sticky composer ─── */
            <motion.div
              key="thread"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div
                ref={scrollContainerRef}
                data-lenis-prevent
                className={cn(
                  'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]',
                  variant === 'page' ? 'pt-6 pb-10' : 'py-5',
                )}
              >
                <div className="mx-auto max-w-2xl">
                  {/* Quiet top thread action */}
                  <div className="mb-6 flex justify-end">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-smoke uppercase transition-colors hover:border-ember hover:text-bone"
                    >
                      <IconReset className="size-3" />
                      <span>{t.agent.newChat}</span>
                    </button>
                  </div>

                  <div className="space-y-9">
                    {turns.map((turn) =>
                      turn.role === 'user' ? (
                        <motion.div
                          key={turn.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.22, ease: EASE_OUT }}
                          className="flex justify-end"
                        >
                          <p className="max-w-[84%] rounded-2xl rounded-br-md border border-line bg-ink-soft px-4 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap text-bone">
                            {turn.text}
                          </p>
                        </motion.div>
                      ) : (
                        <article
                          key={turn.id}
                          aria-label={t.agent.assistantTurnLabel}
                        >
                          <ToolCallsTrace
                            tools={turn.tools}
                            streaming={Boolean(turn.streaming)}
                            evidenceCount={turn.citations.length}
                          />

                          {turn.streaming && turn.statusLabel && !turn.text && (
                            <TextLoading label={turn.statusLabel} className="my-1" />
                          )}

                          {turn.text && (
                            <motion.div
                              initial={{ opacity: 0, y: 4, filter: 'blur(3px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              transition={{ duration: 0.3, ease: EASE_OUT }}
                            >
                              <GroundedProse
                                text={turn.text}
                                citations={turn.citations}
                                streaming={turn.streaming}
                                onNavigateInternal={handleNavigateInternal}
                              />
                            </motion.div>
                          )}

                          {turn.stopped && (
                            <p className="mt-2 font-mono text-[11px] text-smoke">
                              {t.agent.stoppedNotice}
                            </p>
                          )}

                          {turn.fitReport && (
                            <FitReportView
                              report={turn.fitReport}
                              onNavigateInternal={handleNavigateInternal}
                            />
                          )}

                          {turn.approval && (
                            <ToolApprovalCard
                              approval={turn.approval}
                              onUpdate={(next) => handleApprovalUpdate(turn.id, next)}
                            />
                          )}
                        </article>
                      ),
                    )}
                    <div ref={bottomRef} />
                  </div>
                </div>
              </div>

              {/* Clean docked composer */}
              <div
                className={cn(
                  'shrink-0 bg-ink/95 px-5 pt-3 backdrop-blur-md',
                  variant === 'page' ? 'sticky bottom-0 pb-5' : 'border-t border-line/70 pb-4',
                )}
              >
                <div className="mx-auto max-w-2xl">{composer}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
