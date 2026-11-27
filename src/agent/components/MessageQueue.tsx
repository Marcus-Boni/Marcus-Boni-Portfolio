import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

import { IconArrowUp, IconChevronDown, IconClose, IconQueue } from './icons'

export interface QueuedPrompt {
  id: string
  text: string
}

const EASE_OUT = [0.23, 1, 0.32, 1] as const

/**
 * Kokonut UI `AI-24` (Message Queue) ported to Signal & Ink.
 *
 * Docks quietly above the composer whenever the visitor queues follow-up
 * prompts while a response is still streaming. Each queued item can be promoted
 * to run immediately ("Send now") or removed without disturbing the active turn.
 */
export function MessageQueue({
  items,
  onSendNow,
  onRemove,
  onClear,
}: {
  items: readonly QueuedPrompt[]
  onSendNow: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
}) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState(true)

  return (
    <AnimatePresence initial={false}>
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0, y: 4 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: 4 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="mb-2 overflow-hidden"
        >
          <div className="rounded-2xl border border-line bg-ink-soft/80 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.12em] text-bone-dim uppercase transition-colors hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
              >
                <IconQueue className="size-3.5 text-ember" />
                <span className="tabular-nums">{t.agent.queue.heading(items.length)}</span>
                <IconChevronDown
                  className={cn(
                    'size-3 text-smoke transition-transform duration-150',
                    expanded && 'rotate-180',
                  )}
                />
              </button>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={onClear}
                  className="font-mono text-[10px] text-smoke transition-colors hover:text-ember focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                >
                  {t.agent.queue.clearAll}
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.16, ease: EASE_OUT }}
                  className="mt-1.5 space-y-1 overflow-hidden"
                  role="list"
                >
                  {items.map((item, idx) => (
                    <motion.li
                      key={item.id}
                      layout="position"
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15, ease: EASE_OUT }}
                      className="flex items-center gap-2 rounded-xl bg-ink/80 px-2.5 py-1.5"
                    >
                      <span className="shrink-0 font-mono text-[10px] text-smoke tabular-nums">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-bone">
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSendNow(item.id)}
                        title={t.agent.queue.sendNow}
                        aria-label={`${t.agent.queue.sendNow}: ${item.text}`}
                        className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-line px-2 font-mono text-[10px] text-bone-dim transition-colors hover:border-ember hover:text-ember focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                      >
                        <IconArrowUp className="size-2.5" />
                        <span className="hidden sm:inline">{t.agent.queue.sendNow}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id)}
                        title={t.agent.queue.remove}
                        aria-label={`${t.agent.queue.remove}: ${item.text}`}
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-smoke transition-colors hover:bg-ink-soft hover:text-ember focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
                      >
                        <IconClose className="size-3" />
                      </button>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
