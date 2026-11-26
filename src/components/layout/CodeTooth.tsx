import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type { ToothTile } from '@/animations/codeField'
import type { SectionId } from '@/data/profile'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useHasFinePointer, useIsDesktop } from '@/hooks/useMediaQuery'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/utils'

/** How close to a page edge the pointer has to be for there to be glyphs to warm. */
const REACH = 420
/** How long the margins take to fade out, and then back in. */
const FADE_MS = 450

const SECTIONS = 'src/components/sections'
/** The component each section of the home is made of. */
const COMPONENT: Partial<Record<SectionId, string>> = {
  about: 'About',
  work: 'Work',
  experience: 'Experience',
  craft: 'Stack',
  contact: 'Contact',
}
/** Their sources as text, each fetched only when its section is reached. */
const sources = import.meta.glob<string>('/src/components/sections/*.tsx', {
  query: '?raw',
  import: 'default',
})

/** A tile, and the file it prints when that is worth naming. */
type Print = ToothTile & { path?: string }

/**
 * Code tooth: the page's margins carry a sparse, fixed print of the site's own
 * source, and the glyphs nearest the pointer warm to ember.
 *
 * On the home each section prints the component it is made of, and the right
 * edge names the file, the way the rail names the section on the left. The
 * print changes hands with a fade as a section crosses the middle of the
 * screen; anywhere else (the hero, the journal) it is the field's own engine.
 *
 * It holds still. The stylesheet does the drawing (`code-tooth` masks a flat
 * token colour with the tile), so it follows the colour scheme with no repaint;
 * the script only rasterizes a tile per file and reports where the pointer is.
 * Below 1024px there are no margins to print in, so nothing mounts. `quiet` is
 * for reading surfaces.
 */
export function CodeTooth({ quiet = false }: { quiet?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  // what the margins hold, and what they should hold once the fade is through
  const [shown, setShown] = useState<Print | null>(null)
  const [wanted, setWanted] = useState<Print | null>(null)
  const margins = useIsDesktop()
  const finePointer = useHasFinePointer()
  const reduced = usePrefersReducedMotion()
  const component = COMPONENT[useActiveSection()]

  useEffect(() => {
    if (!margins) return
    let mounted = true
    const path = component && `${SECTIONS}/${component}.tsx`
    // the engine is the hero's chunk: on the home it is already loaded
    void Promise.all([import('@/animations/codeField'), path ? sources[`/${path}`]() : undefined])
      .then(([engine, source]) => engine.toothTile(source))
      .then((tile) => {
        if (!mounted || !tile) return
        const print = { ...tile, path }
        setWanted(print)
        // nothing to fade from, or no fade wanted: it is simply there
        setShown((current) => (current && !reduced ? current : print))
      })
    return () => {
      mounted = false
    }
  }, [margins, component, reduced])

  // The margins fade out in CSS, then the next file takes them and they fade
  // back in. A timer, not `transitionend`: that event never comes on a tab in
  // the background, and the margins would stay out.
  useEffect(() => {
    if (!wanted || !shown || wanted.url === shown.url) return
    const timer = window.setTimeout(() => setShown(wanted), FADE_MS)
    return () => window.clearTimeout(timer)
  }, [wanted, shown])

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
  }, [finePointer, shown, margins])

  if (!margins || !shown) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 transition-opacity ease-out-expo motion-reduce:transition-none"
      style={{
        opacity: shown.url === wanted?.url ? 1 : 0,
        transitionDuration: `${FADE_MS}ms`,
      }}
    >
      <div
        ref={ref}
        className={cn('code-tooth', quiet && 'opacity-60')}
        style={
          {
            '--tooth': `url(${shown.url})`,
            '--tooth-size': `${shown.width}px ${shown.height}px`,
            // the glyphs clear a slot for the file name
            '--tooth-slot': shown.path ? '56px' : '0px',
          } as CSSProperties
        }
      >
        <div className="code-tooth-warm" />
      </div>
      {shown.path && (
        <span className="absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[10px] leading-none tracking-[0.12em] whitespace-nowrap text-smoke [writing-mode:vertical-rl]">
          {shown.path}
        </span>
      )}
    </div>
  )
}
