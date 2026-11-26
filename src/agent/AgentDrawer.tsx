import { useLenis } from 'lenis/react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import { AgentConsole } from '@/agent/components/AgentConsole'
import { IconClose, IconExpand } from '@/agent/components/icons'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'

/**
 * Accessible `⌘K` dossier dialog mounted lazily over the portfolio home.
 * Single clean header (zero double bars), preserving session state when
 * expanded to `/ask` or `/en/ask`.
 */
export default function AgentDrawer({
  initialPrompt,
  onClose,
}: {
  initialPrompt?: string
  onClose: () => void
}) {
  const { locale, t } = useLanguage()
  const navigate = useNavigate()
  const lenis = useLenis()
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null
    trackEvent('agent_open', { surface: 'drawer' })

    const html = document.documentElement
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    lenis?.stop()
    html.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      html.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
      lenis?.start()
      returnFocusRef.current?.focus()
    }
  }, [onClose, lenis])

  const fullPagePath = locale === 'en' ? '/en/ask' : '/ask'

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[90] flex items-end justify-center overscroll-contain p-0 sm:items-center sm:p-5 md:p-8"
    >
      <button
        type="button"
        aria-label={t.header.close}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/80 backdrop-blur-sm motion-safe:animate-[fade-in_160ms_ease-out]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.agent.drawerHeading}
        data-lenis-prevent
        className="relative flex h-[92svh] w-full max-w-3xl flex-col overflow-hidden overscroll-contain rounded-t-2xl border border-line bg-ink shadow-[0_24px_80px_var(--shade)] sm:h-[min(86svh,760px)] sm:rounded-2xl motion-safe:animate-[panel-in_220ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line/70 px-5 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-display-italic text-xl leading-none text-bone">
              mb<span className="text-ember">.</span>
            </span>
            <span className="font-mono text-[10px] tracking-[0.24em] text-smoke uppercase">
              {t.agent.nav}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                lenis?.start()
                onClose()
                navigate(fullPagePath)
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line px-3 font-mono text-[10px] tracking-[0.12em] text-bone-dim uppercase transition-colors hover:border-ember hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
            >
              <IconExpand className="size-3" />
              <span>{t.agent.expandFull}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label={t.header.close}
              className="flex size-7 items-center justify-center rounded-full border border-line text-smoke transition-colors hover:border-ember hover:text-bone focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember"
            >
              <IconClose className="size-3.5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <AgentConsole
            variant="drawer"
            initialPrompt={initialPrompt}
            onCloseDrawer={onClose}
          />
        </div>
      </div>
    </div>
  )
}
