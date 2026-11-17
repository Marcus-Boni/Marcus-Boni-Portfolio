import { Fragment, useEffect, useRef } from 'react'
import { useLenis } from 'lenis/react'

import { gsap } from '@/animations/gsap'
import { cn } from '@/lib/utils'

interface MarqueeProps {
  items: string[]
  className?: string
  /** Reverse the travel direction. */
  reverse?: boolean
  /** How many times to repeat the item sequence per loop half. */
  repeat?: number
}

/** Extra playback speed per unit of scroll velocity, and its ceiling. */
const BOOST = 0.085
const MAX_RATE = 7
/** Degrees of slant per unit of scroll velocity, and its ceiling. */
const SLANT = 0.14
const MAX_SLANT = 9

/**
 * Infinite editorial marquee. Each loop half repeats the sequence enough
 * times to always exceed the viewport (no blank tail), and the duration
 * scales with content length so every marquee travels at the same speed.
 *
 * The strip also answers the scroll: the faster the page moves, the faster
 * the type runs and the further it leans into the direction of travel. The
 * loop itself stays a compositor-driven CSS animation — only its playback
 * rate and one skew are touched per frame, and only while it is on screen.
 */
export function Marquee({ items, className, reverse = false, repeat = 4 }: MarqueeProps) {
  const sequence = Array.from({ length: repeat }, () => items).flat()
  const rootRef = useRef<HTMLDivElement>(null)
  const leanRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lenis = useLenis()

  useEffect(() => {
    const root = rootRef.current
    const lean = leanRef.current
    const track = trackRef.current
    if (!root || !lean || !track || !lenis) return

    let rate = 1
    let slant = 0
    const frame = () => {
      const velocity = lenis.velocity
      const targetRate = Math.min(MAX_RATE, 1 + Math.abs(velocity) * BOOST)
      const direction = reverse ? -1 : 1
      const targetSlant =
        Math.max(-MAX_SLANT, Math.min(MAX_SLANT, velocity * SLANT)) * -direction
      rate += (targetRate - rate) * 0.12
      slant += (targetSlant - slant) * 0.12
      const animation = track.getAnimations()[0]
      if (animation) animation.playbackRate = rate
      lean.style.transform = Math.abs(slant) < 0.01 ? '' : `skewX(${slant.toFixed(2)}deg)`
    }

    let running = false
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting === running) return
      running = entry.isIntersecting
      if (running) gsap.ticker.add(frame)
      else gsap.ticker.remove(frame)
    })
    observer.observe(root)

    return () => {
      observer.disconnect()
      gsap.ticker.remove(frame)
      lean.style.transform = ''
    }
  }, [lenis, reverse])

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
      ref={rootRef}
      className={cn(
        'flex overflow-hidden border-y border-line py-5 select-none',
        className,
      )}
    >
      <div ref={leanRef} className="flex">
        <div
          ref={trackRef}
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
    </div>
  )
}
