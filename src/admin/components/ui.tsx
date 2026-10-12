import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

import { cn } from '@/lib/utils'

/**
 * The admin's primitive layer.
 *
 * One rule holds the whole file together: everything focusable carries a
 * visible focus ring. The look is 1px hairlines and square corners, so the ring
 * is an offset outline rather than a glow — it reads at a glance without
 * softening the geometry.
 */

/** Shared focus treatment. Applied to every interactive primitive here. */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember'

/* ─── Surfaces ──────────────────────────────────────────────────────────── */

export function Card({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('border border-line bg-ink-soft/60 p-5 md:p-6', className)}>
      {children}
    </div>
  )
}

/**
 * Page title block.
 *
 * It also owns `document.title`, because the alternative is remembering to set
 * it on ten pages and forgetting on the eleventh. A tab that reads "Mensagens ·
 * admin" is the difference between finding the admin among twenty tabs and
 * hunting for it.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
  documentTitle,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  /** Compact status line under the title — counts, timestamps, badges. */
  meta?: ReactNode
  /** Overrides the tab title when the on-screen one is too terse. */
  documentTitle?: string
}) {
  useEffect(() => {
    const previous = document.title
    document.title = `${documentTitle ?? title} · admin — Marcus Boni`
    return () => {
      document.title = previous
    }
  }, [title, documentTitle])

  return (
    <header className="mb-8 flex flex-col gap-4 border-b border-line pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="font-display text-4xl leading-none text-bone md:text-5xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bone-dim">
            {subtitle}
          </p>
        )}
        {meta && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {meta}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {actions}
        </div>
      )}
    </header>
  )
}

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={cn(
        'font-mono text-[10px] tracking-[0.25em] text-smoke uppercase',
        className,
      )}
    >
      {children}
    </p>
  )
}

/** Label + optional action: the header every editable block starts with. */
export function SectionHeader({
  label,
  hint,
  action,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('mb-5 flex flex-wrap items-start justify-between gap-3', className)}
    >
      <div className="min-w-0">
        <SectionLabel>{label}</SectionLabel>
        {hint && <p className="mt-1.5 max-w-lg text-xs text-smoke">{hint}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
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
      <SectionLabel>{label}</SectionLabel>
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

type Variant = 'solid' | 'outline' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  solid: 'bg-ember text-ink hover:bg-bone',
  outline: 'border border-bone/30 text-bone hover:border-ember hover:text-ember',
  ghost: 'text-bone-dim hover:bg-ink-soft hover:text-ember',
  subtle:
    'border border-line bg-ink-soft/60 text-bone-dim hover:border-bone/40 hover:text-bone',
  danger:
    'border border-ember-deep/60 text-ember hover:bg-ember-deep hover:text-bone',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-[10px]',
  md: 'h-10 gap-2 px-4 text-[11px]',
  lg: 'h-12 gap-2 px-5 text-[11px]',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Shows a spinner and blocks the click. */
  loading?: boolean
  /** Marks this control as the one `<Modal>` focuses when it opens. */
  'data-autofocus'?: string
}

export function AdminButton({
  className,
  variant = 'outline',
  size = 'md',
  loading = false,
  disabled,
  children,
  type = 'button',
  ...props
}: BtnProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center font-mono tracking-[0.18em] uppercase transition-colors duration-200 disabled:pointer-events-none disabled:opacity-40',
        focusRing,
        sizes[size],
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="size-3 shrink-0 animate-spin rounded-full border border-current/30 border-t-current"
        />
      )}
      {children}
    </button>
  )
}

/** Square icon button — row actions and toolbars, anything without a label. */
export function IconButton({
  label,
  className,
  variant = 'ghost',
  size = 'md',
  ...props
}: Omit<BtnProps, 'aria-label'> & { label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-mono text-xs transition-colors duration-200 disabled:pointer-events-none disabled:opacity-30',
        focusRing,
        size === 'sm' ? 'size-7' : 'size-9',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

/** Anchor styled as a button — for real navigation, not a click handler. */
export function ButtonLink({
  href,
  children,
  variant = 'outline',
  size = 'md',
  external = false,
  className,
  title,
}: {
  href: string
  children: ReactNode
  variant?: Variant
  size?: Size
  external?: boolean
  className?: string
  title?: string
}) {
  return (
    <a
      href={href}
      title={title}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : null)}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-mono tracking-[0.18em] uppercase transition-colors duration-200',
        focusRing,
        sizes[size],
        variants[variant],
        className,
      )}
    >
      {children}
    </a>
  )
}

/* ─── Segmented control ─────────────────────────────────────────────────── */

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  /** Rendered dimmer next to the label — counts, mostly. */
  count?: number
  title?: string
}

