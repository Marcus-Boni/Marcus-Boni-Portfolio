import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { FeaturedPostCard, PostRow } from '@/blog/components/PostCard'
import { useBlogIndexHead } from '@/blog/lib/seo'
import { usePostList } from '@/blog/usePosts'
import type { PostMeta } from '@/blog/types'
import { useScrollReveal } from '@/hooks/useScrollReveal'
import { useLanguage } from '@/i18n/LanguageContext'
import type { Locale } from '@/i18n/translations'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'

type LangFilter = Locale | 'all'

/**
 * The blog index.
 *
 * Filters live in the URL (`?lang=pt&tag=react`) so a filtered view is
 * shareable and survives a refresh. Filtering itself is done in memory over
 * the already-fetched list — no extra Firestore reads, no spinner between
 * clicks.
 */
export function BlogIndex() {
  const { t, locale } = useLanguage()
  const { posts, status, retry } = usePostList()
  const [params, setParams] = useSearchParams()
  const titleRef = useScrollReveal<HTMLHeadingElement>({ immediate: true })

  const langFilter = (params.get('lang') ?? 'all') as LangFilter
  const tagFilter = params.get('tag') ?? ''

  useBlogIndexHead(t.blog.title, t.blog.lead)

  useEffect(() => {
    trackEvent('blog_index_view')
  }, [])

  const tags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const post of posts) {
      for (const tag of post.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag)
  }, [posts])

  const filtered = useMemo(
    () =>
      posts.filter(
        (post) =>
          (langFilter === 'all' || post.lang === langFilter) &&
          (!tagFilter || post.tags.includes(tagFilter)),
      ),
    [posts, langFilter, tagFilter],
  )

  const [featured, ...rest] = splitFeatured(filtered)
  const hasFilters = langFilter !== 'all' || Boolean(tagFilter)

  const setFilter = (key: 'lang' | 'tag', value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pt-32 pb-24 md:px-8 md:pt-40">
      <header className="border-b border-line pb-10">
        <p className="font-mono text-[11px] tracking-[0.3em] text-ember uppercase">
          {t.blog.label}
        </p>
        <h1
          ref={titleRef}
          data-reveal
          className="mt-5 font-sans text-mega leading-[0.9] font-bold tracking-tight uppercase wdth-expanded"
        >
          {t.blog.title}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-bone-dim md:text-lg">
          {t.blog.lead}
        </p>
      </header>

      {/* ─── Filters ─────────────────────────────────────────────── */}
      {posts.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 border-b border-line py-5">
          <FilterGroup
            label={t.blog.filters.language}
            options={[
              { value: 'all', label: t.blog.filters.all },
              { value: 'pt', label: 'PT' },
              { value: 'en', label: 'EN' },
            ]}
            active={langFilter}
            onSelect={(value) => setFilter('lang', value)}
          />

          {tags.length > 0 && (
            <FilterGroup
              label={t.blog.filters.allTags}
              options={[
                { value: '', label: t.blog.filters.all },
                ...tags.map((tag) => ({ value: tag, label: tag })),
              ]}
              active={tagFilter}
              onSelect={(value) => setFilter('tag', value)}
            />
          )}

          <span className="ml-auto font-mono text-[10px] tracking-[0.2em] text-smoke uppercase">
            {t.blog.filters.results(filtered.length)}
          </span>

          {hasFilters && (
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="font-mono text-[10px] tracking-[0.2em] text-ember uppercase hover:underline"
            >
              {t.blog.filters.clear}
            </button>
          )}
        </div>
      )}

      {/* ─── Body ────────────────────────────────────────────────── */}
      {status === 'loading' && (
        <p className="py-24 text-center font-mono text-[11px] tracking-[0.2em] text-smoke uppercase">
          {t.blog.loading}
        </p>
      )}

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
        <p className="py-24 text-center font-display text-2xl text-bone-dim">
          {t.blog.empty}
        </p>
      )}

      {status === 'ready' && featured && (
        <div className="mt-14">
          <FeaturedPostCard post={featured} />
        </div>
      )}

      {status === 'ready' && rest.length > 0 && (
        <ul className="mt-16 border-t border-line" key={`${locale}-${langFilter}-${tagFilter}`}>
          {rest.map((post) => (
            <PostRow key={post.slug} post={post} />
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
function splitFeatured(posts: PostMeta[]): [PostMeta | undefined, ...PostMeta[]] {
  if (posts.length === 0) return [undefined]
  const index = Math.max(
    0,
    posts.findIndex((post) => post.featured),
  )
  return [posts[index], ...posts.filter((_, i) => i !== index)]
}

function FilterGroup({
  label,
  options,
  active,
  onSelect,
}: {
  label: string
  options: { value: string; label: string }[]
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
            'border px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] uppercase transition-colors duration-300',
            active === option.value
              ? 'border-ember text-ember'
              : 'border-line text-smoke hover:border-bone/40 hover:text-bone-dim',
          )}
        >
          {option.label}
        </button>
      ))}
      {options.length > 6 && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="font-mono text-[10px] tracking-[0.18em] text-smoke uppercase hover:text-ember"
        >
          {open ? '−' : `+${options.length - 6}`}
        </button>
      )}
    </div>
  )
}
