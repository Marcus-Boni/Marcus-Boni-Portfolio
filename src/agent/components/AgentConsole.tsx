import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'

import { activeKnowledgeNotes } from '@/agent/dossier-cms'
import {
  defaultHybridRuntime,
  probeEdgeCapability,
} from '@/agent/edge-runtime'
import {
  KNOWLEDGE_NOTES,
  SAMPLE_JOB_DESCRIPTIONS,
  STARTER_PROMPTS,
  type KnowledgeNote,
} from '@/agent/knowledge'
import { buildPostSectionIndex, type IndexedPostSection } from '@/agent/post-index'
import {
  clearAgentSession,
  getAgentSession,
  setAgentLens,
  setAgentTurns,
  setRuntimePreference,
  subscribeAgentSession,
} from '@/agent/session'
import { buildShareableAskUrl } from '@/agent/share'
import type {
  AgentHistoryEntry,
  AgentLens,
  AgentTurn,
  ApprovalAction,
  EdgeCapability,
  RuntimeMeta,
  RuntimePreference,
} from '@/agent/types'
import type { PostMeta } from '@/blog/types'
import { useSiteContent } from '@/content/SiteContentContext'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { cn } from '@/lib/utils'

import { FitReportView } from './FitReportView'
import { IconCheck, IconCopy, IconLink, IconReset, IconSpark } from './icons'
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
  initialLens,
  initialMode,
  onCloseDrawer,
}: {
  variant?: 'page' | 'drawer'
  initialPrompt?: string
  initialLens?: AgentLens
  initialMode?: RuntimePreference
  onCloseDrawer?: () => void
}) {
  const { locale, t } = useLanguage()
  const { content, source } = useSiteContent()
  const reduced = usePrefersReducedMotion()
  const navigate = useNavigate()

  const session = useSyncExternalStore(subscribeAgentSession, getAgentSession)
  const { lens, runtimePreference, turns } = session

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [posts, setPosts] = useState<PostMeta[]>([])
  const [postSections, setPostSections] = useState<IndexedPostSection[]>([])
  const [knowledgeNotes, setKnowledgeNotes] = useState<readonly KnowledgeNote[]>(KNOWLEDGE_NOTES)
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null)
  const [sharedTurnId, setSharedTurnId] = useState<string | null>(null)
  const [edgeCapability, setEdgeCapability] = useState<EdgeCapability>({
    checked: false,
    configured: false,
    provider: null,
    model: null,
  })
  const abortRef = useRef<AbortController | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevTurnCountRef = useRef(turns.length)
  const consumedInitialRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (initialLens) setAgentLens(initialLens)
  }, [initialLens])

  useEffect(() => {
    if (initialMode) setRuntimePreference(initialMode)
  }, [initialMode])

  useEffect(() => {
    let cancelled = false
    void probeEdgeCapability().then((cap) => {
      if (!cancelled) setEdgeCapability(cap)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!isFirebaseConfigured) return
    void import('@/blog/service')
      .then(async ({ fetchPublishedPosts, fetchPublishedPostBodies }) => {
        const list = await fetchPublishedPosts(30)
        if (cancelled) return
        setPosts(list)
        if (list.length === 0) return
        const bodies = await fetchPublishedPostBodies(list, 15)
        if (cancelled) return
        setPostSections(buildPostSectionIndex(list, bodies))
      })
      .catch(() => {
        /* best-effort; portfolio data remains fully searchable */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!isFirebaseConfigured) return
    void import('@/agent/dossier-service')
      .then(({ fetchDossierKnowledge }) => fetchDossierKnowledge())
      .then((config) => {
        if (!cancelled) setKnowledgeNotes(config.notes)
      })
      .catch(() => {
        /* static KNOWLEDGE_NOTES remain active */
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

    const pageDistanceFromBottom =
      document.documentElement.scrollHeight - window.scrollY - window.innerHeight
    if (turnAdded || pageDistanceFromBottom < 180) {
      bottomRef.current?.scrollIntoView({
        behavior: reduced ? 'instant' : 'smooth',
        block: 'end',
      })
    }
  }, [turns.length, lastTurnText, lastTurnToolCount, reduced, variant])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const runPrompt = useCallback(
    async (
      rawPrompt: string,
      overrides?: { lens?: AgentLens; preference?: RuntimePreference },
    ) => {
      const trimmed = rawPrompt.trim()
      if (!trimmed) return

      const activeLens = overrides?.lens ?? lens
      const activePreference = overrides?.preference ?? runtimePreference

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStreaming(true)

      const userTurn: AgentTurn = {
        id: createId('user'),
        role: 'user',
        text: trimmed,
        lens: activeLens,
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
        lens: activeLens,
        locale,
        sourcePrompt: trimmed,
        tools: [],
        citations: [],
        streaming: true,
        createdAt: Date.now(),
      }

      const history: AgentHistoryEntry[] = getAgentSession()
        .turns.filter((turn) => !turn.streaming && turn.text.trim().length > 0)
        .slice(-6)
        .map((turn) => ({
          role: turn.role,
          text: turn.text,
          intent: turn.intent,
          citationTitles: turn.citations
            .filter((item) => item.kind === 'project' || item.kind === 'experience')
            .map((item) => item.title),
          citations: turn.citations,
        }))

      setAgentTurns((prev) => [...prev, userTurn, assistantTurn])

      const patchAssistant = (updater: (turn: AgentTurn) => AgentTurn) => {
        setAgentTurns((prev) =>
          prev.map((turn) => (turn.id === assistantId ? updater(turn) : turn)),
        )
      }

      let observedRuntime: RuntimeMeta | undefined

      try {
        for await (const event of defaultHybridRuntime.streamTurn(trimmed, {
          content,
          posts,
          knowledgeNotes,
          postSections,
          locale,
          lens: activeLens,
          history,
          preference: activePreference,
          reducedMotion: reduced,
          signal: controller.signal,
        })) {
          if (controller.signal.aborted) break

          switch (event.type) {
            case 'status':
              patchAssistant((turn) => ({ ...turn, statusLabel: event.label }))
              break
            case 'runtime_meta':
              observedRuntime = event.meta
              patchAssistant((turn) => ({ ...turn, runtimeMeta: event.meta }))
              if (event.meta.mode === 'edge-llm' && event.meta.model) {
                setEdgeCapability({
                  checked: true,
                  configured: true,
                  provider: event.meta.provider ?? null,
                  model: event.meta.model,
                })
              }
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
                lens: activeLens,
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
                lens: activeLens,
                surface: variant,
                runtime: observedRuntime?.mode ?? 'local-deterministic',
                provider: observedRuntime?.provider ?? 'local',
                fallback: observedRuntime?.fallbackReason ?? 'none',
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
    [content, posts, knowledgeNotes, postSections, locale, lens, runtimePreference, reduced, variant],
  )

  useEffect(() => {
    if (!initialPrompt || consumedInitialRef.current === initialPrompt) return
    const alreadyAnswered = getAgentSession().turns.some(
      (turn) =>
        turn.role === 'assistant' &&
        !turn.stopped &&
        !turn.streaming &&
        turn.sourcePrompt === initialPrompt,
    )
    if (alreadyAnswered) {
      consumedInitialRef.current = initialPrompt
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled) return
      consumedInitialRef.current = initialPrompt
      void runPrompt(initialPrompt, {
        lens: initialLens,
        preference: initialMode,
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [initialPrompt, initialLens, initialMode, runPrompt])

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

  const handleCopyAnswer = async (turn: AgentTurn) => {
    try {
      await navigator.clipboard.writeText(turn.text)
      setCopiedTurnId(turn.id)
      trackEvent('agent_share', { kind: 'answer_copy' })
      window.setTimeout(() => {
        setCopiedTurnId((current) => (current === turn.id ? null : current))
      }, 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const handleShareTurn = async (turn: AgentTurn) => {
    if (!turn.sourcePrompt) return
    try {
      const url = buildShareableAskUrl({
        locale: turn.locale,
        lens: turn.lens,
        prompt: turn.sourcePrompt,
      })
      await navigator.clipboard.writeText(url)
      setSharedTurnId(turn.id)
      trackEvent('agent_share', { kind: 'turn_link' })
      window.setTimeout(() => {
        setSharedTurnId((current) => (current === turn.id ? null : current))
      }, 2000)
    } catch {
      /* clipboard unavailable */
    }
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
      noteCount={activeKnowledgeNotes(knowledgeNotes).length}
      postCount={posts.length}
      sectionCount={postSections.filter((sec) => sec.locale === locale).length}
      turnCount={turns.length}
      source={source}
      runtimePreference={runtimePreference}
      onRuntimePreferenceChange={setRuntimePreference}
      edgeCapability={edgeCapability}
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
                data-lenis-prevent={variant === 'drawer' ? '' : undefined}
                className={cn(
                  'flex-1 px-5',
                  variant === 'drawer'
                    ? 'min-h-0 overflow-y-auto overscroll-contain py-5 [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]'
                    : 'pt-6 pb-10',
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

                          {!turn.streaming && turn.text && (
                            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.06em] text-smoke">
                              {turn.runtimeMeta?.mode === 'edge-llm' &&
                                turn.runtimeMeta.model && (
                                  <span>
                                    {t.agent.meter.edgeReady(
                                      turn.runtimeMeta.provider
                                        ? `${turn.runtimeMeta.provider} · ${turn.runtimeMeta.model}`
                                        : turn.runtimeMeta.model,
                                    )}
                                  </span>
                                )}

                              {turn.runtimeMeta?.fallbackReason === 'rate_limited' && (
                                <span>{t.agent.meter.rateLimitNote}</span>
                              )}

                              <span className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleCopyAnswer(turn)}
                                  className="inline-flex items-center gap-1 rounded-full py-0.5 text-smoke transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                                >
                                  {copiedTurnId === turn.id ? (
                                    <>
                                      <IconCheck className="size-3 text-ember" />
                                      <span className="text-bone">
                                        {t.agent.copiedAnswer}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <IconCopy className="size-3" />
                                      <span>{t.agent.copyAnswer}</span>
                                    </>
                                  )}
                                </button>

                                {turn.sourcePrompt && (
                                  <button
                                    type="button"
                                    onClick={() => void handleShareTurn(turn)}
                                    className="inline-flex items-center gap-1 rounded-full py-0.5 text-smoke transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                                  >
                                    {sharedTurnId === turn.id ? (
                                      <>
                                        <IconCheck className="size-3 text-ember" />
                                        <span className="text-bone">
                                          {t.agent.copiedLink}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <IconLink className="size-3" />
                                        <span>{t.agent.shareLink}</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </span>
                            </div>
                          )}

                          {turn.fitReport && (
                            <FitReportView
                              report={turn.fitReport}
                              sourcePrompt={turn.sourcePrompt}
                              lens={turn.lens}
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
