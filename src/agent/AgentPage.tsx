import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { AgentConsole } from '@/agent/components/AgentConsole'
import { parseAskQueryParams } from '@/agent/share'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { trackEvent } from '@/lib/analytics'
import { transitionLocale } from '@/lib/locale-transition'
import { cn } from '@/lib/utils'

const SITE_URL = 'https://marcusboni.com.br'

function useAskHead(locale: Locale) {
  useEffect(() => {
    const isPt = locale === 'pt'
    const title = isPt
      ? 'Dossiê interativo — Marcus Boni'
      : 'Interactive dossier — Marcus Boni'
    const description = isPt
      ? 'Consulte a trajetória, projetos, stack e entregas em produção de Marcus Boni ou cole uma vaga (/fit) para mapear evidências reais.'
      : 'Query Marcus Boni’s stack, repositories, and production client work, or paste a job description (/fit) for an evidence-based role brief.'
    const path = isPt ? '/ask' : '/en/ask'
    const url = `${SITE_URL}${path}`

    document.title = title
    document.documentElement.lang = isPt ? 'pt-BR' : 'en'

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      document.head.querySelectorAll(selector).forEach((node) => node.remove())
      const meta = document.createElement('meta')
      meta.setAttribute(attr, key)
      meta.setAttribute('content', content)
      document.head.appendChild(meta)
    }

    setMeta('meta[name="description"]', 'name', 'description', description)
    setMeta('meta[name="title"]', 'name', 'title', title)
    setMeta('meta[property="og:title"]', 'property', 'og:title', title)
    setMeta('meta[property="og:description"]', 'property', 'og:description', description)
    setMeta('meta[property="og:url"]', 'property', 'og:url', url)

    document.head.querySelectorAll('link[rel="canonical"]').forEach((node) => node.remove())
    const canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    canonical.setAttribute('href', url)
    document.head.appendChild(canonical)
  }, [locale])
}

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
