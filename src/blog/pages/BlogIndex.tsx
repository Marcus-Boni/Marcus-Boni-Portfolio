import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { FeaturedPostCard, PostRow } from '@/blog/components/PostCard'
import { PostPlate } from '@/blog/components/PostPlate'
import { useBlogIndexHead } from '@/blog/lib/seo'
import { useReleaseServerDocument } from '@/blog/lib/server-document'
import { formatPostDateCompact } from '@/blog/lib/text'
import { usePostList } from '@/blog/usePosts'
import type { PostMeta } from '@/blog/types'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import {
  collapseLegacyPairs,
  localizedMeta,
  postPath,
  type CollapsedEntry,
} from '../../../netlify/lib/blog-locale'

interface IndexItem {
  entry: CollapsedEntry<PostMeta>
  title: string
  tags: string[]
  readingMinutes: number
  href: string
}

/**
 * The journal's index, laid out as a field notebook: a masthead with the
 * figures of the notebook itself, then a ledger of numbered, dated entries.
 *
 * Every publication appears ONCE — never split into separate Portuguese and
 * English entries. The reader's active language (from the header toggle or
 * `/en/blog`) projects each bilingual entry into that language while keeping
 * single-language entries accessible with their language tag.
 */
export function BlogIndex({ routeLang = 'pt' }: { routeLang?: Locale }) {
  const { t, locale, setLocale } = useLanguage()
  const { posts, status, retry } = usePostList()
  const [params, setParams] = useSearchParams()
  const titleRef = useScrollReveal<HTMLHeadingElement>({ immediate: true })

  // Visiting `/en/blog` directly brings the interface into English on arrival.
  const syncedRoute = useRef<Locale | null>(null)
  useEffect(() => {
    if (routeLang === 'en' && syncedRoute.current !== 'en') {
      syncedRoute.current = 'en'
      setLocale?.('en')
    } else if (routeLang === 'pt') {
      syncedRoute.current = 'pt'
    }
  }, [routeLang, setLocale])

  const displayLang: Locale = routeLang === 'en' ? 'en' : locale
  const tagFilter = params.get('tag') ?? ''

  useBlogIndexHead(posts, displayLang)
  useReleaseServerDocument(status === 'ready')

  useEffect(() => {
    trackEvent('blog_index_view')
  }, [])

  // Collapse any legacy reciprocal `translationOf` pairs so every publication
  // is counted and rendered once, then project each entry to `displayLang`.
  const items = useMemo<IndexItem[]>(() => {
    const collapsed = collapseLegacyPairs(posts, displayLang)
    return collapsed.map((entry) => {
      const view = localizedMeta(entry.post, displayLang)
      return {
        entry,
        title: view.title,
        tags: view.tags,
        readingMinutes: view.readingMinutes,
        href: postPath(entry.post, displayLang),
      }
    })
  }, [posts, displayLang])

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of items) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [items])

  // An entry's ordinal is its place in the whole journal, oldest first — so
  // it stays put across languages and topic filters.
  const ordinals = useMemo(
    () =>
      new Map(
        items.map((item, index) => [item.entry.canonicalSlug, items.length - index]),
      ),
    [items],
  )

  const filtered = useMemo(
    () =>
      items.filter((item) => !tagFilter || item.tags.includes(tagFilter)),
    [items, tagFilter],
  )

  const [featured, ...rest] = splitFeatured(filtered)
  const hasFilters = Boolean(tagFilter)

  const setTagFilter = (value: string) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete('tag')
    else next.set('tag', value)
    setParams(next, { replace: true })
  }

  return (
    <div
      data-locale-surface
      className="mx-auto max-w-6xl px-5 pt-32 pb-24 md:px-8 md:pt-40"
    >
      <header className="border-b border-line pb-10">
        <h1
          ref={titleRef}
          data-reveal
          className="font-sans text-mega leading-[0.9] font-bold tracking-tight uppercase wdth-expanded"
        >
          {t.blog.title}
        </h1>

        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:items-end">
          <p className="max-w-xl text-base leading-relaxed text-pretty text-bone-dim md:text-lg lg:col-span-5">
            {t.blog.lead}
          </p>
          {items.length > 0 && <JournalFigures items={items} topics={tags.length} />}
        </div>
      </header>

      {/* ─── Filters ─────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-b border-line py-5">
          {tags.length > 0 && (
            <FilterGroup
              label={t.blog.filters.allTags}
              options={[
                { value: '', label: t.blog.filters.allTags },
                ...tags.map(([tag, count]) => ({ value: tag, label: tag, count })),
              ]}
              active={tagFilter}
              onSelect={setTagFilter}
            />
          )}

          <p
            aria-live="polite"
            className="ml-auto flex items-center gap-5 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase"
          >
            {t.blog.filters.results(filtered.length)}
            {hasFilters && (
              <button
                type="button"
                onClick={() => setTagFilter('')}
                className="min-h-8 text-ember uppercase underline-offset-4 hover:underline"
              >
                {t.blog.filters.clear}
              </button>
            )}
          </p>
        </div>
      )}

      {/* ─── Body ────────────────────────────────────────────────── */}
      {status === 'loading' && <LedgerSkeleton label={t.blog.loading} />}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <p className="font-display text-2xl text-bone-dim">{t.blog.error}</p>
          <button
            type="button"
            onClick={retry}
            className="border border-bone/30 px-4 py-2 font-mono text-[11px] tracking-[0.18em] text-bone uppercase transition-colors hover:border-ember hover:text-ember"
          >
            {t.blog.retry}
          </button>
        </div>
      )}

      {status === 'ready' && filtered.length === 0 && (
        <EmptyJournal
          filtered={hasFilters && items.length > 0}
          onClear={() => setTagFilter('')}
        />
      )}

      {status === 'ready' && featured && (
        <div className="mt-14">
          <FeaturedPostCard
            post={featured.entry.post}
            ordinal={ordinals.get(featured.entry.canonicalSlug)}
            lang={displayLang}
            href={featured.href}
            availableLangs={featured.entry.availableLangs}
            canonicalSlug={featured.entry.canonicalSlug}
          />
        </div>
      )}

      {status === 'ready' && rest.length > 0 && (
        <ul className="mt-16 border-t border-line" key={`${displayLang}-${tagFilter}`}>
          {rest.map((item, index) => (
            <PostRow
              key={item.entry.canonicalSlug}
              post={item.entry.post}
              ordinal={ordinals.get(item.entry.canonicalSlug) ?? 0}
              index={index}
              lang={displayLang}
              href={item.href}
              availableLangs={item.entry.availableLangs}
              canonicalSlug={item.entry.canonicalSlug}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * The lead slot goes to an explicitly featured post, otherwise to the newest
 * one — the list is already sorted by `publishedAt` desc.
 */
function splitFeatured(items: IndexItem[]): [IndexItem | undefined, ...IndexItem[]] {
  if (items.length === 0) return [undefined]
  const index = Math.max(
    0,
    items.findIndex((item) => item.entry.post.featured),
  )
  return [items[index], ...items.filter((_, i) => i !== index)]
}

/* ─── Masthead figures ──────────────────────────────────────────────────── */

/**
 * The notebook's own numbers — how many unique entries, on how many topics,
 * how much reading, and when the last one went in.
 */
function JournalFigures({ items, topics }: { items: IndexItem[]; topics: number }) {
  const { t, locale } = useLanguage()
  const minutes = items.reduce((sum, item) => sum + (item.readingMinutes || 0), 0)
  const latest = items.reduce<string | null>(
    (best, { entry }) =>
      entry.post.publishedAt && (!best || entry.post.publishedAt > best)
        ? entry.post.publishedAt
        : best,
    null,
  )

  return (
    <dl className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-[1fr_1fr_1.25fr_1.7fr] lg:col-span-7">
      <Figure label={t.blog.stats.entries}>
        <CountUp value={items.length} />
      </Figure>
      <Figure label={t.blog.stats.topics}>
        <CountUp value={topics} />
      </Figure>
      <Figure label={t.blog.stats.reading}>
        <CountUp value={minutes} format={t.blog.stats.minutes} />
      </Figure>
      <Figure label={t.blog.stats.updated}>
        {latest ? <time dateTime={latest}>{formatPostDateCompact(latest, locale)}</time> : '—'}
      </Figure>
    </dl>
  )
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-ink px-4 py-4">
      <dt className="font-mono text-[10px] tracking-[0.18em] text-smoke uppercase">{label}</dt>
      <dd className="mt-2 font-display text-2xl leading-none whitespace-nowrap text-bone tabular-nums">
        {children}
      </dd>
    </div>
  )
}

/**
 * Counts up to `value` once, on mount. The real number is what React renders
 * (and what a reader without JS or with reduced motion sees); the count runs
 * over it by writing straight to the text node.
 */
function CountUp({ value, format = String }: { value: number; format?: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = usePrefersReducedMotion()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || reduced || value <= 0) return
    let frame = 0
    const started = performance.now()
    const duration = 900
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 4)
      el.textContent = format(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    el.textContent = format(0)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      el.textContent = format(value)
    }
  }, [value, format, reduced])

  return <span ref={ref}>{format(value)}</span>
}

/* ─── Filters ───────────────────────────────────────────────────────────── */

function FilterGroup({
  label,
  options,
  active,
  onSelect,
}: {
  label: string
  options: { value: string; label: string; count?: number }[]
  active: string
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const visible = open ? options : options.slice(0, 6)

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      {visible.map((option) => (
        <button
          key={option.value || 'all'}
          type="button"
          onClick={() => onSelect(option.value)}
          aria-pressed={active === option.value}
          className={cn(
            'flex min-h-8 items-center gap-2 border px-3 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors duration-300',
            active === option.value
              ? 'border-ember text-ember'
              : 'border-line text-bone-dim hover:border-bone/40 hover:text-bone',
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span className={active === option.value ? 'text-ember/70' : 'text-smoke'}>
              {option.count}
            </span>
          )}
        </button>
      ))}
      {options.length > 6 && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-h-8 px-1 font-mono text-[10px] tracking-[0.18em] text-smoke uppercase hover:text-ember"
        >
          {open ? '−' : `+${options.length - 6}`}
        </button>
      )}
    </div>
  )
}

