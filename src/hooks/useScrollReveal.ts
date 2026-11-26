import { useLayoutEffect, useRef, type RefObject } from 'react'
import SplitType from 'split-type'

import { gsap, ScrollTrigger } from '@/animations/gsap'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { shouldSkipIntro } from '@/lib/defer'
import { isLocaleTransitioning } from '@/lib/locale-transition'

/**
 * `ink` is the odd one out: instead of a one-shot entrance it ties the text to
 * the scroll, word by word — ghosted until read, inked once passed.
 */
type RevealMode = 'lines' | 'chars' | 'words' | 'ink'

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

    if (reduced || (immediate && (shouldSkipIntro() || isLocaleTransitioning()))) {
      // Reduced motion, late hydration, or an active language View Transition:
      // keep the headline immediately visible so the View Transition captures
      // the crisp new edition instead of a blank hidden frame.
      el.style.visibility = 'visible'
      return
    }

    if (mode === 'ink') {
      // Words only: a word split survives reflow, so no re-split on resize.
      const split = new SplitType(el, { types: 'words', tagName: 'span' })
      const words = split.words
      if (!words || words.length === 0) {
        el.style.visibility = 'visible'
        return
      }
      gsap.set(el, { visibility: 'visible' })
      const tween = gsap.fromTo(
        words,
        { opacity: 0.16 },
        {
          opacity: 1,
          ease: 'none',
          duration: 0.6,
          stagger: { each: 0.12 },
          scrollTrigger: { trigger: el, start, end: 'bottom 58%', scrub: 0.6 },
        },
      )
      return () => {
        tween.scrollTrigger?.kill()
        tween.kill()
        split.revert()
      }
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
