import { Link } from 'react-router-dom'

import { useScrollHeader } from '@/hooks/useScrollHeader'
import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { cn } from '@/lib/utils'

/**
 * Header for the blog routes.
 *
 * The portfolio's header scrolls between sections of one long page, which has
 * no meaning here, so this is a quieter variant: wordmark home, the section
 * label, and the language toggle. It uses the same glass-on-scroll treatment so
 * the transition between the two areas reads as one site.
 */
export function BlogHeader() {
  const { locale, setLocale, t } = useLanguage()
  const { scrolled } = useScrollHeader(false)
  const options: Locale[] = ['pt', 'en']

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 -z-10 border-b backdrop-blur-xl transition-opacity duration-500',
          'border-line/60 bg-ink/55 shadow-[0_12px_44px_-22px_rgba(0,0,0,0.85)]',
          scrolled ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div className="flex items-center justify-between px-5 py-4 md:px-8">
        <div className="flex items-baseline gap-4">
          <Link
            to="/"
            className="font-display-italic text-2xl leading-none text-bone transition-colors hover:text-ember"
            aria-label={t.header.backHome}
          >
            mb<span className="text-ember">.</span>
          </Link>
          <Link
            to="/blog"
            className="font-mono text-[10px] tracking-[0.3em] text-smoke uppercase transition-colors hover:text-bone"
          >
            {t.blog.nav}
          </Link>
        </div>

        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="hidden font-mono text-[11px] tracking-[0.18em] text-bone-dim uppercase transition-colors hover:text-ember sm:block"
          >
            {t.header.backHome}
          </Link>

          <div
            className="flex items-center gap-2 font-mono text-[11px] tracking-[0.18em]"
            role="group"
            aria-label="Language"
          >
            {options.map((option, index) => (
              <span key={option} className="flex items-center gap-2">
                {index > 0 && <span className="text-smoke">/</span>}
                <button
                  type="button"
                  onClick={() => setLocale(option)}
                  aria-pressed={locale === option}
                  className={cn(
                    'uppercase transition-colors duration-300',
                    locale === option
                      ? 'text-ember'
                      : 'text-bone/50 hover:text-bone',
                  )}
                >
                  {option}
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
