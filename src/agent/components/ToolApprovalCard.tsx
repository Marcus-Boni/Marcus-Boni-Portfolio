import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import type { ApprovalAction } from '@/agent/types'
import { useSiteContent } from '@/content/SiteContentContext'
import { cvFiles } from '@/data/profile'
import { useLanguage } from '@/i18n/LanguageContext'
import { getAnalyticsContext, trackEvent } from '@/lib/analytics'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { cn } from '@/lib/utils'

import { IconCheck, IconDownload, IconMail, IconSend } from './icons'

/**
 * Full Kokonut UI `AI-10` (AI Send) + `AI-06` (Tool Approval) ported to Signal & Ink.
 *
 * - Editable in-place draft inside a ResizeObserver `AutoHeight` shell.
 * - Clicking Send starts a 3-second draining SVG ring countdown with a sliding
 *   Undo button before committing to the real Firestore inbox (`submitMessage`).
 * - Once delivered, the entire card smoothly morphs into a compact 1-line
 *   sent receipt with a spring check badge.
 */

type SendStatus = 'draft' | 'pending' | 'sending' | 'sent'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const
const UNDO_SECONDS = 3
const RING_CIRCUMFERENCE = 2 * Math.PI * 8

function AutoHeight({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const innerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')

  useEffect(() => {
    const inner = innerRef.current
    if (!inner || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setHeight(inner.offsetHeight))
    observer.observe(inner)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={{ duration: 0.3, ease: EASE_DRAWER }}
      className={cn('overflow-hidden', className)}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  )
}

export function ToolApprovalCard({
  approval,
  onUpdate,
}: {
  approval: ApprovalAction
  onUpdate: (next: ApprovalAction) => void
}) {
  const { locale, t } = useLanguage()
  const { content } = useSiteContent()
  const bodyId = useId()
  const nameId = useId()
  const emailId = useId()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(approval.draft?.message ?? '')
  const [status, setStatus] = useState<SendStatus>(
    approval.status === 'approved' ? 'sent' : 'draft',
  )
  const [left, setLeft] = useState(UNDO_SECONDS)
  const [error, setError] = useState<string | null>(null)
  const sendBtnRef = useRef<HTMLButtonElement>(null)
  const latestPayloadRef = useRef({ name, email, message })
  const onUpdateRef = useRef(onUpdate)

  useEffect(() => {
    latestPayloadRef.current = { name, email, message }
    onUpdateRef.current = onUpdate
  }, [name, email, message, onUpdate])

  // Countdown tick → commits real Firestore submission when timer hits 0
  useEffect(() => {
    if (status !== 'pending') return
    if (left > 0) {
      const timer = window.setTimeout(() => setLeft((n) => n - 1), 1000)
      return () => window.clearTimeout(timer)
    }

    let cancelled = false
    const commit = async () => {
      setStatus('sending')
      const { name: cleanName, email: cleanEmail, message: cleanMessage } =
        latestPayloadRef.current

      if (!isFirebaseConfigured) {
        const subject = encodeURIComponent(
          approval.draft?.subject ?? 'Portfolio Dossier Handoff',
        )
        const body = encodeURIComponent(
          `${cleanName.trim()} (${cleanEmail.trim()})\n\n${cleanMessage.trim()}`,
        )
        window.location.href = `mailto:${content.profile.email}?subject=${subject}&body=${body}`
        trackEvent('agent_handoff', { channel: 'mailto' })
        if (!cancelled) {
          setStatus('sent')
          onUpdateRef.current({
            ...approval,
            status: 'approved',
            statusNote: t.agent.approval.openedMailto,
          })
        }
        return
      }

      try {
        const ctx = getAnalyticsContext()
        const { submitMessage } = await import('@/lib/messages')
        const ok = await submitMessage({
          name: cleanName.trim(),
          email: cleanEmail.trim(),
          message: `[Dossier Handoff${approval.draft?.subject ? ` · ${approval.draft.subject}` : ''}]\n\n${cleanMessage.trim()}`,
          locale,
          referrerHost: ctx.referrerHost,
          country: ctx.country,
        })
        if (!ok) {
          if (!cancelled) {
            setError(t.agent.approval.offlineFallback)
            setStatus('draft')
          }
          return
        }
        trackEvent('contact_submit', { source: 'agent' })
        trackEvent('agent_handoff', { channel: 'firestore' })
        if (!cancelled) {
          setStatus('sent')
          onUpdateRef.current({
            ...approval,
            status: 'approved',
            statusNote: t.agent.approval.sentSuccess,
          })
        }
      } catch {
        if (!cancelled) {
          setError(t.agent.approval.sendError)
          setStatus('draft')
        }
      }
    }

    void commit()
    return () => {
      cancelled = true
    }
  }, [status, left, approval, content.profile.email, locale, t.agent.approval])

  if (approval.status === 'dismissed') {
    return (
      <p className="mt-3 font-mono text-[11px] text-smoke">
        {t.agent.approval.dismissed}
      </p>
    )
  }

  if (approval.kind === 'download_cv') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5, filter: 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.28, ease: EASE_OUT }}
        className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-ink-soft/70 px-4 py-3.5"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-bone">{approval.title}</p>
          <p className="mt-0.5 text-xs text-smoke">{approval.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['pt', 'en'] as const).map((lang) => (
            <a
              key={lang}
              href={cvFiles[lang]}
              download
              onClick={() => {
                trackEvent('cv_download', { locale: lang, source: 'agent' })
                onUpdate({ ...approval, status: 'approved' })
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-ink px-3.5 font-mono text-[11px] text-bone transition-colors hover:border-ember hover:bg-ember hover:text-ink"
            >
              <IconDownload className="size-3.5" />
              <span>
                {lang === 'pt'
                  ? t.agent.approval.downloadPt
                  : t.agent.approval.downloadEn}
              </span>
            </a>
          ))}
        </div>
      </motion.div>
    )
  }

  const canStartSend =
    name.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    message.trim().length > 0

  const startSend = () => {
    if (!canStartSend) {
      setError(t.agent.approval.fillRequired)
      return
    }
    setError(null)
    setLeft(UNDO_SECONDS)
    setStatus('pending')
  }

  const undo = () => {
    setStatus('draft')
    window.requestAnimationFrame(() => sendBtnRef.current?.focus())
  }

  const subject = approval.draft?.subject ?? t.agent.approval.defaultSubject

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      className="mt-4"
      data-state={status}
    >
      <AutoHeight className="rounded-2xl border border-line bg-ink-soft/75">
        <AnimatePresence initial={false} mode="popLayout">
          {status === 'sent' ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, filter: 'blur(3px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.28, ease: EASE_OUT, delay: 0.06 }}
              className="flex items-center gap-3 px-4 py-3"
            >
              <motion.span
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 26,
                  delay: 0.08,
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ember text-ink"
              >
                <IconCheck className="size-3.5" strokeWidth={2.2} />
              </motion.span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-bone">
                  <span className="font-medium">
                    {t.agent.approval.sentReceipt(content.profile.name)}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-smoke">{subject}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="draft"
              exit={{ opacity: 0, filter: 'blur(3px)' }}
              transition={{ duration: 0.2 }}
            >
              <dl className="divide-y divide-line/70 px-4 text-[13px]">
                <div className="flex min-h-10 items-center gap-3 py-1.5">
                  <dt className="w-16 shrink-0 font-mono text-[11px] text-smoke">
                    {t.agent.approval.toLabel}
                  </dt>
                  <dd className="min-w-0 truncate">
                    <span className="text-bone">{content.profile.name}</span>{' '}
                    <span className="font-mono text-xs text-smoke">
                      {content.profile.email}
                    </span>
                  </dd>
                </div>

                <div className="flex min-h-10 items-center gap-3 py-1.5">
                  <dt className="w-16 shrink-0 font-mono text-[11px] text-smoke">
                    {t.agent.approval.subjectLabel}
                  </dt>
                  <dd className="min-w-0 truncate text-bone">{subject}</dd>
                </div>

                <div className="grid gap-2 py-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={nameId}
                      className="w-16 shrink-0 font-mono text-[11px] text-smoke"
                    >
                      {t.contact.form.name}
                    </label>
                    <input
                      id={nameId}
                      type="text"
                      value={name}
                      readOnly={status !== 'draft'}
                      onChange={(event) => {
                        setError(null)
                        setName(event.target.value)
                      }}
                      placeholder={t.agent.approval.namePlaceholder}
                      className="min-w-0 flex-1 border-b border-smoke/60 bg-transparent pb-0.5 text-[13px] text-bone placeholder:text-smoke focus:border-ember focus:outline-none focus-visible:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={emailId}
                      className="w-16 shrink-0 font-mono text-[11px] text-smoke sm:w-auto"
                    >
                      {t.contact.form.email}
                    </label>
                    <input
                      id={emailId}
                      type="email"
                      value={email}
                      readOnly={status !== 'draft'}
                      onChange={(event) => {
                        setError(null)
                        setEmail(event.target.value)
                      }}
                      placeholder={t.agent.approval.emailPlaceholder}
                      className="min-w-0 flex-1 border-b border-smoke/60 bg-transparent pb-0.5 text-[13px] text-bone placeholder:text-smoke focus:border-ember focus:outline-none focus-visible:outline-none"
                    />
                  </div>
                </div>
              </dl>

              <label htmlFor={bodyId} className="sr-only">
                {t.contact.form.message}
              </label>
              <textarea
                id={bodyId}
                rows={4}
                readOnly={status !== 'draft'}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className={cn(
                  'block w-full resize-none border-t border-line/70 bg-transparent px-4 pt-3 pb-3.5 text-sm leading-6 text-bone-dim transition-opacity duration-200 focus:text-bone focus:outline-none focus-visible:outline-none',
                  status !== 'draft' && 'opacity-50',
                )}
              />

              {error && status === 'draft' && (
                <p role="alert" className="px-4 pb-2.5 text-xs text-ember">
                  {error}
                </p>
              )}

              <div className="flex items-center gap-2 border-t border-line/70 px-3 py-2.5">
                <span className="flex min-w-0 items-center gap-1.5 pl-1 font-mono text-[11px] text-smoke">
                  <IconMail className="size-3.5 shrink-0" />
                  <span className="truncate">{t.agent.approval.inboxTag}</span>
                </span>

                <div className="ml-auto flex items-center gap-1.5">
                  <AnimatePresence initial={false}>
                    {status === 'pending' && (
                      <motion.button
                        key="undo"
                        type="button"
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 6 }}
                        transition={{ duration: 0.18, ease: EASE_OUT }}
                        onClick={undo}
                        className="h-8 rounded-full px-3 text-xs font-medium text-bone transition-colors hover:bg-ink"
                      >
                        {t.agent.approval.undo}
                      </motion.button>
                    )}
                  </AnimatePresence>

                  {status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => onUpdate({ ...approval, status: 'dismissed' })}
                      className="h-8 rounded-full px-3 text-xs text-smoke transition-colors hover:text-bone"
                    >
                      {t.agent.approval.cancel}
                    </button>
                  )}

                  <button
                    ref={sendBtnRef}
                    type="button"
                    disabled={status !== 'draft'}
                    onClick={startSend}
                    className={cn(
                      'group/send flex h-8 min-w-[92px] items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember',
                      status !== 'draft'
                        ? 'border border-line bg-ink text-bone-dim'
                        : canStartSend
                          ? 'bg-ember text-ink hover:bg-bone'
                          : 'border border-line bg-ink text-bone-dim hover:border-ember hover:text-bone',
                    )}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {status === 'pending' || status === 'sending' ? (
                        <motion.span
                          key="pending"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-2"
                        >
                          <span className="relative flex size-5 items-center justify-center">
                            <svg
                              aria-hidden="true"
                              className="absolute inset-0 -rotate-90"
                              viewBox="0 0 20 20"
                            >
                              <circle
                                className="stroke-line"
                                cx="10"
                                cy="10"
                                fill="none"
                                r="8"
                                strokeWidth="1.75"
                              />
                              <motion.circle
                                initial={{ strokeDashoffset: 0 }}
                                animate={{ strokeDashoffset: RING_CIRCUMFERENCE }}
                                transition={{ duration: UNDO_SECONDS, ease: 'linear' }}
                                className="stroke-ember"
                                cx="10"
                                cy="10"
                                fill="none"
                                r="8"
                                strokeDasharray={RING_CIRCUMFERENCE}
                                strokeLinecap="round"
                                strokeWidth="1.75"
                              />
                            </svg>
                            <span className="relative overflow-hidden font-mono text-[10px] tabular-nums text-bone">
                              <AnimatePresence initial={false} mode="popLayout">
                                <motion.span
                                  key={left}
                                  initial={{ y: 5, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  exit={{ y: -5, opacity: 0 }}
                                  transition={{ duration: 0.18, ease: EASE_OUT }}
                                  className="block"
                                >
                                  {left > 0 ? left : ''}
                                </motion.span>
                              </AnimatePresence>
                            </span>
                          </span>
                          <span>{t.contact.form.sending}</span>
                        </motion.span>
                      ) : (
                        <motion.span
                          key="send"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="flex items-center gap-1.5"
                        >
                          <span>{t.agent.approval.confirmSend}</span>
                          <IconSend className="size-3 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/send:translate-x-0.5 motion-reduce:transition-none" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AutoHeight>

      <p aria-live="polite" className="sr-only">
        {status === 'pending' ? `${t.contact.form.sending} (${left}s)` : ''}
        {status === 'sent' ? t.agent.approval.sentSuccess : ''}
      </p>
    </motion.div>
  )
}
