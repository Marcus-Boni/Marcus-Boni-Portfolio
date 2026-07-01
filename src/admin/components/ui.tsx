import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

/* ─── Surfaces ──────────────────────────────────────────────────────────── */

export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'border border-line bg-ink-soft/60 p-5 md:p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-4xl leading-none text-bone md:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-xl text-sm text-bone-dim">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
      {children}
    </p>
  )
}

/* ─── Stat tile ─────────────────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: boolean
}) {
  return (
    <Card className="flex flex-col justify-between">
      <p className="font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-4 font-display text-4xl leading-none md:text-5xl',
          accent ? 'text-ember' : 'text-bone',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-bone-dim">{hint}</p>}
    </Card>
  )
}

/* ─── Buttons ───────────────────────────────────────────────────────────── */

type Variant = 'solid' | 'outline' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  solid: 'bg-ember text-ink hover:bg-bone',
  outline: 'border border-bone/30 text-bone hover:border-ember hover:text-ember',
  ghost: 'text-bone-dim hover:text-ember',
  danger:
    'border border-ember-deep/60 text-ember hover:bg-ember-deep hover:text-bone',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function AdminButton({
  className,
  variant = 'outline',
  ...props
}: BtnProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 px-4 font-mono text-[11px] tracking-[0.18em] uppercase transition-colors duration-300 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

/* ─── Form fields ───────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-smoke">{hint}</span>}
    </label>
  )
}

const fieldBase =
  'w-full border border-line bg-ink px-3 py-2.5 text-sm text-bone placeholder:text-smoke transition-colors focus:border-ember focus:outline-none'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldBase, props.className)} />
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(fieldBase, 'min-h-24 resize-y leading-relaxed', props.className)}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(fieldBase, 'appearance-none', props.className)}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <span
        className={cn(
          'relative h-6 w-11 border transition-colors duration-300',
          checked ? 'border-ember bg-ember/20' : 'border-line bg-ink',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 size-4 -translate-y-1/2 transition-all duration-300',
            checked ? 'left-[calc(100%-1.25rem)] bg-ember' : 'left-1 bg-smoke',
          )}
        />
      </span>
      <span className="font-mono text-[11px] tracking-[0.15em] text-bone-dim uppercase">
        {label}
      </span>
    </button>
  )
}

/* ─── Misc ──────────────────────────────────────────────────────────────── */

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'ember' | 'muted'
}) {
  const tones = {
    neutral: 'border-line text-bone-dim',
    ember: 'border-ember/50 text-ember',
    muted: 'border-line text-smoke',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] uppercase',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-line px-6 py-16 text-center">
      <p className="font-display text-2xl text-bone-dim">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-smoke">{description}</p>
      )}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-smoke">
      <span className="size-4 animate-spin rounded-full border border-line border-t-ember" />
      {label && (
        <span className="font-mono text-[11px] tracking-[0.2em] uppercase">
          {label}
        </span>
      )}
    </div>
  )
}

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warn' | 'error' | 'success'
  children: ReactNode
}) {
  const tones = {
    info: 'border-line bg-ink-soft text-bone-dim',
    warn: 'border-ember/40 bg-ember/5 text-bone',
    error: 'border-ember-deep/60 bg-ember-deep/10 text-bone',
    success: 'border-ember/40 bg-ember/5 text-bone',
  }
  return (
    <div
      className={cn(
        'border px-4 py-3 text-sm',
        tones[tone],
      )}
    >
      {children}
    </div>
  )
}
