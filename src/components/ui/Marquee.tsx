import { Fragment } from 'react'

import { cn } from '@/lib/utils'

interface MarqueeProps {
  items: string[]
  className?: string
  /** Reverse the travel direction. */
  reverse?: boolean
  /** How many times to repeat the item sequence per loop half. */
  repeat?: number
}

/**
 * Infinite editorial marquee. Each loop half repeats the sequence enough
 * times to always exceed the viewport (no blank tail), and the duration
 * scales with content length so every marquee travels at the same speed.
 */
export function Marquee({ items, className, reverse = false, repeat = 4 }: MarqueeProps) {
  const sequence = Array.from({ length: repeat }, () => items).flat()

  const half = (ariaHidden: boolean) => (
    <div
      aria-hidden={ariaHidden || undefined}
      className="flex shrink-0 items-center"
    >
      {sequence.map((item, index) => (
        <Fragment key={`${item}-${index}`}>
          <span className="px-6 font-display text-[clamp(2rem,4.5vw,4rem)] leading-none whitespace-nowrap">
            {item}
          </span>
          <span className="text-ember" aria-hidden>
            ✦
          </span>
        </Fragment>
      ))}
    </div>
  )

  return (
    <div
      className={cn(
        'flex overflow-hidden border-y border-line py-5 select-none',
        className,
      )}
    >
      <div
        className="flex animate-marquee will-change-transform"
        style={{
          animationDuration: `${sequence.length * 2.4}s`,
          animationDirection: reverse ? 'reverse' : undefined,
        }}
      >
        {half(false)}
        {half(true)}
      </div>
    </div>
  )
}
