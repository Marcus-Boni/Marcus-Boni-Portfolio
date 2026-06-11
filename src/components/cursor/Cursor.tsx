import { useEffect, useRef, useState } from 'react'

import { gsap } from '@/animations/gsap'
import { useHasFinePointer } from '@/hooks/useMediaQuery'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useLanguage } from '@/i18n/LanguageContext'
import { cn } from '@/lib/utils'

type CursorVariant = 'default' | 'link' | 'view' | 'drag' | 'hidden'

const RING_SIZE: Record<Exclude<CursorVariant, 'hidden'>, number> = {
  default: 26,
  link: 44,
  view: 84,
  drag: 84,
}

/**
 * DOM custom cursor: an ember dot trailed by a morphing ring. Sizing and
 * position are both GSAP-driven (a single animation system — CSS transitions
 * on the box would fight the transform and smear the ring). Reads
 * `data-cursor="view|drag|link"` from hovered targets via event delegation.
 */
export function Cursor() {
  const finePointer = useHasFinePointer()
  const reduced = usePrefersReducedMotion()
  const { t } = useLanguage()
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const [variant, setVariant] = useState<CursorVariant>('hidden')

  const enabled = finePointer && !reduced

  useEffect(() => {
    if (!enabled) return
    document.documentElement.classList.add('cursor-takeover')

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    gsap.set([dot, ring], { xPercent: -50, yPercent: -50, autoAlpha: 0 })
    gsap.set(ring, { width: RING_SIZE.default, height: RING_SIZE.default })

    const dotX = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3.out' })
    const dotY = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3.out' })
    const ringX = gsap.quickTo(ring, 'x', { duration: 0.4, ease: 'power3.out' })
    const ringY = gsap.quickTo(ring, 'y', { duration: 0.4, ease: 'power3.out' })

    const resolveVariant = (target: EventTarget | null): CursorVariant => {
      if (!(target instanceof Element)) return 'default'
      const tagged = target.closest<HTMLElement>('[data-cursor]')
      if (tagged) return (tagged.dataset.cursor as CursorVariant) ?? 'default'
      if (target.closest('a, button, [role="button"], label, input, textarea'))
        return 'link'
      return 'default'
    }

    let seen = false
    const onMove = (event: PointerEvent) => {
      if (!seen) {
        // first contact: jump to the pointer instead of flying in from 0,0
        seen = true
        gsap.set([dot, ring], { x: event.clientX, y: event.clientY })
        setVariant(resolveVariant(event.target))
      }
      dotX(event.clientX)
      dotY(event.clientY)
      ringX(event.clientX)
      ringY(event.clientY)
    }
    const onOver = (event: PointerEvent) => setVariant(resolveVariant(event.target))
    const onLeave = () => setVariant('hidden')
    const onEnter = (event: PointerEvent) => setVariant(resolveVariant(event.target))
    const onDown = () => gsap.to(ring, { scale: 0.82, duration: 0.2 })
    const onUp = () => gsap.to(ring, { scale: 1, duration: 0.35, ease: 'back.out(2)' })

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerover', onOver, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    document.documentElement.addEventListener('pointerenter', onEnter)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)

    return () => {
      document.documentElement.classList.remove('cursor-takeover')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerover', onOver)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      document.documentElement.removeEventListener('pointerenter', onEnter)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [enabled])

  // morph the ring with GSAP only — never CSS box transitions
  useEffect(() => {
    if (!enabled) return
    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    if (variant === 'hidden') {
      gsap.to([dot, ring], { autoAlpha: 0, duration: 0.25, overwrite: 'auto' })
      return
    }
    const size = RING_SIZE[variant]
    gsap.to(ring, {
      width: size,
      height: size,
      autoAlpha: 1,
      duration: 0.45,
      ease: 'back.out(1.6)',
      overwrite: 'auto',
    })
    gsap.to(dot, {
      autoAlpha: variant === 'view' || variant === 'drag' ? 0 : 1,
      duration: 0.2,
      overwrite: 'auto',
    })
  }, [variant, enabled])

  if (!enabled) return null

  const hasLabel = variant === 'view' || variant === 'drag'
  const label = variant === 'view' ? t.cursor.view : t.cursor.drag

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[100]">
      <div
        ref={dotRef}
        className="absolute top-0 left-0 size-1.5 rounded-full bg-ember"
      />
      <div
        ref={ringRef}
        className={cn(
          'absolute top-0 left-0 flex items-center justify-center overflow-hidden rounded-full border transition-colors duration-300',
          hasLabel
            ? 'border-ember bg-ink/75 backdrop-blur-[2px]'
            : 'border-bone/40 bg-transparent',
        )}
      >
        <span
          className={cn(
            'font-mono text-[10px] tracking-[0.22em] whitespace-nowrap text-ember transition-opacity duration-200',
            hasLabel ? 'opacity-100' : 'opacity-0',
          )}
        >
          {hasLabel ? label : ''}
        </span>
      </div>
    </div>
  )
}
