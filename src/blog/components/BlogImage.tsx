import { useState } from 'react'

import type { MediaRef } from '@/blog/types'
import { cn } from '@/lib/utils'

interface BlogImageProps {
  media: MediaRef
  /** `sizes` hint; defaults to the article measure. */
  sizes?: string
  className?: string
  /** Skip lazy-loading for the cover, which is usually the LCP element. */
  priority?: boolean
}

/**
 * Responsive image with a blur-up placeholder.
 *
 * The LQIP is a ~400-byte data URI generated at upload time, painted as a
 * scaled background under the real image, so there is something to look at
 * immediately and nothing to fetch for it. `width`/`height` come from the
 * upload too, which is what keeps cumulative layout shift at zero.
 */
export function BlogImage({
  media,
  sizes = '(min-width: 1024px) 720px, 100vw',
  className,
  priority = false,
}: BlogImageProps) {
  const [loaded, setLoaded] = useState(false)
  const srcSet = media.variants.map((v) => `${v.url} ${v.width}w`).join(', ')

  return (
    <span
      className={cn('relative block overflow-hidden bg-ink-soft', className)}
      style={{ aspectRatio: `${media.width} / ${media.height}` }}
    >
      {media.lqip && !loaded && (
        <span
          aria-hidden
          className="absolute inset-0 scale-110 blur-xl"
          style={{
            backgroundImage: `url(${media.lqip})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}
      <img
        src={media.src}
        srcSet={srcSet}
        sizes={sizes}
        width={media.width}
        height={media.height}
        alt={media.alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        className={cn(
          'relative h-full w-full object-cover transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </span>
  )
}

/**
 * Figure wrapper used inside the article body. Rendered as `<figure>` only
 * when there is a caption — an uncaptioned image needs no extra semantics.
 */
export function BlogFigure({ media }: { media: MediaRef }) {
  if (!media.caption) {
    return (
      <BlogImage media={media} className="my-10 border border-line" />
    )
  }
  return (
    <figure className="my-10">
      <BlogImage media={media} className="border border-line" />
      <figcaption className="mt-3 border-l border-ember/50 pl-3 font-mono text-[11px] leading-relaxed tracking-[0.08em] text-smoke">
        {media.caption}
      </figcaption>
    </figure>
  )
}
