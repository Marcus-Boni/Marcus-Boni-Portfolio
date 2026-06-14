import { useEffect, useRef, useState } from 'react'

export interface HeaderState {
  /** True once scrolled away from the very top — switches the bar to glass. */
  scrolled: boolean
  /** True when the bar should slide out of view (downward scroll, past the fold). */
  hidden: boolean
}

const TOP_THRESHOLD = 16
const HIDE_AFTER = 160

/**
 * Drives the scroll-aware header. `scrolled` toggles the glassmorphism
 * background; `hidden` slides the bar away on downward scroll and snaps it
 * back on the way up. Reads native window scroll — Lenis root mode drives the
 * real document scroll, so this stays accurate with smooth scroll and the
 * reduced-motion fallback alike.
 *
 * @param forceVisible keep the bar pinned regardless of scroll (e.g. menu open)
 */
export function useScrollHeader(forceVisible: boolean): HeaderState {
  const [state, setState] = useState<HeaderState>({ scrolled: false, hidden: false })
  const lastScroll = useRef(0)
  const ticking = useRef(false)

  useEffect(() => {
    const evaluate = () => {
      ticking.current = false
      const scroll = window.scrollY
      const prev = lastScroll.current
      lastScroll.current = scroll

      const scrolled = scroll > TOP_THRESHOLD
      const goingDown = scroll > prev

      setState((current) => {
        let hidden = current.hidden
        if (forceVisible || !scrolled) hidden = false
        else if (goingDown && scroll > HIDE_AFTER) hidden = true
        else if (!goingDown) hidden = false

        if (current.scrolled === scrolled && current.hidden === hidden) return current
        return { scrolled, hidden }
      })
    }

    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(evaluate)
    }

    // sync immediately so a deep-linked / restored scroll position is correct
    evaluate()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [forceVisible])

  return state
}
