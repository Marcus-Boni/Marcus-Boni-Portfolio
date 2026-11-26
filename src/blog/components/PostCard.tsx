import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'

import { BlogImage } from '@/blog/components/BlogImage'
import { PostPlate } from '@/blog/components/PostPlate'
import { readingProgress } from '@/blog/lib/reading-memory'
import { entryNumber, formatPostDateCompact } from '@/blog/lib/text'
import type { PostMeta } from '@/blog/types'
import { HoverItalic } from '@/components/ui/HoverItalic'
import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { cn } from '@/lib/utils'
import { localizedMeta, postPath } from '../../../netlify/lib/blog-locale'

function formatLangBadge(langs: Locale[]): string {
  if (langs.length >= 2) return 'PT · EN'
  return (langs[0] ?? 'pt').toUpperCase()
}

/** Mono metadata line shared by every card shape. */
function PostMetaLine({
  post,
  lang,
  langs,
  canonicalSlug,
  className,
  dateClassName,
}: {
  post: PostMeta
  lang: Locale
  langs?: Locale[]
  canonicalSlug?: string
  className?: string
  /** Lets a layout that already prints the date elsewhere drop it here. */
  dateClassName?: string
}) {
  const { locale, t } = useLanguage()
  const view = localizedMeta(post, lang)
  const displayLangs = langs && langs.length > 0 ? langs : view.availableLangs
  const date = formatPostDateCompact(post.publishedAt, locale)
  const parts: { key: string; node: React.ReactNode; className?: string }[] = []
  if (date) {
    parts.push({
      key: 'date',
      className: dateClassName,
      node: <time dateTime={post.publishedAt ?? undefined}>{date}</time>,
    })
  }
  if (typeof view.readingMinutes === 'number') {
    parts.push({ key: 'reading', node: t.blog.readingTime(view.readingMinutes) })
  }
  if (displayLangs.length > 0) {
    parts.push({
      key: 'lang',
      node: <span className="text-bone-dim">{formatLangBadge(displayLangs)}</span>,
    })
  }
  if (post.series) {
    parts.push({ key: 'series', node: <span className="text-ember">{post.series.title}</span> })
  }
  // The reader's own mark, from their browser (see `reading-memory.ts`).
  const progress = readingProgress(canonicalSlug ?? post.slug)
  if (progress >= 8) {
    parts.push({
      key: 'progress',
      node: (
        <span className="text-bone">
          {progress >= 100 ? t.blog.read : t.blog.inProgress(progress)}
        </span>
      ),
    })
  }

  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase',
        className,
      )}
    >
      {parts.map((part) => (
        <span
          key={part.key}
          className={cn(
            'flex items-center gap-3 [&:not(:last-child)]:after:text-line [&:not(:last-child)]:after:content-["/"]',
            part.className,
          )}
        >
          {part.node}
        </span>
      ))}
    </p>
  )
}

/** Hover and keyboard focus both set a card's plate moving. */
function useActive() {
  const [active, setActive] = useState(false)
  return {
    active,
    handlers: {
      onPointerEnter: () => setActive(true),
      onPointerLeave: () => setActive(false),
      onFocus: () => setActive(true),
      onBlur: () => setActive(false),
    },
  }
}

/**
 * The lead slot on the index: the entry's cover — or its field plate when it
 * has none — beside an oversized title. Rendered once, for the featured post.
 */
export function FeaturedPostCard({
  post,
  ordinal,
  lang,
  href,
  availableLangs,
  canonicalSlug,
}: {
  post: PostMeta
  ordinal?: number
  lang?: Locale
  href?: string
  availableLangs?: Locale[]
  canonicalSlug?: string
}) {
  const { locale, t } = useLanguage()
  const { active, handlers } = useActive()
  const displayLang = lang ?? locale
  const view = localizedMeta(post, displayLang)
  const target = href ?? postPath(post, displayLang)
  const seed = canonicalSlug ?? post.slug

  return (
    <Link
      to={target}
      data-cursor="view"
      {...handlers}
      className="group grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-14"
    >
      <div className="relative">
        {post.cover ? (
          <BlogImage
            media={{ ...post.cover, alt: view.coverAlt || post.cover.alt }}
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="border border-line transition-opacity duration-500 group-hover:opacity-90"
          />
        ) : (
          <PostPlate
            seed={seed}
            motion="drift"
            active={active}
            className="aspect-[16/10] border border-line transition-colors duration-500 group-hover:border-ember/60"
          />
        )}
        <span className="absolute top-0 left-0 bg-ember px-2.5 py-1 font-mono text-[10px] tracking-[0.22em] text-ink uppercase">
          {t.blog.featured}
        </span>
        {ordinal !== undefined && (
          <span className="absolute bottom-3 left-3 bg-ink/85 px-2.5 py-1 font-mono text-[10px] tracking-[0.22em] text-bone-dim uppercase">
            {t.blog.entry(entryNumber(ordinal))}
          </span>
        )}
      </div>

      <div>
        <PostMetaLine
          post={post}
          lang={displayLang}
          langs={availableLangs}
          canonicalSlug={seed}
        />
        {/* Colour carries the hover here: at this size the upright and italic
            faces of a long title wrap differently, and stacking them (as
            HoverItalic does) would reserve a line that is never filled. */}
        <h2 className="mt-5 font-display text-[clamp(2.25rem,4.6vw,4rem)] leading-[1.02] text-balance text-bone transition-colors duration-500 group-hover:text-ember">
          {view.title}
        </h2>
        {(view.subtitle || view.excerpt) && (
          <p className="mt-5 max-w-lg text-base leading-relaxed text-pretty text-bone-dim">
            {view.subtitle || view.excerpt}
          </p>
        )}
        <span className="mt-8 inline-flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-bone uppercase transition-colors duration-300 group-hover:text-ember">
          <span className="h-px w-10 bg-current transition-[width] duration-500 ease-out-expo group-hover:w-16" />
          {t.blog.readEntry}
        </span>
      </div>
    </Link>
  )
}

