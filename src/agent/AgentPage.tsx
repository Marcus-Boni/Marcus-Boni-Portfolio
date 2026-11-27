import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAskHead } from '@/agent/ask-seo'
import { AgentConsole } from '@/agent/components/AgentConsole'
import { parseAskQueryParams } from '@/agent/share'
import { useReleaseServerDocument } from '@/blog/lib/server-document'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { trackEvent } from '@/lib/analytics'
import { transitionLocale } from '@/lib/locale-transition'
import { cn } from '@/lib/utils'

/**
 * Dedicated `/ask` and `/en/ask` full-canvas workspace.
 *
 * Open Signal & Ink canvas with a single quiet top header and zero redundant
 * borders — letting the Kokonut UI AI composer and live traces own the stage.
 */
export default function AgentPage({ routeLang = 'pt' }: { routeLang?: Locale }) {
  const { locale, setLocale, t } = useLanguage()
  const navigate = useNavigate()
  const { search } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const deepLink = useMemo(() => parseAskQueryParams(search), [search])

  useEffect(() => {
    if (locale !== routeLang) setLocale(routeLang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLang])

  const activeLocale = routeLang
  useAskHead(activeLocale)
  useReleaseServerDocument(true)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    trackEvent('pageview')
    trackEvent('agent_open', { surface: 'page' })
  }, [routeLang])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const switchLocale = (next: Locale) => {
    const target = next === 'en' ? '/en/ask' : '/ask'
    if (next === activeLocale) return
    transitionLocale(next, () => {
      setLocale(next)
      navigate(target)
    })
  }

  const blogTo = activeLocale === 'en' ? '/en/blog' : '/blog'

  return (
    <div className="flex min-h-svh flex-col bg-ink text-bone">
      <header className="vt-header sticky top-0 z-40">
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 -z-10 border-b backdrop-blur-xl transition-opacity duration-300',
            'border-line/60 bg-ink/70',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div className="flex items-center justify-between px-5 py-4 md:px-8">
          <div className="flex items-baseline gap-3.5">
            <Link
              to="/"
              className="font-display-italic text-2xl leading-none text-bone transition-colors hover:text-ember"
              aria-label={t.header.backHome}
            >
              mb<span className="text-ember">.</span>
            </Link>
            <span className="font-mono text-[10px] tracking-[0.26em] text-smoke uppercase">
              {t.agent.nav}
            </span>
          </div>

          <div className="flex items-center gap-5 md:gap-6">
            <Link
              to="/"
              className="hidden font-mono text-[11px] tracking-[0.16em] text-bone-dim uppercase transition-colors hover:text-ember sm:block"
            >
              {t.header.backHome}
            </Link>
            <Link
              to={blogTo}
              className="hidden font-mono text-[11px] tracking-[0.16em] text-bone-dim uppercase transition-colors hover:text-ember md:block"
            >
              {t.blog.nav}
            </Link>
            <LanguageToggle activeLocale={activeLocale} onSelect={switchLocale} />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main data-locale-surface className="flex flex-1 flex-col">
        <AgentConsole
          variant="page"
          initialPrompt={deepLink.prompt}
          initialLens={deepLink.lens}
          initialMode={deepLink.mode}
        />
      </main>
    </div>
  )
}
