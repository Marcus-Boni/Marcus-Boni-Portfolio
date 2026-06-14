import { cn } from '@/lib/utils'

interface HoverItalicProps {
  /** The word or phrase to cross-fade from upright to italic. */
  text: string
  /** Wrapper classes — sizing, base colour, optional transforms. */
  className?: string
}

/**
 * Smoothly cross-fades a serif label from upright to italic + ember when a
 * `group` ancestor is hovered.
 *
 * `font-style` / `font-family` are not transitionable, so swapping to the
 * italic face directly snaps instantly. Instead we stack both faces in a single
 * grid cell — the cell sizes to the wider italic copy so there's no layout
 * shift — and ease their opacities in opposite directions. Under reduced motion
 * the global transition reset turns this back into a clean instant swap.
 */
export function HoverItalic({ text, className }: HoverItalicProps) {
  return (
    <span className={cn('inline-grid', className)}>
      <span className="col-start-1 row-start-1 font-display transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-0">
        {text}
      </span>
      <span
        aria-hidden
        className="col-start-1 row-start-1 font-display-italic text-ember opacity-0 transition-opacity duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}
