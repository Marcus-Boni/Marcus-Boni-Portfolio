import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { buildBlogAskPath } from '@/agent/share'
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
import { useBlogLocaleSwitch } from '@/blog/lib/locale-switch'
import { usePostHead } from '@/blog/lib/seo'
import { useReleaseServerDocument } from '@/blog/lib/server-document'
import { entryNumber, extractToc, formatPostDate, formatPostDateCompact } from '@/blog/lib/text'
import type { PostMeta } from '@/blog/types'
import { usePost, usePostList } from '@/blog/usePosts'
import { HoverItalic } from '@/components/ui/HoverItalic'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import { translations, type Locale } from '@/i18n/translations'
import { trackEvent } from '@/lib/analytics'
import { isPlainLeftClick, transitionLocale } from '@/lib/locale-transition'
import { cn } from '@/lib/utils'
import {
  blogIndexPath,
  collapseLegacyPairs,
  isBilingual,
  localizedBody,
  localizedMeta,
  postPath,
  type CollapsedEntry,
} from '../../../netlify/lib/blog-locale'
import { postCanonicalUrl, reciprocalTranslation, validDate } from '../../../netlify/lib/blog-seo'

/**
 * A single post, laid out as a notebook page.
 *
 * One publication can carry both Portuguese and English versions: PT lives at
 * `/blog/{slug}` and EN at `/en/blog/{slug}` with instant switching between
 * them (zero extra Firestore reads) and shared ordinal, terrain plate, and
 * reading progress. Legacy paired posts linked via `translationOf` keep working
 * seamlessly as well.
 */
