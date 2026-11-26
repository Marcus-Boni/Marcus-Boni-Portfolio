import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type { ToothTile } from '@/animations/codeField'
import { useHasFinePointer, useIsDesktop } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

/** How close to a page edge the pointer has to be for there to be glyphs to warm. */
const REACH = 420

/**
 * Code tooth: the page's margins carry a sparse, fixed print of the site's own
 * source, and the glyphs nearest the pointer warm to ember.
 *
 * It holds still. The stylesheet does the drawing (`code-tooth` masks a flat
 * token colour with the tile), so it follows the colour scheme with no repaint;
 * the script only rasterizes the tile once and reports where the pointer is.
 * Below 1024px there are no margins to print in, so nothing mounts. `quiet` is
 * for reading surfaces.
 */
export function CodeTooth({ quiet = false }: { quiet?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tile, setTile] = useState<ToothTile | null>(null)
  const margins = useIsDesktop()
  const finePointer = useHasFinePointer()

  useEffect(() => {
    if (!margins) return
    let mounted = true
    // the engine is the hero's chunk: on the home it is already loaded
    void import('@/animations/codeField')
      .then((module) => module.toothTile())
      .then((made) => {
        if (mounted) setTile(made)
      })
    return () => {
      mounted = false
    }
  }, [margins])

  useEffect(() => {
    const el = ref.current
    if (!el || !finePointer) return
    const onMove = (event: PointerEvent) => {
      const near = event.clientX < REACH || event.clientX > window.innerWidth - REACH
      el.style.setProperty('--tooth-x', near ? `${event.clientX}px` : '-999px')
      el.style.setProperty('--tooth-y', `${event.clientY}px`)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [finePointer, tile, margins])

  if (!margins || !tile) return null

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('code-tooth', quiet && 'opacity-60')}
      style={
        {
          '--tooth': `url(${tile.url})`,
          '--tooth-size': `${tile.width}px ${tile.height}px`,
        } as CSSProperties
      }
    >
      <div className="code-tooth-warm" />
    </div>
  )
}
