import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Work } from '@/components/sections/Work'

const state = vi.hoisted(() => ({ reduced: true }))
vi.mock('@/hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => state.reduced,
}))
vi.mock('@/hooks/useScrollReveal', () => ({ useGsapScope: () => ({ current: null }) }))
vi.mock('@/lib/analytics', () => ({ trackEvent: () => {} }))
vi.mock('@/i18n/LanguageContext', async () => {
  const { translations } = await import('@/i18n/translations')
  return { useLanguage: () => ({ locale: 'pt', t: translations.pt }) }
})
vi.mock('@/content/SiteContentContext', () => ({ useSiteContent: () => ({ content: {
  projects: [{ index: '01', year: '2026', title: 'Produto', stack: ['React'],
    url: 'https://github.com/example/product', description: { pt: 'Aplicação', en: 'App' } }],
  profile: { github: 'https://github.com/example', repoCount: 20 },
} }) }))

describe('project archive with reduced motion', () => {
  it('keeps every project and the archive in the unclipped vertical document', () => {
    state.reduced = true
    const html = renderToStaticMarkup(createElement(Work))
    expect(html).toContain('href="https://github.com/example/product"')
    expect(html).toContain('href="https://github.com/example"')
    expect(html).toContain('Arquivo completo')
    expect(html).not.toContain('lg:overflow-hidden')
    expect(html).not.toContain('lg:h-svh')
    expect(html).not.toContain('lg:flex-row')
    expect(html).not.toContain('a página anda para o lado')
  })

  it('preserves the horizontal presentation when motion is enabled', () => {
    state.reduced = false
    const html = renderToStaticMarkup(createElement(Work))
    expect(html).toContain('lg:h-svh')
    expect(html).toContain('lg:flex-row')
    expect(html).toContain('a página anda para o lado')
  })
})
