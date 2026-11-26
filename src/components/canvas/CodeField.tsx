import { useEffect, useLayoutEffect, useRef } from 'react'

import type { FieldState } from '@/animations/codeField'
import { gsap } from '@/animations/gsap'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { shouldSkipIntro } from '@/lib/defer'
import { isLocaleTransitioning } from '@/lib/locale-transition'
import { scrollState } from '@/lib/scroll-state'
import { useTheme } from '@/lib/theme'
import { clamp, lerp } from '@/lib/utils'

/** The moment of the current that readers who asked for no motion are shown. */
const STILL_AT = 46

type Engine = typeof import('@/animations/codeField')

/**
 * The hero's source field: a wall of this site's own code in Canvas 2D, lit
 * by a slow current (see `animations/codeField`).
 *
 * GSAP drives it through one plain state object. The wall prints once on
 * entry, the pointer lights and bends it, a fast scroll runs the veins hotter
 * and the canvas steps back as the hero leaves. The loop rides the GSAP ticker
 * (the clock Lenis and ScrollTrigger share) and only while the hero is on
 * screen. Under `prefers-reduced-motion` the settled wall paints once.
 *
 * This component ships with the page; the engine, which carries its own
 * source as text, arrives after the name has painted. Keep it that way round:
 * a lazy chunk that imports `@/animations/gsap` makes the bundler split the
 * entry (CLAUDE.md, pitfall 1).
 */
export function CodeField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rebuildRef = useRef<(() => void) | null>(null)
  const reduced = usePrefersReducedMotion()
  const theme = useTheme()

  // the palette is read when the wall is built
  useLayoutEffect(() => {
    rebuildRef.current?.()
  }, [theme])

  useEffect(() => {
    const canvas = canvasRef.current
    const hero = canvas?.closest('section')
    if (!canvas || !hero) return

    // A late load already shows the static shell, and a language switch is
    // mid view-transition: neither should watch the wall print again.
    const settled = reduced || shouldSkipIntro() || isLocaleTransitioning()
    const state: FieldState = { reveal: settled ? 1 : 0, lens: 0, x: 0, y: 0, energy: 0 }
    let engine: Engine | null = null
    let render: ReturnType<Engine['createCodeField']> = null
    let seconds = reduced ? STILL_AT : 0
    let visible = false
    let running = false
    let disposed = false

    const tick = (_time: number, delta: number, frame: number) => {
      // lagSmoothing is off (SmoothScroll), so a tab coming back reports one long frame
      seconds += Math.min(delta, 100) / 1000
      state.energy = lerp(state.energy, clamp(Math.abs(scrollState.velocity) / 60, 0, 1), 0.08)
      // at rest the current is slow enough for every other frame
      const resting = state.reveal >= 1 && state.lens < 0.01 && state.energy < 0.01
      if (resting && frame % 2) return
      render?.(seconds, state)
    }
    const sync = () => {
      const run = visible && !reduced && render !== null
      if (run === running) return
      running = run
      if (run) gsap.ticker.add(tick)
      else gsap.ticker.remove(tick)
    }

    const scope = gsap.context(() => {
      if (reduced) return
      gsap.to(canvas, {
        yPercent: 8,
        opacity: 0.3,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      })
    })

    let first = true
    const build = () => {
      if (disposed || !engine) return
      render = engine.createCodeField(canvas)
      render?.(seconds, state, !reduced)
      sync()
      if (first && render && state.reveal < 1) {
        const duration = engine.FIELD_PRINT_S
        scope.add(() => gsap.to(state, { reveal: 1, duration, ease: 'none' }))
      }
      first = false
    }
    rebuildRef.current = () => {
      if (!first) build()
    }
    void Promise.all([
      import('@/animations/codeField'),
      document.fonts.load('12px "Fragment Mono"'),
    ]).then(([loaded]) => {
      engine = loaded
      build()
    })

    const rebuild = gsap.delayedCall(0.15, build).pause()
    const resize = new ResizeObserver(() => {
      if (!first) rebuild.restart(true)
    })
    resize.observe(canvas)
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    observer.observe(canvas)

    const toX = gsap.quickTo(state, 'x', { duration: 0.5, ease: 'power3' })
    const toY = gsap.quickTo(state, 'y', { duration: 0.5, ease: 'power3' })
    const toLens = gsap.quickTo(state, 'lens', { duration: 0.8, ease: 'power2' })
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const box = canvas.getBoundingClientRect()
      const x = event.clientX - box.left
      const y = event.clientY - box.top
      if (state.lens < 0.01) {
        // arriving: the light comes up where the pointer is, not from a corner
        state.x = x
        state.y = y
      }
      toX(x)
      toY(y)
      toLens(1)
    }
    const onLeave = () => toLens(0)
    if (!reduced) {
      hero.addEventListener('pointermove', onMove, { passive: true })
      hero.addEventListener('pointerleave', onLeave)
    }

    return () => {
      disposed = true
      rebuildRef.current = null
      gsap.ticker.remove(tick)
      rebuild.kill()
      gsap.killTweensOf(state)
      scope.revert()
      resize.disconnect()
      observer.disconnect()
      hero.removeEventListener('pointermove', onMove)
      hero.removeEventListener('pointerleave', onLeave)
    }
  }, [reduced])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="hero-field pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
