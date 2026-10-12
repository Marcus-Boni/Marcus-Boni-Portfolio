import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { BlogPost } from '@/blog/pages/BlogPost'

vi.mock('@/blog/usePosts', () => ({
  usePost: () => ({
    status: 'ready', retry: () => {},
    post: {
      slug: 'arquitetura', lang: 'pt', status: 'published', title: 'Arquitetura', excerpt: 'Decisões de arquitetura.',
      tags: ['TypeScript'], readingMinutes: 3, publishedAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-02T12:00:00.000Z',
      body: '# Contexto\n\n## Decisões', media: {},
    },
  }),
  usePostList: () => ({ posts: [{ slug: 'testes', lang: 'pt', status: 'published', title: 'Testes de software', tags: ['TypeScript'] }] }),
}))
vi.mock('@/hooks/useScrollReveal', () => ({ useScrollReveal: () => ({ current: null }) }))
vi.mock('@/i18n/LanguageContext', async () => {
  const { translations } = await import('@/i18n/translations')
  return { useLanguage: () => ({ locale: 'en', t: translations.en }) }
})
vi.mock('@/lib/analytics', () => ({ trackEvent: () => {} }))

const render = () => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/blog/arquitetura'] },
  createElement(Routes, null, createElement(Route, { path: '/blog/:slug', element: createElement(BlogPost) })),
))

describe('article semantics independent of reader UI language', () => {
  it('renders one h1, explicitly declares the authored language and links a visible author', () => {
    const html = render()
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('lang="pt-BR" aria-labelledby="post-title"')
    expect(html).toContain('href="/about" rel="author"')
    expect(html).toContain('<h2 id="contexto">')
  })

  it('makes publication and revision dates machine-readable', () => {
    const html = render()
    expect(html).toContain('<time dateTime="2026-09-01T12:00:00.000Z">')
    expect(html).toContain('<time dateTime="2026-09-02T12:00:00.000Z">')
  })

  it('renders a breadcrumb trail and crawlable related article links', () => {
    const html = render()
    expect(html).toContain('aria-label="Breadcrumb"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('href="/blog/testes"')
    expect(html).not.toContain('translationAvailable')
  })
})
