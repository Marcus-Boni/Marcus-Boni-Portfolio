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
 * interaction (pointer, touch, wheel, key or scroll).
 *
 * Used to keep heavy, non-critical work — the WebGL hero above all — out of
 * the load window entirely: parsing the three.js chunk and compiling shaders
 * only happens once the visitor actually engages with the page, so it can
 * never inflate Total Blocking Time or delay Time to Interactive. A visitor
 * who never interacts simply keeps the static backdrop, which is also the
 * reduced-motion experience.
 *
 * An optional `fallbackDelay` (ms) can force activation on a timer for cases
 * where the deferred work must eventually run without input — but note that
 * any timer short enough to matter tends to land back inside the load trace,
 * so the default is interaction-only.
 */
export function useDeferredActivation(fallbackDelay?: number): boolean {
  const [active, setActive] = useState(false)

  useEffect(() => {
    let timerId: number | undefined

    const activate = () => {
      cleanup()
      setActive(true)
    }

    const cleanup = () => {
      for (const event of INTERACTION_EVENTS) {
        window.removeEventListener(event, activate)
      }
      if (timerId !== undefined) window.clearTimeout(timerId)
    }

    for (const event of INTERACTION_EVENTS) {
      window.addEventListener(event, activate, { passive: true, once: true })
    }
    if (fallbackDelay !== undefined) {
      timerId = window.setTimeout(activate, fallbackDelay)
    }

    return cleanup
  }, [fallbackDelay])

  return active
}
