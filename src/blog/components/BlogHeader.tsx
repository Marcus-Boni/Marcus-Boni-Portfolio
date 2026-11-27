import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useBlogLocaleSwitch } from '@/blog/lib/locale-switch'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useScrollHeader } from '@/hooks/useScrollHeader'
import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { transitionLocale } from '@/lib/locale-transition'
import { cn } from '@/lib/utils'

/**
 * Header for the blog routes (`/blog/*` and `/en/blog/*`).
 *
 * Anchored in place (`vt-header`) during language View Transitions while the
 * edition below cross-dissolves smoothly.
 */
export function BlogHeader({ routeLang = 'pt' }: { routeLang?: Locale }) {
  const { locale, setLocale, t } = useLanguage()
  const { scrolled } = useScrollHeader(false)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { getAlternate } = useBlogLocaleSwitch()

  const normalized = pathname.replace(/\/+$/, '') || '/'
  const isIndex = normalized === '/blog' || normalized === '/en/blog'
  const activeLocale: Locale = isIndex ? (routeLang === 'en' ? 'en' : locale) : locale
  const indexTo = activeLocale === 'en' ? '/en/blog' : '/blog'
  const askTo = activeLocale === 'en' ? '/en/ask' : '/ask'

  const switchLocale = (next: Locale) => {
    if (isIndex) {
      const params = new URLSearchParams(search)
      // Tag labels are localized (e.g. IA vs AI), so clear tag filter on language switch.
      params.delete('tag')
      const qs = params.toString()
      const target = `${next === 'en' ? '/en/blog' : '/blog'}${qs ? `?${qs}` : ''}`
      if (next === activeLocale && target === `${normalized}${search}`) return
      transitionLocale(next, () => {
        setLocale(next)
        if (target !== `${normalized}${search}`) navigate(target)
      })
      return
    }

    const alternate = getAlternate()
    const targetPath =
      alternate && alternate.lang === next
        ? alternate.path
        : normalized.startsWith('/en/blog/') && next === 'pt'
          ? normalized.slice('/en'.length)
          : null

    if (next === locale && !targetPath) return

    transitionLocale(next, () => {
      setLocale(next)
      if (targetPath && targetPath !== normalized) navigate(targetPath)
    })
  }

  return (
    <header className="vt-header fixed inset-x-0 top-0 z-50">
      <div
        aria-hidden
        className={cn(
          'absolute inset-0 -z-10 border-b backdrop-blur-xl transition-opacity duration-500',
          'border-line/60 bg-ink/55 shadow-[0_12px_44px_-22px_var(--shade)]',
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
            to={indexTo}
            className="font-mono text-[10px] tracking-[0.3em] text-smoke uppercase transition-colors hover:text-bone"
          >
            {t.blog.nav}
          </Link>
        </div>

        <div className="flex items-center gap-6">
          <Link
            to={askTo}
            className="hidden border border-line px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-bone-dim uppercase transition-colors hover:border-ember hover:text-ember sm:inline-block"
          >
            {t.header.ask}
          </Link>
          <Link
            to="/"
            className="hidden font-mono text-[11px] tracking-[0.18em] text-bone-dim uppercase transition-colors hover:text-ember sm:block"
          >
            {t.header.backHome}
          </Link>

          <LanguageToggle activeLocale={activeLocale} onSelect={switchLocale} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
