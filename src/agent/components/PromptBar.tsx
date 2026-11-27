import { AnimatePresence, motion } from 'framer-motion'
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'

import { SLASH_COMMANDS } from '@/agent/knowledge'
import type {
  AgentLens,
  EdgeCapability,
  RuntimePreference,
  SlashCommandDef,
} from '@/agent/types'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

import { ContextMeter } from './ContextMeter'
import {
  IconArrowUp,
  IconCheck,
  IconChevronDown,
  IconClose,
  IconFileText,
  IconMic,
  IconPlus,
  IconSlash,
} from './icons'
import { VoiceRecorder } from './VoiceRecorder'

function hasSpeechRecognition(): boolean {
  if (typeof window === 'undefined') return false
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
}

/**
 * Full Kokonut UI `AI-01` (AI Prompt Input) ported to Signal & Ink:
 * - Clean `rounded-2xl` floating surface (no nested box chrome)
 * - Drop or attach `.txt` / `.md` Job Description files as animated chips
 * - `/` Command Menu with matched-substring highlighting + animated `CommandPill`
 * - Compact Kokonut-style Lens dropdown (`Recrutador ▾` with blur-morph swap)
 * - Integrated Kokonut `AI-16` Context Ring + `AI-05` Voice Waveform dictation
 * - Kokonut two-face blur-morph circular Send / Stop button
 */

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const WHITESPACE = /\s/

