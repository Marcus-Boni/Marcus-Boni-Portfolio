import { ReactLenis, type LenisRef } from 'lenis/react'
import { useEffect, useRef, type ReactNode } from 'react'

import { gsap, ScrollTrigger } from '@/animations/gsap'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { scrollState } from '@/lib/scroll-state'

interface SmoothScrollProps {
  children: ReactNode
}

/**
 * Lenis smooth-scroll root, driven by the GSAP ticker so ScrollTrigger,
 * Lenis, and the WebGL loop all share one clock.
 */
export function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<LenisRef>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (reduced) return

    function update(time: number) {
      lenisRef.current?.lenis?.raf(time * 1000)
    }
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)

    const lenis = lenisRef.current?.lenis
    const onScroll = () => {
      if (!lenis) return
      scrollState.velocity = lenis.velocity
      scrollState.progress = lenis.progress
      scrollState.scroll = lenis.scroll
      ScrollTrigger.update()
    }
    lenis?.on('scroll', onScroll)

    return () => {
      gsap.ticker.remove(update)
      lenis?.off('scroll', onScroll)
    }
  }, [reduced])

  if (reduced) return <>{children}</>

  return (
    <ReactLenis
      root
      ref={lenisRef}
      options={{
        autoRaf: false,
        lerp: 0.09,
        wheelMultiplier: 1,
        touchMultiplier: 1.4,
        anchors: true,
      }}
    >
      {children}
    </ReactLenis>
  )
}