export function BlogPost({ routeLang = 'pt' }: { routeLang?: Locale }) {
  const { slug } = useParams<{ slug: string }>()
  const { locale, setLocale, t } = useLanguage()
  const { post, status, retry } = usePost(slug)
  const { posts } = usePostList()
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const articleRef = useRef<HTMLDivElement>(null)

  const bilingual = post ? isBilingual(post) : false

  // `/en/blog/{slug}` is reserved for the English version of bilingual posts;
  // single-language posts canonically live at `/blog/{slug}`.
  useEffect(() => {
    if (post && routeLang === 'en' && !bilingual) {
      navigate(`/blog/${encodeURIComponent(post.slug)}`, { replace: true })
    }
  }, [post, routeLang, bilingual, navigate])

  const activeLang: Locale = post ? (bilingual ? routeLang : post.lang) : routeLang
  const view = useMemo(
    () => (post ? localizedMeta(post, activeLang) : null),
    [post, activeLang],
  )
  const body = useMemo(
    () => (post ? localizedBody(post, activeLang) : ''),
    [post, activeLang],
  )

  const legacyTranslation =
    post && !bilingual
      ? posts.find((candidate) => reciprocalTranslation(post, candidate)) ?? null
      : null

  const alternate = useMemo<{ lang: Locale; path: string } | null>(() => {
    if (!post) return null
    if (bilingual) {
      const otherLang: Locale = activeLang === 'pt' ? 'en' : 'pt'
      return { lang: otherLang, path: postPath(post, otherLang) }
    }
    if (legacyTranslation) {
      return { lang: legacyTranslation.lang, path: `/blog/${legacyTranslation.slug}` }
    }
    return null
  }, [post, bilingual, activeLang, legacyTranslation])

  usePostHead(post, status, legacyTranslation, locale, pathname, activeLang)
  useReleaseServerDocument(status === 'ready')

  // Deep-links with `#heading` (e.g. section citations from the Dossier console)
  // land before Firestore resolves the post body; scroll once the heading mounts.
  useEffect(() => {
    if (status !== 'ready' || !hash || hash.length < 2) return
    let targetId = hash.slice(1)
    try {
      targetId = decodeURIComponent(targetId)
    } catch {
      /* keep raw id */
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: reducedMotion ? 'instant' : 'smooth',
        block: 'start',
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [status, hash, body])

  const { setAlternate } = useBlogLocaleSwitch()
  useEffect(() => {
    setAlternate(alternate)
    return () => setAlternate(null)
  }, [alternate, setAlternate])

  // Picking a language in the header switches this entry to that language when
  // available. `BlogHeader` already commits both inside one View Transition;
  // this effect stays as a safeguard for programmatic `setLocale` calls.
  const chosen = useRef(locale)
  useEffect(() => {
    const changed = chosen.current !== locale
    chosen.current = locale
    if (changed && alternate && alternate.lang === locale) {
      navigate(alternate.path)
    }
  }, [locale, alternate, navigate])

  const onSwitchEdition = (
    event: React.MouseEvent<HTMLAnchorElement>,
    target: { lang: Locale; path: string },
  ) => {
    if (!isPlainLeftClick(event)) return
    event.preventDefault()
    transitionLocale(target.lang, () => {
      setLocale?.(target.lang)
      navigate(target.path)
    })
  }

  const toc = useMemo(() => (body ? extractToc(body) : []), [body])

  // Collapse legacy pairs once so ordinals, neighbors, and related posts
  // operate on unique publications rather than duplicate language copies.
  const catalog = useMemo(
    () => collapseLegacyPairs(posts, activeLang),
    [posts, activeLang],
  )

  const canonicalSlug = useMemo(() => {
    if (!post) return ''
    if (legacyTranslation && post.lang === 'en') return legacyTranslation.slug
    return post.slug
  }, [post, legacyTranslation])

  // The entry's place in the journal, oldest first. Unlisted posts are not in
  // the published list, so they simply carry no number.
  const ordinals = useMemo(
    () =>
      new Map(
        catalog.map((entry, index) => [entry.canonicalSlug, catalog.length - index]),
      ),
    [catalog],
  )
  const ordinal = post ? ordinals.get(canonicalSlug) : undefined

  // The entries published just before and just after this one (unique publications).
  const { older, newer } = useMemo((): {
    older?: CollapsedEntry<PostMeta>
    newer?: CollapsedEntry<PostMeta>
  } => {
    if (!post) return {}
    const at = catalog.findIndex((entry) => entry.canonicalSlug === canonicalSlug)
    return at < 0 ? {} : { newer: catalog[at - 1], older: catalog[at + 1] }
  }, [post, catalog, canonicalSlug])

  const related = useMemo(() => {
    if (!post || !view) return []
    const taken = new Set([
      canonicalSlug,
      older?.canonicalSlug,
      newer?.canonicalSlug,
    ])
    return catalog
      .filter((entry) => !taken.has(entry.canonicalSlug))
      .map((entry) => {
        const candidateView = localizedMeta(entry.post, activeLang)
        const tagMatches = candidateView.tags.filter((tag) => view.tags.includes(tag)).length
        const seriesBoost =
          post.series && entry.post.series?.id === post.series.id ? 10 : 0
        return { entry, score: tagMatches + seriesBoost }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.entry)
  }, [post, view, catalog, canonicalSlug, activeLang, older, newer])

  useEffect(() => {
    if (post) trackEvent('post_view', { slug: post.slug, lang: activeLang })
  }, [post, activeLang])

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

  const indexPath = bilingual ? blogIndexPath(activeLang) : blogIndexPath(locale)

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

  if (!post || !view) {
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
          to={indexPath}
          className="border border-bone/30 px-4 py-2 font-mono text-[11px] tracking-[0.18em] text-bone uppercase transition-colors hover:border-ember hover:text-ember"
        >
          {t.blog.post.backToIndex}
        </Link>
      </Centered>
    )
  }

  const shareUrl = postCanonicalUrl(post, activeLang)

  return (
    <>
      <ReadingProgress targetRef={articleRef} />

      <article
        lang={activeLang === 'pt' ? 'pt-BR' : 'en'}
        aria-labelledby="post-title"
        data-locale-surface
        className="mx-auto max-w-6xl px-5 pt-28 pb-24 md:px-8 md:pt-36"
      >
        <nav aria-label={locale === 'pt' ? 'Caminho de navegação' : 'Breadcrumb'}>
          <ol className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-smoke">
            <li><Link to="/" className="hover:text-ember">Marcus Boni</Link></li>
            <li aria-hidden>/</li>
            <li><Link to={indexPath} className="hover:text-ember">Blog</Link></li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-bone-dim">{view.title}</li>
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
              {validDate(post.publishedAt) && (
                <time dateTime={validDate(post.publishedAt)}>
                  {formatPostDateCompact(post.publishedAt, locale)}
                </time>
              )}
              <span aria-hidden className="text-line">/</span>
              <span>{t.blog.readingTime(view.readingMinutes)}</span>
              <span aria-hidden className="text-line">/</span>
              {alternate ? (
                <span
                  className="relative inline-grid grid-cols-2 items-center border border-line"
                  role="group"
                  aria-label={t.blog.filters.language}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute inset-y-0 left-0 w-1/2 border-b border-ember bg-ember/12 transition-transform duration-500 ease-out-expo',
                      activeLang === 'en' ? 'translate-x-full' : 'translate-x-0',
                    )}
                  />
                  {(['pt', 'en'] as const).map((code) =>
                    code === activeLang ? (
                      <span
                        key={code}
                        aria-current="true"
                        className="relative px-2 py-0.5 text-center text-ember"
                      >
                        {code.toUpperCase()}
                      </span>
                    ) : (
                      <Link
                        key={code}
                        to={alternate.path}
                        hrefLang={alternate.lang === 'pt' ? 'pt-BR' : 'en'}
                        onClick={(event) => onSwitchEdition(event, alternate)}
                        className="relative px-2 py-0.5 text-center text-smoke transition-colors duration-300 hover:text-bone"
                      >
                        {code.toUpperCase()}
                      </Link>
                    ),
                  )}
                </span>
              ) : (
                <span>{activeLang.toUpperCase()}</span>
              )}
              {post.series && (
                <>
                  <span aria-hidden className="text-line">/</span>
                  <span className="text-ember">
                    {post.series.title} · {post.series.order}
                  </span>
                </>
              )}
            </p>

            <PostTitle key={`${post.slug}:${activeLang}`}>{view.title}</PostTitle>

            {view.subtitle && (
              <p className="mt-5 max-w-2xl font-display-italic text-[clamp(1.15rem,2.2vw,1.6rem)] leading-snug text-bone-dim">
                {view.subtitle}
              </p>
            )}

            <p className="mt-5 text-sm text-bone-dim">
              {locale === 'pt' ? 'Por ' : 'By '}
              <a href="/about" rel="author" className="text-bone hover:text-ember">Marcus Boni</a>
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {view.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`${indexPath}?tag=${encodeURIComponent(tag)}`}
                  className="border border-line px-2.5 py-1 font-mono text-[9px] tracking-[0.18em] text-smoke uppercase transition-colors hover:border-ember/60 hover:text-ember"
                >
                  {tag}
                </Link>
              ))}
              {alternate && (
                <Link
                  to={alternate.path}
                  hrefLang={alternate.lang === 'pt' ? 'pt-BR' : 'en'}
                  onClick={(event) => onSwitchEdition(event, alternate)}
                  className="group/lang relative overflow-hidden border border-ember/50 px-3 py-1 font-mono text-[9px] tracking-[0.18em] text-ember uppercase transition-colors duration-300 ease-out-expo hover:border-ember hover:bg-ember hover:text-ink"
                >
                  {/* Named after the entry's active language, not the reader's UI:
                      on a Portuguese entry the other version is always the English one. */}
                  {translations[activeLang].blog.post.translationAvailable}
                </Link>
              )}
            </div>

            <ResumeReading
              key={`resume:${canonicalSlug}:${activeLang}`}
              slug={canonicalSlug}
              targetRef={articleRef}
            />
          </div>

          {!post.cover && (
            <div className="vt-plate relative lg:col-span-4">
              <PostPlate
                seed={canonicalSlug}
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
            media={{
              ...post.cover,
              alt: view.coverAlt || post.cover.alt,
              caption: view.coverCaption ?? post.cover.caption,
            }}
            priority
            sizes="(min-width: 1280px) 1152px, 100vw"
            className="vt-plate mt-10 border border-line"
          />
        )}

        {/* ─── Article and its margin ────────────────────────────── */}
        {/* `has-margin` sizes the margin column; the index and the notes float
            out of the text column into it (see index.css). `relative` is for
            the quote toolbar, which positions itself against this column. */}
        <div className="has-margin mt-14">
          <div ref={articleRef} className="relative max-w-[68ch] min-w-0">
            <SectionIndex entries={toc} label={t.blog.post.toc} />
            <PostBody markdown={body} media={post.media} lang={activeLang} margin />
            <QuoteShare containerRef={articleRef} slug={post.slug} title={view.title} />
          </div>
        </div>

        <Neighbors
          older={older}
          newer={newer}
          ordinals={ordinals}
          lang={activeLang}
        />

        {related.length > 0 && (
          <section aria-labelledby="related-posts" className="mt-20 border-t border-line pt-10">
            <h2 id="related-posts" className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-none text-bone">
              {t.blog.post.readAlso}
            </h2>
            <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((entry) => (
                <li key={entry.canonicalSlug}>
                  <RelatedCard
                    post={entry.post}
                    ordinal={ordinals.get(entry.canonicalSlug)}
                    lang={activeLang}
                    href={postPath(entry.post, activeLang)}
                    availableLangs={entry.availableLangs}
                    canonicalSlug={entry.canonicalSlug}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        <PostFooter
          slug={post.slug}
          url={shareUrl}
          indexPath={indexPath}
          askPath={buildBlogAskPath({
            locale: activeLang,
            title: view.title,
            tags: view.tags,
          })}
          askLabel={t.blog.post.askDossier}
          title={view.title}
          updated={t.blog.post.updated(formatPostDate(post.updatedAt, locale))}
          updatedAt={validDate(post.updatedAt)}
          shareLabel={t.blog.post.share}
          copyLabel={t.blog.post.copyLink}
          copiedLabel={t.blog.post.copied}
          backLabel={t.blog.post.backToIndex}
        />
      </article>

      <PostRail entries={toc} minutes={view.readingMinutes} label={t.sections.rail} />
      <MobileReadingBar entries={toc} label={t.blog.post.toc} minutes={view.readingMinutes} />
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
  lang,
}: {
  older?: CollapsedEntry<PostMeta>
  newer?: CollapsedEntry<PostMeta>
  ordinals: Map<string, number>
  lang: Locale
}) {
  const { t } = useLanguage()
  if (!older && !newer) return null

  const both = Boolean(older && newer)

  const cell = (entry: CollapsedEntry<PostMeta>, label: string, direction: 'prev' | 'next') => {
    const alignEnd = both && direction === 'next'
    const number = ordinals.get(entry.canonicalSlug)
    const view = localizedMeta(entry.post, lang)
    return (
      <Link
        key={entry.canonicalSlug}
        to={postPath(entry.post, lang)}
        data-cursor="view"
        className={cn(
          'group flex flex-col gap-3 bg-ink py-8',
          both && (alignEnd ? 'sm:items-end sm:pl-8 sm:text-right' : 'sm:pr-8'),
        )}
      >
        <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase transition-colors duration-300 group-hover:text-ember">
          {direction === 'prev' && (
            <span
              aria-hidden
              className="transition-transform duration-300 ease-out-expo group-hover:-translate-x-0.5"
            >
              ←
            </span>
          )}
          <span>
            {label}
            {number !== undefined && ` / ${t.blog.entry(entryNumber(number))}`}
          </span>
          {direction === 'next' && (
            <span
              aria-hidden
              className="transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5"
            >
              →
            </span>
          )}
        </span>
        <span className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] leading-[1.1] text-balance text-bone">
          <HoverItalic text={view.title} />
        </span>
      </Link>
    )
  }

  return (
    <nav
      aria-label={t.blog.post.neighbors}
      className={cn(
        'mt-20 border-y border-line',
        both && 'grid gap-px bg-line sm:grid-cols-2',
      )}
    >
      {older && cell(older, t.blog.post.previous, 'prev')}
      {newer && cell(newer, t.blog.post.next, 'next')}
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
  url,
  indexPath,
  askPath,
  askLabel,
  title,
  updated,
  updatedAt,
  shareLabel,
  copyLabel,
  copiedLabel,
  backLabel,
}: {
  slug: string
  url: string
  indexPath: string
  askPath: string
  askLabel: string
  title: string
  updated: string
  updatedAt?: string
  shareLabel: string
  copyLabel: string
  copiedLabel: string
  backLabel: string
}) {
  const [copied, setCopied] = useState(false)

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
          <span aria-hidden className="text-line">
            /
          </span>
          <Link
            to={askPath}
            className="font-mono text-[10px] tracking-[0.2em] text-ember uppercase transition-colors hover:text-bone"
          >
            {askLabel} ↗
          </Link>
        </div>
      </div>

      <Link
        to={indexPath}
        className="group mt-10 flex items-center gap-4 border-t border-line pt-8"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 shrink-0 text-smoke transition-[color,translate] duration-500 ease-out-expo group-hover:-translate-x-2 group-hover:text-ember md:h-7 md:w-7"
        >
          <path d="M20 12H4" />
          <path d="M10 6l-6 6 6 6" />
        </svg>
        <span className="font-display text-3xl text-bone transition-colors duration-500 ease-out-expo group-hover:text-ember md:text-4xl">
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