interface AttachedDoc {
  id: string
  name: string
  size: number
  text: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${Math.round(bytes / 1024)} KB`
}

function MatchedCommand({ label, query }: { label: string; query: string }) {
  const start = query ? label.toLowerCase().indexOf(query) : -1
  if (start < 0) return <>{label}</>
  const end = start + query.length
  return (
    <>
      {label.slice(0, start)}
      <span className="font-medium text-bone">{label.slice(start, end)}</span>
      {label.slice(end)}
    </>
  )
}

export function PromptBar({
  value,
  onChange,
  onSubmit,
  onStop,
  streaming,
  lens,
  onLensChange,
  projectCount,
  engagementCount,
  techCount,
  noteCount = 0,
  postCount,
  sectionCount = 0,
  turnCount,
  source,
  runtimePreference = 'auto',
  onRuntimePreferenceChange,
  edgeCapability,
  menuSide = 'top',
  autoFocus = false,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: (prompt: string) => void
  onStop: () => void
  streaming: boolean
  lens: AgentLens
  onLensChange: (lens: AgentLens) => void
  projectCount: number
  engagementCount: number
  techCount: number
  noteCount?: number
  postCount: number
  sectionCount?: number
  turnCount: number
  source: 'live' | 'static'
  runtimePreference?: RuntimePreference
  onRuntimePreferenceChange?: (next: RuntimePreference) => void
  edgeCapability?: EdgeCapability
  menuSide?: 'top' | 'bottom'
  autoFocus?: boolean
}) {
  const { locale, t } = useLanguage()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lensMenuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const lastSentRef = useRef('')

  const [selectedCmd, setSelectedCmd] = useState<SlashCommandDef | null>(null)
  const [attachments, setAttachments] = useState<AttachedDoc[]>([])
  const [slashIndex, setSlashIndex] = useState(0)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const [lensOpen, setLensOpen] = useState(false)
  const [voiceActive, setVoiceActive] = useState(false)
  const [dragging, setDragging] = useState(false)
  const voiceAvailable = useMemo(() => hasSpeechRecognition(), [])

  const slashQuery = useMemo(() => {
    if (selectedCmd) return null
    if (!value.startsWith('/') || WHITESPACE.test(value)) return null
    return value.slice(1).toLowerCase()
  }, [selectedCmd, value])

  const filteredCommands = useMemo(() => {
    if (slashQuery === null || slashDismissed) return []
    return SLASH_COMMANDS.filter(
      (item) =>
        item.command.slice(1).startsWith(slashQuery) ||
        item.label[locale].toLowerCase().includes(slashQuery),
    )
  }, [slashQuery, slashDismissed, locale])

  const slashOpen = filteredCommands.length > 0
  const activeSlash = Math.min(slashIndex, Math.max(filteredCommands.length - 1, 0))

  // Auto-resize textarea cleanly
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [value, voiceActive])

  useEffect(() => {
    if (autoFocus && !voiceActive) textareaRef.current?.focus()
  }, [autoFocus, voiceActive])

  // Close lens dropdown on outside click or Escape
  useEffect(() => {
    if (!lensOpen) return
    const onPointer = (event: PointerEvent) => {
      if (!lensMenuRef.current?.contains(event.target as Node)) setLensOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setLensOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey as unknown as EventListener)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey as unknown as EventListener)
    }
  }, [lensOpen])

  const attachFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).slice(0, 3)
    const next: AttachedDoc[] = []
    for (const file of files) {
      if (file.size > 150_000) continue
      try {
        const text = await file.text()
        if (!text.trim()) continue
        next.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          name: file.name,
          size: file.size,
          text: text.trim().slice(0, 4000),
        })
      } catch {
        /* skip unreadable binary files */
      }
    }
    if (next.length > 0) {
      setAttachments((prev) => [...prev, ...next])
      // Auto-select /fit pill if user drops a job description document
      if (!selectedCmd) {
        const fitCmd = SLASH_COMMANDS.find((c) => c.command === '/fit') ?? null
        setSelectedCmd(fitCmd)
      }
      textareaRef.current?.focus()
    }
  }

  const pickCommand = (cmd: SlashCommandDef) => {
    if (cmd.command === '/cv') {
      setSelectedCmd(null)
      onChange('')
      onSubmit('/cv')
      return
    }
    setSelectedCmd(cmd)
    onChange('')
    setSlashIndex(0)
    setSlashDismissed(true)
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const canSend =
    (value.trim().length > 0 || attachments.length > 0 || selectedCmd !== null) &&
    !streaming

  const commitSend = () => {
    if (!canSend) return
    const parts: string[] = []
    if (selectedCmd) parts.push(selectedCmd.command)
    if (value.trim()) parts.push(value.trim())
    if (attachments.length > 0) {
      parts.push(attachments.map((doc) => doc.text).join('\n\n'))
    }
    const finalPrompt = parts.join(' ').trim()
    if (!finalPrompt) return
    lastSentRef.current = value
    onChange('')
    setSelectedCmd(null)
    setAttachments([])
    onSubmit(finalPrompt)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashIndex((i) => (i + 1) % filteredCommands.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
        event.preventDefault()
        const picked = filteredCommands[activeSlash]
        if (picked) pickCommand(picked)
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSlashDismissed(true)
        return
      }
    }

    // Backspace at position 0 clears active command pill (Kokonut AI-01 detail)
    if (event.key === 'Backspace' && value === '' && selectedCmd) {
      event.preventDefault()
      setSelectedCmd(null)
      return
    }

    // ArrowUp on empty prompt recalls last message like a terminal
    if (event.key === 'ArrowUp' && value === '' && lastSentRef.current) {
      event.preventDefault()
      onChange(lastSentRef.current)
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      commitSend()
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    if (event.dataTransfer.files?.length) {
      void attachFiles(event.dataTransfer.files)
    }
  }

  const lensOptions: { id: AgentLens; label: string; hint: string }[] = [
    {
      id: 'recruiter',
      label: t.agent.lenses.recruiter,
      hint: t.agent.lenses.recruiterHint,
    },
    {
      id: 'engineer',
      label: t.agent.lenses.engineer,
      hint: t.agent.lenses.engineerHint,
    },
    {
      id: 'client',
      label: t.agent.lenses.client,
      hint: t.agent.lenses.clientHint,
    },
  ]

  const faceClass =
    'absolute inset-0 flex items-center justify-center transition-[opacity,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]'

  return (
    <div
      className="relative"
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Hidden file picker for dropping/attaching JD text/markdown files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.markdown,text/plain,text/markdown"
        className="sr-only"
        onChange={(event) => {
          if (event.target.files) void attachFiles(event.target.files)
          event.target.value = ''
        }}
      />

      {/* Kokonut AI-01 Slash Command Menu — direction-aware so it never clips */}
      <AnimatePresence>
        {slashOpen && (
          <motion.div
            initial={{ opacity: 0, y: menuSide === 'bottom' ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.14, ease: EASE_OUT }}
            className={cn(
              'absolute inset-x-0 z-30 rounded-2xl border border-line bg-ink-soft p-1.5 shadow-[0_16px_40px_-12px_var(--shade)]',
              menuSide === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2',
            )}
          >
            <div
              id={menuId}
              role="listbox"
              aria-label={t.agent.input.commandsLabel}
              data-lenis-prevent
              className={cn(
                'overflow-y-auto overscroll-contain [scrollbar-color:var(--color-line)_transparent] [scrollbar-width:thin]',
                menuSide === 'bottom' ? 'max-h-[168px]' : 'max-h-56',
              )}
            >
              {filteredCommands.map((cmd, idx) => {
                const active = idx === activeSlash
                return (
                  <div
                    key={cmd.command}
                    id={`${menuId}-${cmd.command}`}
                    role="option"
                    aria-selected={active}
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerMove={() => setSlashIndex(idx)}
                    onClick={() => pickCommand(cmd)}
                    className={cn(
                      'flex h-8 cursor-pointer items-center gap-2.5 rounded-xl px-2.5 text-sm',
                      active && 'bg-ink text-bone',
                    )}
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center font-mono text-xs text-ember">
                      /
                    </span>
                    <span className="shrink-0 font-mono text-xs text-bone-dim">
                      <MatchedCommand
                        label={cmd.command.slice(1)}
                        query={slashQuery ?? ''}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-smoke">
                      {cmd.description[locale]}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-1 flex items-center gap-3 border-t border-line/70 px-2.5 pt-1.5 pb-0.5 font-mono text-[10px] text-smoke">
              <span>↑↓ {t.agent.input.kbdMove}</span>
              <span>↵ {t.agent.input.kbdPick}</span>
              <span>Esc {t.agent.input.kbdClose}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Composer Surface — owns the rounded focus ring cleanly */}
      <div
        className={cn(
          'rounded-2xl border bg-ink-soft transition-[border-color,box-shadow] duration-200',
          dragging
            ? 'border-ember ring-1 ring-ember/50'
            : 'border-line has-[textarea:focus]:border-ember/80 has-[textarea:focus]:ring-1 has-[textarea:focus]:ring-ember/35',
        )}
      >
        <AnimatePresence initial={false} mode="wait">
          {voiceActive ? (
            <VoiceRecorder
              key="voice"
              onCancel={() => setVoiceActive(false)}
              onComplete={(spoken) => {
                setVoiceActive(false)
                onSubmit(spoken)
              }}
            />
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              {/* Animated CommandPill + AttachmentChips strip */}
              <AnimatePresence initial={false}>
                {(selectedCmd || attachments.length > 0) && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className="flex flex-wrap items-center gap-2 overflow-hidden px-3.5 pt-3"
                    role="list"
                  >
                    {selectedCmd && (
                      <motion.li
                        layout="position"
                        initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, filter: 'blur(2px)' }}
                        transition={{ duration: 0.18, ease: EASE_OUT }}
                        className="flex h-8 items-center gap-1.5 rounded-full bg-ember/14 pr-1.5 pl-3 font-mono text-xs text-ember"
                      >
                        <span>{selectedCmd.command}</span>
                        <span className="text-bone-dim">
                          {selectedCmd.label[locale]}
                        </span>
                        <button
                          type="button"
                          aria-label={t.agent.input.removeCommand}
                          onClick={() => setSelectedCmd(null)}
                          className="flex size-5 items-center justify-center rounded-full text-ember transition-colors hover:bg-ember/15"
                        >
                          <IconClose className="size-3" />
                        </button>
                      </motion.li>
                    )}

                    {attachments.map((doc) => (
                      <motion.li
                        key={doc.id}
                        layout="position"
                        initial={{ opacity: 0, y: 4, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, filter: 'blur(2px)' }}
                        transition={{ duration: 0.18, ease: EASE_OUT }}
                        className="flex h-9 max-w-52 items-center gap-2 rounded-xl border border-line bg-ink py-1 pr-1.5 pl-2"
                      >
                        <IconFileText className="size-3.5 shrink-0 text-ember" />
                        <span className="min-w-0 flex-1 leading-tight">
                          <span className="block truncate text-xs text-bone">
                            {doc.name}
                          </span>
                          <span className="block font-mono text-[10px] text-smoke tabular-nums">
                            {formatBytes(doc.size)}
                          </span>
                        </span>
                        <button
                          type="button"
                          aria-label={`Remove ${doc.name}`}
                          onClick={() =>
                            setAttachments((prev) =>
                              prev.filter((item) => item.id !== doc.id),
                            )
                          }
                          className="flex size-5 shrink-0 items-center justify-center rounded-full text-smoke transition-colors hover:text-bone"
                        >
                          <IconClose className="size-3" />
                        </button>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>

              <label htmlFor="agent-prompt-input" className="sr-only">
                {t.agent.input.ariaLabel}
              </label>
              <textarea
                ref={textareaRef}
                id="agent-prompt-input"
                rows={1}
                value={value}
                onChange={(event) => {
                  setSlashDismissed(false)
                  setSlashIndex(0)
                  onChange(event.target.value)
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedCmd?.command === '/fit'
                    ? t.agent.input.fitPlaceholder
                    : t.agent.input.placeholder
                }
                className="block max-h-44 min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-[15px] leading-relaxed text-bone placeholder:text-smoke focus:outline-none focus-visible:outline-none"
              />

              {/* Clean minimalist Kokonut action toolbar */}
              <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
                <div className="flex items-center gap-1">
                  {/* Attach JD file */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={t.agent.input.attachFile}
                    title={t.agent.input.attachFile}
                    className="flex size-8 items-center justify-center rounded-full text-smoke transition-colors hover:bg-ink hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                  >
                    <IconPlus className="size-4" />
                  </button>

                  {/* Slash commands toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setSlashDismissed(false)
                      setSelectedCmd(null)
                      onChange(value.startsWith('/') ? '' : '/')
                      textareaRef.current?.focus()
                    }}
                    aria-label={t.agent.input.slashToggle}
                    title={t.agent.input.slashToggle}
                    className="flex size-8 items-center justify-center rounded-full text-smoke transition-colors hover:bg-ink hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                  >
                    <IconSlash className="size-3.5" />
                  </button>

                  {/* Kokonut AI-01 style compact Lens selector popover */}
                  <div ref={lensMenuRef} className="relative">
                    <button
                      type="button"
                      aria-expanded={lensOpen}
                      aria-label={t.agent.lenses.label}
                      onClick={() => setLensOpen((prev) => !prev)}
                      className={cn(
                        'flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs text-bone-dim transition-colors hover:bg-ink hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember',
                        lensOpen && 'bg-ink text-bone',
                      )}
                    >
                      <span className="relative inline-grid">
                        <AnimatePresence initial={false} mode="popLayout">
                          <motion.span
                            key={lens}
                            initial={{ opacity: 0, filter: 'blur(2px)' }}
                            animate={{ opacity: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, filter: 'blur(2px)' }}
                            transition={{ duration: 0.15, ease: EASE_OUT }}
                            className="col-start-1 row-start-1 whitespace-nowrap font-medium"
                          >
                            {t.agent.lenses[lens]}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <IconChevronDown
                        className={cn(
                          'size-3 text-smoke transition-transform duration-200',
                          lensOpen && 'rotate-180',
                        )}
                      />
                    </button>

                    <AnimatePresence>
                      {lensOpen && (
                        <motion.div
                          initial={{
                            opacity: 0,
                            scale: 0.96,
                            y: menuSide === 'bottom' ? -4 : 4,
                          }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{
                            opacity: 0,
                            scale: 0.96,
                            y: menuSide === 'bottom' ? -4 : 4,
                            transition: { duration: 0.1, ease: EASE_OUT },
                          }}
                          transition={{ duration: 0.15, ease: EASE_OUT }}
                          className={cn(
                            'absolute left-0 z-30 w-60 rounded-2xl border border-line bg-ink-soft p-1.5 shadow-[0_16px_40px_-12px_var(--shade)]',
                            menuSide === 'bottom'
                              ? 'top-full mt-2 origin-top-left'
                              : 'bottom-full mb-2 origin-bottom-left',
                          )}
                        >
                          <p className="px-2.5 pt-1 pb-1.5 font-mono text-[10px] text-smoke uppercase">
                            {t.agent.lenses.label}
                          </p>
                          {lensOptions.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                onLensChange(item.id)
                                setLensOpen(false)
                              }}
                              className={cn(
                                'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink',
                                lens === item.id && 'bg-ink',
                              )}
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs font-medium text-bone">
                                  {item.label}
                                </span>
                                <span className="block truncate text-[11px] text-smoke">
                                  {item.hint}
                                </span>
                              </span>
                              <IconCheck
                                className={cn(
                                  'size-3.5 shrink-0 text-ember',
                                  lens !== item.id && 'invisible',
                                )}
                              />
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Right controls: Kokonut AI-16 Context Ring + AI-05 Voice + AI-01 Send/Stop */}
                <div className="flex items-center gap-1">
                  <ContextMeter
                    projectCount={projectCount}
                    engagementCount={engagementCount}
                    techCount={techCount}
                    noteCount={noteCount}
                    postCount={postCount}
                    sectionCount={sectionCount}
                    turnCount={turnCount}
                    source={source}
                    runtimePreference={runtimePreference}
                    onRuntimePreferenceChange={onRuntimePreferenceChange}
                    edgeCapability={edgeCapability}
                    menuSide="top"
                  />

                  {voiceAvailable && !streaming && (
                    <button
                      type="button"
                      onClick={() => setVoiceActive(true)}
                      aria-label={t.agent.voice.start}
                      title={t.agent.voice.start}
                      className="flex size-8 items-center justify-center rounded-full text-smoke transition-colors hover:bg-ink hover:text-ember focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                    >
                      <IconMic className="size-4" />
                    </button>
                  )}

                  {/* Kokonut AI-01 two-face blur-morph Send / Stop circular button */}
                  <button
                    type="button"
                    aria-label={streaming ? t.agent.input.stop : t.agent.input.send}
                    disabled={!(streaming || canSend)}
                    onClick={streaming ? onStop : commitSend}
                    className={cn(
                      'relative size-8 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember',
                      streaming || canSend
                        ? 'bg-ember text-ink hover:bg-bone'
                        : 'bg-ink text-smoke/50',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        faceClass,
                        streaming ? 'opacity-0 blur-[2px]' : 'opacity-100 blur-0',
                      )}
                    >
                      <IconArrowUp className="size-4" strokeWidth={2} />
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        faceClass,
                        streaming ? 'opacity-100 blur-0' : 'opacity-0 blur-[2px]',
                      )}
                    >
                      <span className="size-2.5 rounded-[2px] bg-current" />
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
