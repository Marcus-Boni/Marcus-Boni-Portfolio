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

import { focusRing } from '@/admin/components/ui'
import { cn } from '@/lib/utils'

/**
 * Toasts.
 *
 * Every write in the admin used to report itself differently: an inline word in
 * the save bar, a banner that pushed the page down, or nothing at all. One
 * transient surface, bottom-right, keeps confirmations out of the layout and
 * gives destructive actions somewhere to hang an **undo** — which is what makes
 * a delete safe to press without a modal in the way.
 */

type ToastTone = 'success' | 'error' | 'info'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastInput {
  message: string
  tone?: ToastTone
  /** Milliseconds on screen. `0` pins it until dismissed. */
  duration?: number
  action?: ToastAction
}

interface Toast extends Required<Omit<ToastInput, 'action'>> {
  id: number
  action?: ToastAction
}

interface ToastValue {
  push: (input: ToastInput) => void
  success: (message: string, extra?: Omit<ToastInput, 'message' | 'tone'>) => void
  error: (message: string, extra?: Omit<ToastInput, 'message' | 'tone'>) => void
  info: (message: string, extra?: Omit<ToastInput, 'message' | 'tone'>) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback((input: ToastInput) => {
    const id = nextId.current++
    setToasts((current) => [
      // Three is the ceiling: a stack taller than that covers the save bar it
      // is reporting on.
      ...current.slice(-2),
      {
        id,
        message: input.message,
        tone: input.tone ?? 'info',
        duration: input.duration ?? (input.action ? 7000 : 4000),
        action: input.action,
      },
    ])
  }, [])

  const value = useMemo<ToastValue>(
    () => ({
      push,
      dismiss,
      success: (message, extra) => push({ ...extra, message, tone: 'success' }),
      error: (message, extra) => push({ ...extra, message, tone: 'error' }),
      info: (message, extra) => push({ ...extra, message, tone: 'info' }),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] flex flex-col items-stretch gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
      >
        {toasts.map((toast) => (
          <ToastRow key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastRow({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: number) => void
}) {
  useEffect(() => {
    if (toast.duration === 0) return
    const id = window.setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => window.clearTimeout(id)
  }, [toast, onDismiss])

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 border bg-ink-soft/95 px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur',
        'motion-safe:animate-[toast-in_220ms_cubic-bezier(0.16,1,0.3,1)]',
        toast.tone === 'success' && 'border-ember/50',
        toast.tone === 'error' && 'border-ember-deep/70',
        toast.tone === 'info' && 'border-line',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-1 size-1.5 shrink-0 rounded-full',
          toast.tone === 'success' && 'bg-ember',
          toast.tone === 'error' && 'bg-ember-deep',
          toast.tone === 'info' && 'bg-bone-dim',
        )}
      />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-bone">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick()
            onDismiss(toast.id)
          }}
          className={cn(
            'shrink-0 font-mono text-[10px] tracking-[0.16em] text-ember uppercase hover:underline',
            focusRing,
          )}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fechar"
        className={cn(
          'shrink-0 font-mono text-xs text-smoke transition-colors hover:text-bone',
          focusRing,
        )}
      >
        ✕
      </button>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return context
}
