import { useState, type FormEvent } from 'react'

import { useLanguage } from '@/i18n/LanguageContext'
import { getAnalyticsContext, trackEvent } from '@/lib/analytics'
import { isFirebaseConfigured } from '@/lib/firebase-config'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'sending' | 'success' | 'error'

const fieldClass =
  'w-full border-b border-line bg-transparent py-3 text-bone placeholder:text-smoke transition-colors focus:border-ember focus:outline-none'

/**
 * Real contact form wired to Firestore (`messages`). Degrades to a clear note
 * pointing at the mailto button when Firebase is not configured.
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
    <form onSubmit={onSubmit} className="w-full max-w-md">
      <p className="mb-6 font-mono text-[10px] tracking-[0.25em] text-smoke uppercase">
        {f.heading}
      </p>

      <div className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={f.name}
            aria-label={f.name}
            className={fieldClass}
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={f.email}
            aria-label={f.email}
            className={fieldClass}
          />
        </div>
        <textarea
          required
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={f.message}
          aria-label={f.message}
          className={cn(fieldClass, 'resize-y leading-relaxed')}
        />

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={status === 'sending'}
            data-cursor="link"
            className="group inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-bone uppercase transition-colors hover:text-ember disabled:opacity-50"
          >
            <span className="h-px w-10 bg-current transition-all duration-300 group-hover:w-16" />
            {status === 'sending' ? f.sending : f.send}
          </button>
        </div>

        {status === 'success' && (
          <p className="text-sm text-ember">{f.success}</p>
        )}
        {status === 'error' && <p className="text-sm text-ember">{f.error}</p>}
      </div>
    </form>
  )
}
