import { useEffect, useRef } from 'react'

import { createPlateField, hashSeed, paintPlate } from '@/blog/lib/plate'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'

interface PostPlateProps {
  /** What the terrain is derived from — the post's slug. */
  seed: string
  /**
   * `still` paints once. `drift` lets the terrain move for as long as the
   * plate is on screen. Either way `active` (a hovered row, say) sets it
   * moving on demand.
   */
  motion?: 'still' | 'drift'
  active?: boolean
  className?: string
}

/** Device pixels a moving plate may repaint per frame before DPR is dropped. */
const MOVING_BUDGET = 260_000
const FRAME_MS = 1000 / 30

/**
 * A post's field plate, painted into a canvas.
 *
 * Painting waits until the plate is near the viewport, and the animation loop
 * only ever runs while the plate is visible, the tab is in front, and motion
 * is allowed — a list of forty entries costs nothing until it is looked at.
 */
export function PostPlate({ seed, motion = 'still', active = false, className }: PostPlateProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef(active)
  const wakeRef = useRef<(() => void) | null>(null)
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    activeRef.current = active
    if (active) wakeRef.current?.()
  }, [active])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const field = createPlateField(hashSeed(seed))
    const moves = !reduced
    let visible = false
    let frame = 0
    let last = 0
    let time = 0

    const paint = () => {
      const box = canvas.getBoundingClientRect()
      if (box.width < 2 || box.height < 2) return
      let ratio = Math.min(window.devicePixelRatio || 1, 2)
      const mayMove = moves && (motion === 'drift' || activeRef.current)
      if (mayMove && box.width * box.height * ratio * ratio > MOVING_BUDGET) {
        ratio = Math.max(0.75, Math.sqrt(MOVING_BUDGET / (box.width * box.height)))
      }
      const width = Math.round(box.width * ratio)
      const height = Math.round(box.height * ratio)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      paintPlate(ctx, width, height, field, time)
    }

    const tick = (now: number) => {
      frame = 0
      const running = visible && !document.hidden && moves &&
        (motion === 'drift' || activeRef.current)
      if (!running) {
        last = 0
        return
      }
      if (!last || now - last >= FRAME_MS) {
        time += last ? Math.min(0.1, (now - last) / 1000) : 0
        last = now
        paint()
      }
      frame = requestAnimationFrame(tick)
    }
    const wake = () => {
      if (!frame && visible && moves) frame = requestAnimationFrame(tick)
    }
    wakeRef.current = wake

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = visible
        visible = entry.isIntersecting
        if (visible && !wasVisible) {
          paint()
          wake()
        }
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(canvas)
    const resize = new ResizeObserver(() => {
      if (visible) paint()
    })
    resize.observe(canvas)
    document.addEventListener('visibilitychange', wake)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      resize.disconnect()
      document.removeEventListener('visibilitychange', wake)
      wakeRef.current = null
    }
  }, [seed, motion, reduced])

  return (
    <span aria-hidden className={cn('relative block overflow-hidden bg-ink-soft', className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </span>
  )
}
