import { Link } from 'react-router-dom'

import { BlogImage } from '@/blog/components/BlogImage'
import { formatPostDate } from '@/blog/lib/text'
import type { PostMeta } from '@/blog/types'
import { HoverItalic } from '@/components/ui/HoverItalic'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

/** Mono metadata line shared by both card shapes. */
function PostMetaLine({ post, className }: { post: PostMeta; className?: string }) {
  const { locale, t } = useLanguage()
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] tracking-[0.2em] text-smoke uppercase',
        className,
      )}
    >
      <span>{formatPostDate(post.publishedAt, locale)}</span>
      <span aria-hidden className="text-line">
        /
      </span>
      <span>{t.blog.readingTime(post.readingMinutes)}</span>
      <span aria-hidden className="text-line">
        /
      </span>
      <span className="text-bone-dim">{post.lang.toUpperCase()}</span>
      {post.series && (
        <>
          <span aria-hidden className="text-line">
            /
          </span>
          <span className="text-ember">{post.series.title}</span>
        </>
      )}
    </p>
  )
}

/**
 * The lead slot on the index: full-bleed cover with the title over a ruled
 * baseline. Only ever rendered once, for the newest featured post.
 */
export function FeaturedPostCard({ post }: { post: PostMeta }) {
  const { t } = useLanguage()

  return (
    <Link
      to={`/blog/${post.slug}`}
      data-cursor="view"
      className="group block border-t border-line pt-6"
    >
      <p className="mb-5 font-mono text-[10px] tracking-[0.3em] text-ember uppercase">
        {t.blog.featured}
      </p>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        {post.cover ? (
          <BlogImage
            media={post.cover}
            priority
            sizes="(min-width: 1024px) 55vw, 100vw"
            className="border border-line transition-opacity duration-500 group-hover:opacity-90"
          />
        ) : (
          <div className="aspect-[16/10] border border-line bg-gradient-to-br from-ink-soft to-ink" />
        )}

        <div>
          <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] text-bone">
            <HoverItalic text={post.title} />
          </h2>
          {post.subtitle && (
            <p className="mt-4 max-w-lg text-base leading-relaxed text-bone-dim">
              {post.subtitle}
            </p>
          )}
          <PostMetaLine post={post} className="mt-6" />
        </div>
      </div>
    </Link>
  )
}

/**
 * Ruled index row. The whole row is the target; the arrow and the italic
 * cross-fade carry the affordance instead of a button.
 */
export function PostRow({ post }: { post: PostMeta }) {
  return (
    <li>
      <Link
        to={`/blog/${post.slug}`}
        data-cursor="view"
        className="group flex flex-col gap-4 border-b border-line py-8 transition-colors duration-500 hover:border-ember/40 md:flex-row md:items-baseline md:gap-10"
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.1] text-bone">
            <HoverItalic text={post.title} />
          </h3>
          {post.excerpt && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-dim md:text-[15px]">
              {post.excerpt}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <PostMetaLine post={post} />
            {post.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="border border-line px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-smoke uppercase"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <span
          aria-hidden
          className="shrink-0 self-start font-display-italic text-3xl text-line transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-ember md:self-center"
        >
          ↗
        </span>
      </Link>
    </li>
  )
}
