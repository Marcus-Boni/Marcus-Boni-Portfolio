import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { BlogPost } from '@/blog/pages/BlogPost'

const pair = { status: 'published', tags: [], readingMinutes: 3, publishedAt: '2026-09-01T12:00:00.000Z' }

vi.mock('@/blog/usePosts', () => ({
  usePost: () => ({
    status: 'ready', retry: () => {},
    post: { ...pair, slug: 'arquitetura', lang: 'pt', title: 'Arquitetura', excerpt: '', translationOf: 'architecture', body: '## Contexto', media: {} },
  }),
  usePostList: () => ({
    posts: [{ ...pair, slug: 'architecture', lang: 'en', title: 'Architecture', translationOf: 'arquitetura' }],
  }),
}))
vi.mock('@/hooks/useScrollReveal', () => ({ useScrollReveal: () => ({ current: null }) }))
// The reader browses in English while the entry on screen is the Portuguese one.
vi.mock('@/i18n/LanguageContext', async () => {
  const { translations } = await import('@/i18n/translations')
  return { useLanguage: () => ({ locale: 'en', t: translations.en }) }
})
vi.mock('@/lib/analytics', () => ({ trackEvent: () => {} }))

describe('link to the translated entry', () => {
  it('is named after the entry on screen, whatever language the reader browses in', () => {
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/blog/arquitetura'] },
      createElement(Routes, null, createElement(Route, { path: '/blog/:slug', element: createElement(BlogPost) })),
    ))
    expect(html).toMatch(/<a[^>]*hrefLang="en"[^>]*href="\/blog\/architecture"[^>]*>Read in English<\/a>|<a[^>]*href="\/blog\/architecture"[^>]*hrefLang="en"[^>]*>Read in English<\/a>/i)
    expect(html).not.toContain('Ler em português')
  })
})
