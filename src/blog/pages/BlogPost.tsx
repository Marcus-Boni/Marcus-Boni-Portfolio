import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { BlogImage } from '@/blog/components/BlogImage'
import { PostBody } from '@/blog/components/PostBody'
import { RelatedCard } from '@/blog/components/PostCard'
import { PostPlate } from '@/blog/components/PostPlate'
import { QuoteShare } from '@/blog/components/QuoteShare'
import {
  MobileReadingBar,
  PostRail,
  ReadingProgress,
  ResumeReading,
  SectionIndex,
} from '@/blog/components/reading'
import { SITE_URL, usePostHead } from '@/blog/lib/seo'
import { useReleaseServerDocument } from '@/blog/lib/server-document'
import { entryNumber, extractToc, formatPostDate, formatPostDateCompact } from '@/blog/lib/text'
import type { PostMeta } from '@/blog/types'
import { usePost, usePostList } from '@/blog/usePosts'
import { HoverItalic } from '@/components/ui/HoverItalic'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { trackEvent } from '@/lib/analytics'
import { reciprocalTranslation, validDate } from '../../../netlify/lib/blog-seo'

/**
 * A single post, laid out as a notebook page.
 *
 * The text keeps a reading measure near 68 characters. On a wide screen the
 * space to its right is the margin — the section index opens it, and notes sit
 * in it beside the sentence they comment on — while the page gutter on the
 * left carries the reading rail. Narrower screens fold the notes under their
 * paragraph and dock the rail to the bottom edge.
 *
 * A post without a cover wears its field plate in the masthead: the same
 * terrain it carries on the index, so the entry is recognisable on arrival.
 */
