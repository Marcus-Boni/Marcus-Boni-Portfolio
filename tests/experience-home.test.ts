import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Experience } from '@/components/sections/Experience'
import { experience } from '@/data/profile'

vi.mock('@/content/SiteContentContext', () => ({
  useSiteContent: () => ({ content: { experience } }),
}))
vi.mock('@/animations/gsap', () => ({ gsap: {}, ScrollTrigger: {} }))
vi.mock('@/lib/analytics', () => ({ trackEvent: () => {} }))
vi.mock('@/hooks/useScrollReveal', () => ({ useGsapScope: () => ({ current: null }) }))
vi.mock('@/hooks/useMagnetic', () => ({ useMagnetic: () => ({ current: null }) }))
vi.mock('@/hooks/useScramble', () => ({
  useScramble: () => ({ ref: { current: null }, scramble: () => {} }),
}))
vi.mock('@/i18n/LanguageContext', async () => {
  const { translations } = await import('@/i18n/translations')
  return { useLanguage: () => ({ t: translations.pt, locale: 'pt' }) }
})

describe('home Experience ledger', () => {
  it('lists only entries without home: false; the rest stay dossier-only', () => {
    const html = renderToStaticMarkup(createElement(Experience))
    const shown = experience.projects.filter((p) => p.home !== false)
    const hidden = experience.projects.filter((p) => p.home === false)

    expect(shown.length).toBeGreaterThan(0)
    expect(hidden.length).toBeGreaterThan(0)
    for (const entry of shown) expect(html).toContain(entry.scope.pt)
    for (const entry of hidden) expect(html).not.toContain(entry.scope.pt)
  })
})
