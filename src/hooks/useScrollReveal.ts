import { useLayoutEffect, useRef, type RefObject } from 'react'
import SplitType from 'split-type'

import { gsap, ScrollTrigger } from '@/animations/gsap'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

type RevealMode = 'lines' | 'chars' | 'words'

interface ScrollRevealOptions {
  /** What unit of text to stagger. Defaults to lines. */
  mode?: RevealMode
  /** Seconds between each unit. */
  stagger?: number
  /** Animate as soon as mounted instead of on scroll. */
  immediate?: boolean
  /** Delay before the tween starts (seconds). */
  delay?: number
  /** ScrollTrigger start position. */
  start?: string
}

/**
 * Splits the element's text with SplitType and reveals it with a masked
 * GSAP stagger, either immediately (hero) or when scrolled into view.
 * Returns a ref to attach to the text element (must have `data-reveal`).
 */
export function useScrollReveal<T extends HTMLElement = HTMLHeadingElement>(
  options: ScrollRevealOptions = {},
): RefObject<T | null> {
  const {
    mode = 'lines',
    stagger = 0.08,
    immediate = false,
    delay = 0,
    start = 'top 82%',
  } = options
  const ref = useRef<T>(null)
  const reduced = usePrefersReducedMotion()

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    if (reduced) {
      el.style.visibility = 'visible'
      return
    }

    const split = new SplitType(el, {
      types: mode === 'lines' ? 'lines' : ('lines, chars' as never),
      tagName: 'span',
    })
    const targets = mode === 'lines' ? split.lines : split.chars
    if (!targets || targets.length === 0) {
      el.style.visibility = 'visible'
      return
    }

    el.classList.add('split-line-mask')
    gsap.set(el, { visibility: 'visible' })
    gsap.set(targets, { yPercent: 115, rotate: mode === 'lines' ? 2 : 6 })

    const tween = gsap.to(targets, {
      yPercent: 0,
      rotate: 0,
      duration: 1.3,
      stagger,
      delay,
      scrollTrigger: immediate
        ? undefined
        : { trigger: el, start, once: true },
    })

    return () => {
      tween.scrollTrigger?.kill()
      tween.kill()
      split.revert()
    }
  }, [mode, stagger, immediate, delay, start, reduced])

  return ref
}

/**
 * Generic GSAP context scoped to a section element. Use for bespoke
 * timelines; everything created inside is reverted on unmount.
 */
export function useGsapScope<T extends HTMLElement = HTMLElement>(
  setup: (ctx: { root: T }) => void,
  deps: readonly unknown[] = [],
): RefObject<T | null> {
  const ref = useRef<T>(null)
  const reduced = usePrefersReducedMotion()

  useLayoutEffect(() => {
    const root = ref.current
    if (!root || reduced) return
    const ctx = gsap.context(() => setup({ root }), root)
    return () => ctx.revert()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, ...deps])

  return ref
}

export { ScrollTrigger }
