import { Suspense, lazy, useEffect, useMemo, useRef } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { BlogHeader } from '@/blog/components/BlogHeader'
import {
  BlogLocaleSwitchContext,
  type PostAlternateTarget,
} from '@/blog/lib/locale-switch'
import { BlogIndex } from '@/blog/pages/BlogIndex'
import { Cursor } from '@/components/cursor/Cursor'
import { CodeTooth } from '@/components/layout/CodeTooth'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import type { Locale } from '@/i18n/translations'
import { trackEvent } from '@/lib/analytics'

/**
 * The post page carries the entire Markdown renderer (react-markdown + the
 * remark/rehype pipeline, ~63 KB gzipped). Lazy-loading it here is what keeps
 * the *index* — which renders no Markdown at all — from paying for it.
 * Resist the urge to solve this with a `manualChunks` rule instead: naming a
 * chunk for those packages makes them a static dependency and they surface as
 * a modulepreload on the home page.
 */
const BlogPost = lazy(() =>
  import('@/blog/pages/BlogPost').then((module) => ({ default: module.BlogPost })),
)

/** Strips an `/en` prefix and trailing slash to identify the underlying document. */
function canonicalDocumentPath(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/'
  if (normalized === '/en/blog') return '/blog'
  if (normalized.startsWith('/en/blog/')) return normalized.slice('/en'.length)
  return normalized
}

/**
 * Client-side navigation keeps scroll position; an article should start at the
 * top when opening a *new* document, while switching language inside the *same*
 * entry (`/blog/{slug}` ↔ `/en/blog/{slug}`) or index (`/blog` ↔ `/en/blog`)
 * preserves the reader's position so they never lose their place mid-article.
 */
function RouteChange() {
  const { pathname } = useLocation()
  const previousPath = useRef<string | null>(null)

  useEffect(() => {
    const prev = previousPath.current
    previousPath.current = pathname
    const sameEditionDocument =
      prev !== null && canonicalDocumentPath(prev) === canonicalDocumentPath(pathname)

    if (!sameEditionDocument) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      trackEvent('pageview')
    }
  }, [pathname])
  return null
}

/**
 * The blog's own shell, mounted lazily under `/blog/*` and `/en/blog/*`.
 *
 * It reuses the portfolio's smooth scroll and custom cursor so the two halves
 * of the site feel like one product, but keeps its own header — the portfolio's
 * navigates between sections of a single page, which does not exist here.
 */
export default function BlogApp({ routeLang = 'pt' }: { routeLang?: Locale }) {
  const alternateRef = useRef<PostAlternateTarget | null>(null)
  const switchContext = useMemo(
    () => ({
      getAlternate: () => alternateRef.current,
      setAlternate: (target: PostAlternateTarget | null) => {
        alternateRef.current = target
      },
    }),
    [],
  )

  return (
    <BlogLocaleSwitchContext value={switchContext}>
      <SmoothScroll>
        <RouteChange />
        <Cursor />
        <BlogHeader routeLang={routeLang} />

        {/* under the content: `main` is isolated so it paints over this layer */}
        <CodeTooth quiet />

        <main className="isolate min-h-svh">
          <Suspense fallback={<div className="min-h-svh bg-ink" />}>
            <Routes>
              <Route index element={<BlogIndex routeLang={routeLang} />} />
              <Route path=":slug" element={<BlogPost routeLang={routeLang} />} />
              <Route path="*" element={<BlogPost routeLang={routeLang} />} />
            </Routes>
          </Suspense>
        </main>
      </SmoothScroll>
    </BlogLocaleSwitchContext>
  )
}