/* ─── States ────────────────────────────────────────────────────────────── */

/** Three ruled rows the height of real ones, so the list arrives without a jump. */
function LedgerSkeleton({ label }: { label: string }) {
  return (
    <div role="status" className="mt-16 border-t border-line">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          aria-hidden
          className="grid animate-pulse gap-x-8 gap-y-3 border-b border-line py-8 md:grid-cols-[7.5rem_minmax(0,1fr)_9.5rem] lg:grid-cols-[8.5rem_minmax(0,1fr)_11.5rem]"
        >
          <span className="h-3 w-16 bg-line" />
          <span className="space-y-3">
            <span className="block h-7 w-3/4 bg-line" />
            <span className="block h-3 w-full max-w-xl bg-line/70" />
            <span className="block h-3 w-1/2 bg-line/70" />
          </span>
          <span className="aspect-[16/10] bg-line/60 max-md:hidden" />
        </div>
      ))}
    </div>
  )
}

/**
 * Nothing to list. With no entries at all it is a blank page of the notebook —
 * an unmapped plate, and the two ways to hear about the first entry. With
 * filters on, the way out is to clear them.
 */
function EmptyJournal({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  const { t } = useLanguage()

  return (
    <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-14">
      <div>
        <p className="max-w-md font-display text-[clamp(1.75rem,3.2vw,2.75rem)] leading-[1.12] text-balance text-bone">
          {t.blog.empty}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-[11px] tracking-[0.18em] uppercase">
          {filtered ? (
            <button
              type="button"
              onClick={onClear}
              className="min-h-11 text-ember uppercase underline-offset-4 hover:underline"
            >
              {t.blog.filters.clear}
            </button>
          ) : (
            <>
              <a
                href="/rss.xml"
                className="group/link inline-flex min-h-11 items-center gap-3 text-bone transition-colors hover:text-ember"
              >
                <span className="h-px w-8 bg-current transition-[width] duration-500 ease-out-expo group-hover/link:w-14" />
                {t.blog.rss}
              </a>
              <Link
                to="/"
                className="inline-flex min-h-11 items-center text-bone-dim transition-colors hover:text-ember"
              >
                {t.header.backHome}
              </Link>
            </>
          )}
        </div>
      </div>
      <PostPlate
        seed="notas-de-campo"
        motion="drift"
        className="aspect-[16/10] border border-line"
      />
    </div>
  )
}
