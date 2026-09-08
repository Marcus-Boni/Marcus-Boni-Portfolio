import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'

import { BlogHeader } from '@/blog/components/BlogHeader'
import { BlogIndex } from '@/blog/pages/BlogIndex'
import { Cursor } from '@/components/cursor/Cursor'
import { SmoothScroll } from '@/components/layout/SmoothScroll'
import { usePointerTracking } from '@/hooks/usePointer'
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

/**
 * Client-side navigation keeps scroll position; an article should start at the
 * top. The same effect fires the pageview, because on a SPA no navigation
 * event reaches the tracker on its own.
 *
 * A blog route records a plain `pageview` *in addition to* its content-specific
 * event (`post_view` / `blog_index_view`). Without it the site's headline
 * "visits" number and its top-pages list would silently exclude every blog
 * reader — the tracker only ever saw the portfolio page.
 */
function RouteChange() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    trackEvent('pageview')
  }, [pathname])
  return null
}

/**
 * The blog's own shell, mounted lazily under `/blog/*`.
 *
 * It reuses the portfolio's smooth scroll and custom cursor so the two halves
 * of the site feel like one product, but keeps its own header — the portfolio's
 * navigates between sections of a single page, which does not exist here.
 */
export default function BlogApp() {
  usePointerTracking()

  return (
    <SmoothScroll>
      <RouteChange />
      <Cursor />
      <BlogHeader />

      <main className="min-h-svh">
        <Suspense fallback={<div className="min-h-svh bg-ink" />}>
          <Routes>
            <Route index element={<BlogIndex />} />
            <Route path=":slug" element={<BlogPost />} />
            <Route path="*" element={<BlogPost />} />
          </Routes>
        </Suspense>
      </main>

      <div aria-hidden className="grain z-[90]" />
    </SmoothScroll>
  )
}