/**
 * The one filter-row control.
 *
 * Four pages had grown their own copy of this button strip with slightly
 * different padding and no `aria-pressed`. One component keeps every filter row
 * identical and keyboard-reachable.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: {
  value: T
  onChange: (next: T) => void
  options: SegmentOption<T>[]
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            title={option.title}
            className={cn(
              'border font-mono text-[10px] tracking-[0.16em] uppercase transition-colors duration-200',
              focusRing,
              size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5',
              active
                ? 'border-ember bg-ember/10 text-ember'
                : 'border-line text-smoke hover:border-bone/40 hover:text-bone-dim',
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span className="ml-1.5 tabular-nums opacity-70">{option.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ─── Form fields ───────────────────────────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  required,
  counter,
  children,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  /** Replaces the hint, in ember — validation belongs next to its input. */
  error?: string | null
  required?: boolean
  /** `[current, max]`, rendered right-aligned on the label line. */
  counter?: [number, number]
  children: ReactNode
  className?: string
}) {
  const over = counter ? counter[0] > counter[1] : false

  return (
    <label className={cn('block', className)}>
      <span className="mb-2 flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
          {label}
          {required && <span className="ml-1 text-ember">*</span>}
        </span>
        {counter && (
          <span
            className={cn(
              'font-mono text-[10px] tabular-nums',
              over ? 'text-ember' : 'text-smoke/70',
            )}
          >
            {counter[0]}/{counter[1]}
          </span>
        )}
      </span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-xs text-ember">{error}</span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-smoke">{hint}</span>
      )}
    </label>
  )
}

const fieldBase =
  'w-full border bg-ink px-3 py-2.5 text-sm text-bone transition-colors placeholder:text-smoke/70 focus:outline-none disabled:opacity-50'
const fieldIdle = 'border-line focus:border-ember'
const fieldInvalid = 'border-ember-deep/70 focus:border-ember'

export function TextInput({
  invalid,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(fieldBase, invalid ? fieldInvalid : fieldIdle, className)}
    />
  )
}

export function TextArea({
  invalid,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        fieldBase,
        invalid ? fieldInvalid : fieldIdle,
        'min-h-24 resize-y leading-relaxed',
        className,
      )}
    />
  )
}

/**
 * `className` lands on the wrapper, not the `<select>`: the wrapper is what a
 * flex or grid parent lays out, so `w-36` / `ml-auto` from a call site have to
 * apply there or they silently do nothing.
 */
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={cn('relative block', className)}>
      <select {...props} className={cn(fieldBase, fieldIdle, 'appearance-none pr-9')} />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-smoke"
      >
        ▾
      </span>
    </span>
  )
}

/** Search box with a clear affordance — used by every list in the admin. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-smoke"
      >
        ⌕
      </span>
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Escape clears the field before it reaches any dialog above.
          if (event.key === 'Escape' && value) {
            event.stopPropagation()
            onChange('')
          }
        }}
        placeholder={placeholder}
        className={cn(
          fieldBase,
          fieldIdle,
          'py-2 pl-9',
          value ? 'pr-9' : 'pr-3',
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className={cn(
            'absolute top-1/2 right-2 -translate-y-1/2 px-1 font-mono text-xs text-smoke transition-colors hover:text-ember',
            focusRing,
          )}
        >
          ✕
        </button>
      )}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('flex items-center gap-3 text-left disabled:opacity-40', focusRing)}
    >
      <span
        className={cn(
          'relative h-6 w-11 shrink-0 border transition-colors duration-300',
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
      <span className="min-w-0">
        <span className="block font-mono text-[11px] tracking-[0.15em] text-bone-dim uppercase">
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-smoke">{hint}</span>}
      </span>
    </button>
  )
}

/* ─── Misc ──────────────────────────────────────────────────────────────── */

type Tone = 'neutral' | 'ember' | 'muted' | 'success' | 'warn'

export function Badge({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  title?: string
}) {
  const tones: Record<Tone, string> = {
    neutral: 'border-line text-bone-dim',
    ember: 'border-ember/50 text-ember',
    muted: 'border-line text-smoke',
    success: 'border-ember/40 bg-ember/5 text-ember',
    warn: 'border-ember-deep/60 text-ember',
  }
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 border px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] uppercase',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Count pill for nav items and tabs. Renders nothing at zero. */
export function CountBadge({
  count,
  tone = 'ember',
}: {
  count: number
  tone?: 'ember' | 'muted'
}) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center px-1.5 py-0.5 font-mono text-[9px] tabular-nums',
        tone === 'ember' ? 'bg-ember text-ink' : 'bg-line text-bone-dim',
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center border border-dashed border-line px-6 py-16 text-center">
      <p className="font-display text-2xl text-bone-dim">{title}</p>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-smoke">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-smoke">
      <span className="size-4 animate-spin rounded-full border border-line border-t-ember" />
      {label && (
        <span className="font-mono text-[11px] tracking-[0.2em] uppercase">{label}</span>
      )}
    </div>
  )
}