/**
 * One line of the ledger: ordinal and date in the margin, the entry in the
 * middle, its plate at the end. The whole row is the target; the italic
 * cross-fade and the plate coming alive carry the affordance.
 */
export function PostRow({
  post,
  ordinal,
  index,
  lang,
  href,
  availableLangs,
  canonicalSlug,
}: {
  post: PostMeta
  ordinal: number
  /** Position in the visible list — staggers the row's entrance. */
  index: number
  lang?: Locale
  href?: string
  availableLangs?: Locale[]
  canonicalSlug?: string
}) {
  const { locale, t } = useLanguage()
  const { active, handlers } = useActive()
  const displayLang = lang ?? locale
  const view = localizedMeta(post, displayLang)
  const target = href ?? postPath(post, displayLang)
  const seed = canonicalSlug ?? post.slug

  return (
    <li
      className="animate-ledger-row"
      style={{ '--row': Math.min(index, 8) } as CSSProperties}
    >
      <Link
        to={target}
        data-cursor="view"
        {...handlers}
        className="group grid gap-x-8 gap-y-3 border-b border-line py-8 transition-colors duration-500 hover:border-ember/50 md:grid-cols-[7.5rem_minmax(0,1fr)_9.5rem] lg:grid-cols-[8.5rem_minmax(0,1fr)_11.5rem]"
      >
        <p className="flex items-baseline gap-3 font-mono text-[11px] tracking-[0.18em] text-smoke uppercase md:flex-col md:gap-2 md:pt-2">
          <span className="transition-colors duration-300 group-hover:text-ember">
            {t.blog.entry(entryNumber(ordinal))}
          </span>
          <span className="text-[10px] tracking-[0.2em] whitespace-nowrap max-md:hidden">
            {formatPostDateCompact(post.publishedAt, locale)}
          </span>
        </p>

        <div className="min-w-0">
          <h2 className="font-display text-[clamp(1.6rem,2.7vw,2.4rem)] leading-[1.08] text-bone">
            <HoverItalic text={view.title} />
          </h2>
          {view.excerpt && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-pretty text-bone-dim md:text-[15px]">
              {view.excerpt}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <PostMetaLine
              post={post}
              lang={displayLang}
              langs={availableLangs}
              canonicalSlug={seed}
              dateClassName="md:hidden"
            />
            {view.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="border border-line px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-smoke uppercase"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <PostPlate
          seed={seed}
          active={active}
          className="aspect-[16/10] border border-line transition-colors duration-500 group-hover:border-ember/60 max-md:hidden"
        />
      </Link>
    </li>
  )
}

/** "Read next" card: plate or cover, title, the essentials. */
export function RelatedCard({
  post,
  ordinal,
  lang,
  href,
  availableLangs,
  canonicalSlug,
}: {
  post: PostMeta
  ordinal?: number
  lang?: Locale
  href?: string
  availableLangs?: Locale[]
  canonicalSlug?: string
}) {
  const { locale, t } = useLanguage()
  const { active, handlers } = useActive()
  const displayLang = lang ?? locale
  const view = localizedMeta(post, displayLang)
  const target = href ?? postPath(post, displayLang)
  const seed = canonicalSlug ?? post.slug

  return (
    <Link to={target} data-cursor="view" {...handlers} className="group block">
      <div className="relative">
        {post.cover ? (
          <BlogImage
            media={{ ...post.cover, alt: view.coverAlt || post.cover.alt }}
            sizes="(min-width: 768px) 30vw, 100vw"
            className="border border-line"
          />
        ) : (
          <PostPlate
            seed={seed}
            active={active}
            className="aspect-[16/10] border border-line transition-colors duration-500 group-hover:border-ember/60"
          />
        )}
        {ordinal !== undefined && (
          <span className="absolute bottom-2 left-2 bg-ink/85 px-2 py-0.5 font-mono text-[9px] tracking-[0.22em] text-bone-dim uppercase">
            {t.blog.entry(entryNumber(ordinal))}
          </span>
        )}
      </div>
      <h3 className="mt-4 font-display text-2xl leading-[1.1] text-balance text-bone">
        <HoverItalic text={view.title} />
      </h3>
      <PostMetaLine
        post={post}
        lang={displayLang}
        langs={availableLangs}
        canonicalSlug={seed}
        className="mt-3"
      />
    </Link>
  )
}
