import { useEffect, useState } from 'react'

const INTERACTION_EVENTS = [
  'pointermove',
  'pointerdown',
  'wheel',
  'touchstart',
  'keydown',
  'scroll',
] as const

/**
 * Returns `false` on first paint, flipping to `true` on the first user
 * interaction — or, for a visitor who never interacts, after `fallbackDelay`.
 *
 * Used to defer heavy, non-critical work (the WebGL hero) out of the initial
 * load window: parsing the three.js chunk and compiling shaders then happens
 * *after* the page is interactive, so it no longer inflates Total Blocking
 * Time. The static fallback covers the gap. The delay is a fixed timer rather
 * than `requestIdleCallback` so the work lands predictably after TTI (an idle
 * callback can fire while the load is still being measured).
 */
export function useDeferredActivation(fallbackDelay = 2000): boolean {
  const [active, setActive] = useState(false)

  useEffect(() => {
    const activate = () => {
      cleanup()
      setActive(true)
    }

    const cleanup = () => {
      for (const event of INTERACTION_EVENTS) {
        window.removeEventListener(event, activate)
      }
      window.clearTimeout(timerId)
    }

    for (const event of INTERACTION_EVENTS) {
      window.addEventListener(event, activate, { passive: true, once: true })
    }
    const timerId = window.setTimeout(activate, fallbackDelay)

    return cleanup
  }, [fallbackDelay])

  return active
}
