import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Stack } from '@/components/sections/Stack'
import { techStack, type TechItem } from '@/data/profile'

const state = vi.hoisted(() => ({ techStack: [] as TechItem[] }))
vi.mock('lenis/react', () => ({ useLenis: () => null }))
vi.mock('@/content/SiteContentContext', () => ({
  useSiteContent: () => ({ content: state }),
}))
vi.mock('@/hooks/useScrollReveal', () => ({ useGsapScope: () => ({ current: null }) }))
vi.mock('@/i18n/LanguageContext', async () => {
  const { translations } = await import('@/i18n/translations')
  return { useLanguage: () => ({ t: translations.pt }) }
})

const render = () => renderToStaticMarkup(createElement(Stack))

describe('technology overview', () => {
  beforeEach(() => { state.techStack = techStack })

  it('shows the entire stack once without requiring visitors to open panels', () => {
    const html = render()
    for (const tech of techStack) {
      expect(html.split(`>${tech.name}</li>`)).toHaveLength(2)
    }
    expect(html.match(/<h3\b/g)).toHaveLength(4)
    expect(html.match(/<ul\b/g)).toHaveLength(4)
    expect(html).not.toMatch(/\shidden(?:=|\s|>)/)
    expect(html).toContain('href="#work"')
  })

  it('groups new CMS technologies by their category and omits empty categories', () => {
    state.techStack = [
      { id: 'custom', name: 'Go', category: 'backend' },
      { id: 'db', name: 'Redis', category: 'data' },
    ]
    const html = render()
    expect(html).toContain('id="craft-backend"')
    expect(html).toContain('id="craft-data"')
    expect(html).not.toContain('id="craft-frontend"')
    expect(html).not.toContain('id="craft-ops"')
    expect(html).toContain('>Go</li>')
    expect(html).toContain('>Redis</li>')
    expect(html).not.toContain('>React</li>')
  })
})
