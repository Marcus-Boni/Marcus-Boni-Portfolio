import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { AdminButton, Kbd, SectionLabel, TextInput, focusRing } from '@/admin/components/ui'
import { cn } from '@/lib/utils'

/**
 * Dialogs.
 *
 * `window.confirm` was doing this job. It blocks the whole tab, cannot say
 * *what* is about to be deleted in more than one line of plain text, and looks
 * like the browser rather than the product. `useConfirm()` returns a promise so
 * call sites keep reading top-to-bottom, and `requireText` exists for the one
 * action that overwrites published content.
 */

/* ─── Modal shell ───────────────────────────────────────────────────────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  /** Announced as an alert — used by destructive confirmations. */
  urgent = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  urgent?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Escape closes, Tab cycles inside the panel. A dialog you can tab out of is
  // a dialog screen-reader users are reading the page behind.
  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const preferred = panel?.querySelector<HTMLElement>('[data-autofocus]')
    if (preferred) preferred.focus()
    else panel?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = overflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/80 backdrop-blur-sm motion-safe:animate-[fade-in_160ms_ease-out]"
      />
      <div
        ref={panelRef}
        role={urgent ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative w-full border border-line bg-ink-soft shadow-[0_24px_80px_rgba(0,0,0,0.6)] motion-safe:animate-[panel-in_220ms_cubic-bezier(0.16,1,0.3,1)]',
          size === 'sm' && 'max-w-sm',
          size === 'md' && 'max-w-lg',
          size === 'lg' && 'max-w-3xl',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-tight text-bone">{title}</h2>
            {description && (
              <div className="mt-1.5 text-sm leading-relaxed text-bone-dim">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={cn(
              'shrink-0 font-mono text-xs text-smoke transition-colors hover:text-ember',
              focusRing,
            )}
          >
            ✕
          </button>
        </header>

        {children && <div className="px-5 py-5">{children}</div>}

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

/* ─── Confirmation ──────────────────────────────────────────────────────── */

export interface ConfirmRequest {
  title: string
  description?: ReactNode
  /** Defaults to "Confirmar". */
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'neutral'
  /** When set, the confirm button unlocks only once this word is typed. */
  requireText?: string
}

type Resolver = (confirmed: boolean) => void

const ConfirmContext = createContext<((request: ConfirmRequest) => Promise<boolean>) | null>(
  null,
)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [typed, setTyped] = useState('')
  const resolver = useRef<Resolver | null>(null)

  const confirm = useCallback((next: ConfirmRequest) => {
    setTyped('')
    setRequest(next)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const settle = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed)
    resolver.current = null
    setRequest(null)
    setTyped('')
  }, [])

  const value = useMemo(() => confirm, [confirm])
  const locked = Boolean(request?.requireText) && typed.trim() !== request?.requireText

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={request !== null}
        onClose={() => settle(false)}
        title={request?.title ?? ''}
        description={request?.description}
        size="sm"
        urgent={request?.tone !== 'neutral'}
        footer={
          <>
            <AdminButton variant="ghost" onClick={() => settle(false)}>
              {request?.cancelLabel ?? 'Cancelar'}
            </AdminButton>
            <AdminButton
              variant={request?.tone === 'neutral' ? 'solid' : 'danger'}
              disabled={locked}
              onClick={() => settle(true)}
              data-autofocus={request?.requireText ? undefined : ''}
            >
              {request?.confirmLabel ?? 'Confirmar'}
            </AdminButton>
          </>
        }
      >
        {request?.requireText ? (
          <div>
            <SectionLabel className="mb-2">
              Digite <span className="text-ember">{request.requireText}</span> para liberar
            </SectionLabel>
            <TextInput
              value={typed}
              data-autofocus=""
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !locked) settle(true)
              }}
            />
          </div>
        ) : (
          <p className="flex items-center gap-2 text-xs text-smoke">
            <Kbd>Esc</Kbd> cancela
          </p>
        )}
      </Modal>
    </ConfirmContext.Provider>
  )
}

/**
 * Ask for confirmation and await the answer.
 *
 * ```ts
 * if (!(await confirm({ title: 'Excluir?', tone: 'danger' }))) return
 * ```
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>')
  }
  return context
}
