import { useCallback, useEffect, useRef } from 'react'

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const GLYPHS = '!<>-_\\/[]{}—=+*^?#·:.'

/**
 * Terminal-style text scramble for mono labels. Returns a ref to attach to the
 * text element plus a `scramble()` trigger (wire it to a hover/enter handler).
 * Characters settle left-to-right into the final string; leaving mid-flight is
 * fine — it always resolves to `text`. No-op under reduced motion.
 */
export function useScramble<T extends HTMLElement = HTMLSpanElement>(
  text: string,
  speed = 1,
) {
  const ref = useRef<T>(null)
  const raf = useRef(0)
  const reduced = usePrefersReducedMotion()

  // keep the DOM truthful on mount and whenever the source text changes
  useEffect(() => {
    if (ref.current) ref.current.textContent = text
  }, [text])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const scramble = useCallback(() => {
    const el = ref.current
    if (!el || reduced) return
    cancelAnimationFrame(raf.current)

    const queue = Array.from(text, (char, i) => ({
      char,
      start: Math.floor(Math.random() * 6),
      end: Math.floor(Math.random() * 6) + 6 + i,
    }))

    let frame = 0
    const tick = () => {
      let output = ''
      let done = 0
      for (const item of queue) {
        if (frame >= item.end) {
          done++
          output += item.char
        } else if (frame >= item.start) {
          output += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        } else {
          output += item.char
        }
      }
      el.textContent = output
      if (done === queue.length) return
      frame += speed
      raf.current = requestAnimationFrame(tick)
    }
    tick()
  }, [text, speed, reduced])

  return { ref, scramble }
}
