import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { BlogImage } from '@/blog/components/BlogImage'
import { PostBody } from '@/blog/components/PostBody'
import { ReadingProgress, TableOfContents } from '@/blog/components/reading'
import { SITE_URL, usePostHead } from '@/blog/lib/seo'
import { useReleaseServerDocument } from '@/blog/lib/server-document'
import { extractToc, formatPostDate } from '@/blog/lib/text'
import { usePost, usePostList } from '@/blog/usePosts'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'
import { reciprocalTranslation, validDate } from '../../../netlify/lib/blog-seo'

/**
 * A single post.
 *
 * Reading measure is capped near 68 characters — the article column is sized
 * for prose, with the table of contents living in the outer margin on wide
 * screens rather than stealing from the text.
 */
export function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const { locale, t } = useLanguage()
  const { post, status, retry } = usePost(slug)
  const { posts } = usePostList()
  const { pathname } = useLocation()
  const articleRef = useRef<HTMLDivElement>(null)
  const titleRef = useScrollReveal<HTMLHeadingElement>({ immediate: true })

  const translation = post
    ? posts.find((candidate) => reciprocalTranslation(post, candidate)) ?? null
    : null
  usePostHead(post, status, translation, locale, pathname)
  useReleaseServerDocument(status === 'ready')

  const toc = useMemo(() => (post ? extractToc(post.body) : []), [post])
  const related = useMemo(() => {
    if (!post) return []
    return posts
      .filter((candidate) => candidate.slug !== post.slug && candidate.slug !== translation?.slug && candidate.lang === post.lang)
      .map((candidate) => ({
        post: candidate,
        score: candidate.tags.filter((tag) => post.tags.includes(tag)).length +
          (post.series && candidate.series?.id === post.series.id ? 10 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((candidate) => candidate.post)
  }, [post, posts, translation])

  useEffect(() => {
    if (post) trackEvent('post_view', { slug: post.slug, lang: post.lang })
  }, [post])

  // "Read" is recorded once, at 75% depth — a proxy for actually finishing
  // rather than bouncing, and far more useful on the dashboard than a raw view.
  useEffect(() => {
    if (!post) return
    let fired = false
    const onScroll = () => {
      const el = articleRef.current
      if (fired || !el) return
      const depth =
        (window.scrollY + window.innerHeight - el.offsetTop) / el.offsetHeight
      if (depth >= 0.75) {
        fired = true
        trackEvent('post_read', { slug: post.slug })
        window.removeEventListener('scroll', onScroll)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [post])

  if (status === 'loading') {
    return (
      <Centered>
        <p className="font-mono text-[11px] tracking-[0.2em] text-smoke uppercase">
          {t.blog.loading}
        </p>
      </Centered>
    )
  }

  if (status === 'error') {
    return (
      <Centered>
        <p className="font-display text-3xl text-bone-dim">{t.blog.error}</p>
        <button
          type="button"
          onClick={retry}
          className="border border-bone/30 px-4 py-2 font-mono text-[11px] tracking-[0.18em] text-bone uppercase transition-colors hover:border-ember hover:text-ember"
        >
          {t.blog.retry}
        </button>
      </Centered>
    )
  }

  if (!post) {
    return (
      <Centered>
        <p className="font-mono text-[11px] tracking-[0.3em] text-ember uppercase">
          404
        </p>
        <h1 className="font-display text-[clamp(2.5rem,7vw,5rem)] leading-none text-bone">
          {t.blog.post.notFound}
        </h1>
        <p className="max-w-md text-bone-dim">{t.blog.post.notFoundBody}</p>
        <Link
          to="/blog"
          className="border border-bone/30 px-4 py-2 font-mono text-[11px] tracking-[0.18em] text-bone uppercase transition-colors hover:border-ember hover:text-ember"
        >
          {t.blog.post.backToIndex}
        </Link>
      </Centered>
    )
  }

  return (
    <>
      <ReadingProgress targetRef={articleRef} />

      <article lang={post.lang === 'pt' ? 'pt-BR' : 'en'} aria-labelledby="post-title" className="mx-auto max-w-6xl px-5 pt-28 pb-24 md:px-8 md:pt-36">
        <nav aria-label={locale === 'pt' ? 'Caminho de navegação' : 'Breadcrumb'}>
          <ol className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-smoke">
            <li><Link to="/" className="hover:text-ember">Marcus Boni</Link></li>
            <li aria-hidden>/</li>
            <li><Link to="/blog" className="hover:text-ember">Blog</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-bone-dim">{post.title}</li>
          </ol>
        </nav>

        {post.status === 'unlisted' && (
          <p className="mt-6 border border-dashed border-ember/40 px-4 py-2.5 font-mono text-[10px] tracking-[0.16em] text-ember uppercase">
            {t.blog.unlistedNotice}
          </p>
        )}

        {/* ─── Masthead ──────────────────────────────────────────── */}
        <header className="mt-8 border-b border-line pb-10">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.22em] text-smoke uppercase">
            {validDate(post.publishedAt) && <time dateTime={validDate(post.publishedAt)}>{formatPostDate(post.publishedAt, locale)}</time>}
            <span aria-hidden className="text-line">/</span>
            <span>{t.blog.readingTime(post.readingMinutes)}</span>
            <span aria-hidden className="text-line">/</span>
            <span>{post.lang.toUpperCase()}</span>
            {post.series && (
              <>
                <span aria-hidden className="text-line">/</span>
                <span className="text-ember">
                  {post.series.title} · {post.series.order}
                </span>
              </>
            )}
          </p>

          <h1
            id="post-title"
            ref={titleRef}
            data-reveal
            className="mt-6 max-w-4xl font-display text-[clamp(2.25rem,6vw,4.5rem)] leading-[1.02] text-bone"
          >
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="mt-5 max-w-2xl font-display-italic text-[clamp(1.15rem,2.2vw,1.6rem)] leading-snug text-bone-dim">
              {post.subtitle}
            </p>
          )}

          <p className="mt-5 text-sm text-bone-dim">
            {locale === 'pt' ? 'Por ' : 'By '}
            <a href="/about" rel="author" className="text-bone hover:text-ember">Marcus Boni</a>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {post.tags.map((tag) => (
              <Link
                key={tag}
                to={`/blog?tag=${encodeURIComponent(tag)}`}
                className="border border-line px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-smoke uppercase transition-colors hover:border-ember/60 hover:text-ember"
              >
                {tag}
              </Link>
            ))}
            {translation && (
              <Link
                to={`/blog/${translation.slug}`}
                hrefLang={translation.lang === 'pt' ? 'pt-BR' : 'en'}
                className="border border-ember/50 px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-ember uppercase transition-colors hover:bg-ember hover:text-ink"
              >
                {t.blog.post.translationAvailable}
              </Link>
            )}
          </div>
        </header>

        {post.cover && (
          <BlogImage
            media={post.cover}
            priority
            sizes="(min-width: 1280px) 1152px, 100vw"
            className="mt-10 border border-line"
          />
        )}

        {/* ─── Article + TOC ─────────────────────────────────────── */}
        <div className="mt-14 grid gap-14 xl:grid-cols-[minmax(0,1fr)_15rem] xl:gap-16">
          <div ref={articleRef} className="min-w-0 max-w-[68ch]">
            <PostBody markdown={post.body} media={post.media} />
          </div>

          <aside className="hidden xl:block">
            <TableOfContents entries={toc} label={t.blog.post.toc} />
          </aside>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-posts" className="mt-16 border-t border-line pt-8">
            <h2 id="related-posts" className="font-display text-3xl text-bone">{t.blog.post.readAlso}</h2>
            <ul className="mt-5 space-y-4">
              {related.map((candidate) => (
                <li key={candidate.slug}>
                  <Link to={`/blog/${candidate.slug}`} className="text-bone-dim hover:text-ember">{candidate.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <PostFooter
          slug={post.slug}
          title={post.title}
          updated={t.blog.post.updated(formatPostDate(post.updatedAt, locale))}
          updatedAt={validDate(post.updatedAt)}
          shareLabel={t.blog.post.share}
          copyLabel={t.blog.post.copyLink}
          copiedLabel={t.blog.post.copied}
          backLabel={t.blog.post.backToIndex}
        />
      </article>
    </>
  )
}

function PostFooter({
  slug,
  title,
  updated,
  updatedAt,
  shareLabel,
  copyLabel,
  copiedLabel,
  backLabel,
}: {
  slug: string
  title: string
  updated: string
  updatedAt?: string
  shareLabel: string
  copyLabel: string
  copiedLabel: string
  backLabel: string
}) {
  const [copied, setCopied] = useState(false)
  const url = `${SITE_URL}/blog/${slug}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
      trackEvent('post_share', { slug, channel: 'copy' })
    } catch {
      /* clipboard unavailable — the share links below still work */
    }
  }

  const share = (channel: 'linkedin' | 'x') => {
    trackEvent('post_share', { slug, channel })
  }

  return (
    <footer className="mt-20 border-t border-line pt-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <p className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
          <time dateTime={updatedAt}>{updated}</time>
        </p>

        <div className="flex flex-wrap items-center gap-4">
          <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
            {shareLabel}
          </span>
          <a
            href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => share('linkedin')}
            className="font-mono text-[10px] tracking-[0.2em] text-bone-dim uppercase transition-colors hover:text-ember"
          >
            LinkedIn
          </a>
          <a
            href={`https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => share('x')}
            className="font-mono text-[10px] tracking-[0.2em] text-bone-dim uppercase transition-colors hover:text-ember"
          >
            X
          </a>
          <button
            type="button"
            onClick={copy}
            className="font-mono text-[10px] tracking-[0.2em] text-bone-dim uppercase transition-colors hover:text-ember"
          >
            {copied ? copiedLabel : copyLabel}
          </button>
        </div>
      </div>

      <Link
        to="/blog"
        className="group mt-10 flex items-baseline gap-4 border-t border-line pt-8"
      >
        <span className="font-mono text-xs text-smoke transition-colors group-hover:text-ember">
          ←
        </span>
        <span className="font-display text-3xl text-bone transition-colors duration-500 group-hover:text-ember md:text-4xl">
          {backLabel}
        </span>
      </Link>
    </footer>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center gap-5 px-5 text-center">
      {children}
    </div>
  )
}