/**
 * Skeleton block.
 *
 * Preferred over a spinner wherever the final shape is known: the page stops
 * jumping when the data lands, and the wait reads as "almost there" instead of
 * "something is happening somewhere".
 */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse bg-line/60', className)} />
}

export function SkeletonRows({
  rows = 3,
  height = 'h-16',
  className,
}: {
  rows?: number
  height?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className={height} />
      ))}
    </div>
  )
}

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
}: {
  tone?: 'info' | 'warn' | 'error' | 'success'
  title?: string
  children?: ReactNode
  action?: ReactNode
  onDismiss?: () => void
}) {
  const tones = {
    info: 'border-line bg-ink-soft text-bone-dim',
    warn: 'border-ember/40 bg-ember/5 text-bone',
    error: 'border-ember-deep/60 bg-ember-deep/10 text-bone',
    success: 'border-ember/40 bg-ember/5 text-bone',
  }
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-4 border px-4 py-3 text-sm', tones[tone])}
    >
      <div className="min-w-0 flex-1">
        {title && (
          <p className="mb-1 font-mono text-[11px] tracking-[0.16em] uppercase">{title}</p>
        )}
        {children}
      </div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className={cn(
            'shrink-0 px-1 font-mono text-xs text-smoke transition-colors hover:text-ember',
            focusRing,
          )}
        >
          ✕
        </button>
      )}
    </div>
  )
}

/** Determinate progress bar — uploads and imports. */
export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="w-full">
      {label && (
        <p className="mb-1.5 font-mono text-[10px] tracking-[0.16em] text-smoke uppercase">
          {label}
        </p>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 w-full bg-line"
      >
        <div
          className="h-full bg-ember transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Keyboard key, for shortcut hints. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center border border-line bg-ink px-1.5 font-mono text-[10px] text-bone-dim">
      {children}
    </kbd>
  )
}

/**
 * Copy-to-clipboard button. Confirms in place for a beat, because a copy with
 * no feedback gets pressed three times.
 */
export function CopyButton({
  value,
  label = 'Copiar',
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(id)
  }, [copied])

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => setCopied(true))
      }}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors',
        copied ? 'text-ember' : 'text-smoke hover:text-ember',
        focusRing,
        className,
      )}
    >
      {copied ? 'copiado ✓' : label}
    </button>
  )
}

/** Live status dot — connection state, autosave, "ao vivo". */
export function StatusDot({
  tone,
  pulse = false,
}: {
  tone: 'live' | 'idle' | 'off'
  pulse?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-1.5 shrink-0 rounded-full',
        tone === 'live' && 'bg-ember',
        tone === 'idle' && 'bg-bone-dim',
        tone === 'off' && 'bg-line',
        pulse && 'animate-pulse',
      )}
    />
  )
}

/**
 * Collapsible block with a summary row.
 *
 * The editors used to render every entry fully expanded, which turned eight
 * projects into a page nobody could scan. Collapsed rows give the list back its
 * shape; the summary carries enough to pick the right one.
 */
export function Collapsible({
  open,
  onToggle,
  summary,
  aside,
  children,
  className,
  tone = 'default',
}: {
  open: boolean
  onToggle: () => void
  summary: ReactNode
  /** Rendered outside the toggle button — action buttons live here. */
  aside?: ReactNode
  children: ReactNode
  className?: string
  tone?: 'default' | 'attention'
}) {
  const id = useId()
  return (
    <div
      className={cn(
        'border bg-ink-soft/60 transition-colors',
        tone === 'attention' ? 'border-ember/40' : 'border-line',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3 md:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className={cn('flex min-w-0 flex-1 items-center gap-3 text-left', focusRing)}
        >
          <span
            aria-hidden
            className={cn(
              'shrink-0 font-mono text-xs text-smoke transition-transform duration-200',
              open && 'rotate-90',
            )}
          >
            ▸
          </span>
          <span className="min-w-0 flex-1">{summary}</span>
        </button>
        {aside && <div className="flex shrink-0 items-center gap-1">{aside}</div>}
      </div>
      {open && (
        <div id={id} className="border-t border-line px-4 py-5 md:px-5 md:py-6">
          {children}
        </div>
      )}
    </div>
  )
}
