import { useState, type FormEvent, type ReactNode } from 'react'

import { useLanguage } from '@/i18n/LanguageContext'
import { getAnalyticsContext, trackEvent } from '@/lib/analytics'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'sending' | 'success' | 'error'

// The rule under a field is all that draws it, so it is `smoke`, not `line`:
// 4:1 against the page, where the hairline colour would be 1.3:1.
const fieldClass =
  'mt-1 w-full border-b border-smoke bg-transparent py-2.5 text-bone transition-colors duration-300 hover:border-bone-dim focus:border-ember focus:outline-none user-invalid:border-ember'

/**
 * A field with its name always on screen. The label wraps the control, so it
 * needs no id; it lights with the field, which is the only place the form
 * spends its accent.
 */
function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('group flex flex-col', className)}>
      <span className="font-mono text-[10px] tracking-[0.25em] text-smoke uppercase transition-colors duration-300 group-focus-within:text-ember">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * Real contact form wired to Firestore (`messages`). Degrades to a clear note
 * pointing at the mailto button when Firebase is not configured.
 *
 * Who is writing sits on the left, what they have to say takes the right:
 * the message gets the room, and the form fills the width of the section
 * instead of a narrow strip of it.
 */
export function ContactForm() {
  const { t, locale } = useLanguage()
  const f = t.contact.form
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setStatus('sending')
    try {
      const ctx = getAnalyticsContext()
      const { submitMessage } = await import('@/lib/messages')
      const ok = await submitMessage({
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        locale,
        referrerHost: ctx.referrerHost,
        country: ctx.country,
      })
      if (!ok) {
        setStatus('error')
        return
      }
      trackEvent('contact_submit')
      setStatus('success')
      setName('')
      setEmail('')
      setMessage('')
    } catch {
      // What was typed stays in the fields: a failed send must not cost a retype.
      setStatus('error')
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <p className="max-w-md border border-dashed border-line px-4 py-3 text-sm text-smoke">
        {f.offline}
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-4xl">
      <p className="mb-8 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
        {f.heading}
      </p>

      <div className="grid gap-x-14 gap-y-7 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-7">
          <Field label={f.name}>
            <input
              type="text"
              name="name"
              autoComplete="name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label={f.email}>
            <input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              required
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
          </Field>
        </div>

        <Field label={f.message} className="h-full">
          <textarea
            name="message"
            required
            rows={4}
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={cn(fieldClass, 'min-h-28 flex-1 resize-y leading-relaxed')}
          />
        </Field>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
        <button
          type="submit"
          disabled={status === 'sending'}
          data-cursor="link"
          className="group inline-flex min-h-11 items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-bone uppercase transition-colors hover:text-ember disabled:opacity-50"
        >
          <span className="h-px w-10 bg-current transition-[width] duration-500 ease-out-expo group-hover:w-16" />
          {status === 'sending' ? f.sending : f.send}
        </button>

        {/* Always in the document, so a screen reader hears the outcome land. */}
        <p
          role="status"
          className={cn('text-sm', status === 'error' ? 'text-ember' : 'text-bone')}
        >
          {status === 'success' && (
            <>
              <span aria-hidden className="mr-2.5 inline-block size-1.5 -translate-y-px rounded-full bg-ember" />
              {f.success}
            </>
          )}
          {status === 'error' && f.error}
        </p>
      </div>
    </form>
  )
}