export function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const { locale, t } = useLanguage()
  const { post, status, retry } = usePost(slug)
  const { posts } = usePostList()
  const { pathname } = useLocation()
  const articleRef = useRef<HTMLDivElement>(null)

  const translation = post
    ? posts.find((candidate) => reciprocalTranslation(post, candidate)) ?? null
    : null
  usePostHead(post, status, translation, locale, pathname)
  useReleaseServerDocument(status === 'ready')

  const toc = useMemo(() => (post ? extractToc(post.body) : []), [post])
  // The entry's place in the journal, oldest first. Unlisted posts are not in
  // the published list, so they simply carry no number.
  const ordinals = useMemo(
    () => new Map(posts.map((candidate, index) => [candidate.slug, posts.length - index])),
    [posts],
  )
  const ordinal = post ? ordinals.get(post.slug) : undefined
  // The entries published just before and just after this one, same language.
  const { older, newer } = useMemo((): { older?: PostMeta; newer?: PostMeta } => {
    if (!post) return {}
    const shelf = posts.filter((candidate) => candidate.lang === post.lang)
    const at = shelf.findIndex((candidate) => candidate.slug === post.slug)
    return at < 0 ? {} : { newer: shelf[at - 1], older: shelf[at + 1] }
  }, [post, posts])
  const related = useMemo(() => {
    if (!post) return []
    const taken = new Set([post.slug, translation?.slug, older?.slug, newer?.slug])
    return posts
      .filter((candidate) => !taken.has(candidate.slug) && candidate.lang === post.lang)
      .map((candidate) => ({
        post: candidate,
        score: candidate.tags.filter((tag) => post.tags.includes(tag)).length +
          (post.series && candidate.series?.id === post.series.id ? 10 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((candidate) => candidate.post)
  }, [post, posts, translation, older, newer])

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
        <header className="mt-8 grid gap-10 border-b border-line pb-10 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className={post.cover ? 'lg:col-span-12' : 'lg:col-span-8'}>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.22em] text-smoke uppercase">
            {validDate(post.publishedAt) && <time dateTime={validDate(post.publishedAt)}>{formatPostDateCompact(post.publishedAt, locale)}</time>}
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

          <PostTitle key={post.slug}>{post.title}</PostTitle>

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

          <ResumeReading key={`resume:${post.slug}`} slug={post.slug} targetRef={articleRef} />
          </div>

          {!post.cover && (
            <div className="relative lg:col-span-4">
              <PostPlate
                seed={post.slug}
                motion="drift"
                className="aspect-[16/10] border border-line lg:aspect-[4/3]"
              />
              {ordinal !== undefined && (
                <span className="absolute bottom-3 left-3 bg-ink/85 px-2.5 py-1 font-mono text-[10px] tracking-[0.22em] text-bone-dim uppercase">
                  {t.blog.entry(entryNumber(ordinal))}
                </span>
              )}
            </div>
          )}
        </header>

        {post.cover && (
          <BlogImage
            media={post.cover}
            priority
            sizes="(min-width: 1280px) 1152px, 100vw"
            className="mt-10 border border-line"
          />
        )}

        {/* ─── Article and its margin ────────────────────────────── */}
        {/* `has-margin` sizes the margin column; the index and the notes float
            out of the text column into it (see index.css). `relative` is for
            the quote toolbar, which positions itself against this column. */}
        <div className="has-margin mt-14">
          <div ref={articleRef} className="relative max-w-[68ch] min-w-0">
            <SectionIndex entries={toc} label={t.blog.post.toc} />
            <PostBody markdown={post.body} media={post.media} lang={post.lang} margin />
            <QuoteShare containerRef={articleRef} slug={post.slug} title={post.title} />
          </div>
        </div>

        <Neighbors older={older} newer={newer} ordinals={ordinals} />

        {related.length > 0 && (
          <section aria-labelledby="related-posts" className="mt-20 border-t border-line pt-10">
            <h2 id="related-posts" className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-none text-bone">{t.blog.post.readAlso}</h2>
            <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((candidate) => (
                <li key={candidate.slug}>
                  <RelatedCard post={candidate} ordinal={ordinals.get(candidate.slug)} />
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

      <PostRail entries={toc} minutes={post.readingMinutes} label={t.sections.rail} />
      <MobileReadingBar entries={toc} label={t.blog.post.toc} minutes={post.readingMinutes} />
    </>
  )
}

/**
 * The way out of an entry that is not "back to the list": the one written
 * before it and the one written after, in the order they were published.
 */
function Neighbors({
  older,
  newer,
  ordinals,
}: {
  older?: PostMeta
  newer?: PostMeta
  ordinals: Map<string, number>
}) {
  const { t } = useLanguage()
  if (!older && !newer) return null

  const cell = (post: PostMeta | undefined, label: string, end: boolean) => {
    if (!post) return <div aria-hidden className="bg-ink max-sm:hidden" />
    const number = ordinals.get(post.slug)
    return (
      <Link
        to={`/blog/${post.slug}`}
        data-cursor="view"
        className={`group flex flex-col gap-3 bg-ink py-8 ${end ? 'sm:items-end sm:pl-8 sm:text-right' : 'sm:pr-8'}`}
      >
        <span className="font-mono text-[10px] tracking-[0.2em] text-smoke uppercase transition-colors duration-300 group-hover:text-ember">
          {label}
          {number !== undefined && ` / ${t.blog.entry(entryNumber(number))}`}
        </span>
        <span className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] leading-[1.1] text-balance text-bone">
          <HoverItalic text={post.title} />
        </span>
      </Link>
    )
  }

  return (
    <nav
      aria-label={t.blog.post.neighbors}
      className="mt-20 grid gap-px border-y border-line bg-line sm:grid-cols-2"
    >
      {cell(older, t.blog.post.previous, false)}
      {cell(newer, t.blog.post.next, true)}
    </nav>
  )
}

/**
 * The headline owns its reveal. The hook wires the animation in an effect
 * that runs when *this* component mounts — and that has to be after the post
 * arrived. Calling it from `BlogPost` would run the effect during the loading
 * state, find no `<h1>`, and leave the title `visibility: hidden` for good.
 */
function PostTitle({ children }: { children: string }) {
  const ref = useScrollReveal<HTMLHeadingElement>({ immediate: true })
  return (
    <h1
      id="post-title"
      ref={ref}
      data-reveal
      className="mt-6 max-w-4xl font-display text-[clamp(2.25rem,6vw,4.5rem)] leading-[1.02] text-balance text-bone"
    >
      {children}
    </h1>
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
