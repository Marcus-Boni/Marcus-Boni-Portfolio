import { flushSync } from 'react-dom'

import type { Locale } from '@/i18n/translations'

/**
 * Authored directional View Transition for switching between Portuguese and
 * English across the portfolio and the journal.
 *
 * Mirrors `toggleTheme` in `src/lib/theme.ts`:
 *  • Uses the native View Transitions API when available so the old and new
 *    editions cross-dissolve simultaneously without a blank frame.
 *  • Sets a direction attribute (`to-en` / `to-pt`) so motion expresses travel
 *    between the two editions, accompanied by a brief ember signal hairline
 *    sweeping across the top edge.
 *  • Respects `prefers-reduced-motion` with a calm opacity cross-fade and zero
 *    spatial movement.
 *  • Falls back cleanly on browsers without `startViewTransition`.
 */

export type LocaleDirection = 'to-en' | 'to-pt'

let transitioning = false
let activeNonce = 0
let sweepTimer = 0
let fallbackTimer = 0

/** True while a language View Transition is capturing its new-state snapshot. */
export function isLocaleTransitioning(): boolean {
  return transitioning
}

/**
 * Triggers a razor-thin ember hairline sweep across the top edge of the
 * viewport, travelling in the direction of the edition switch. Pure DOM
 * element with pointer-events disabled so it stays above the view-transition
 * layer and cleans itself up automatically.
 */
function pulseSignalHairline(direction: LocaleDirection) {
  if (typeof document === 'undefined') return
  const existing = document.getElementById('locale-signal-sweep')
  existing?.remove()
  window.clearTimeout(sweepTimer)

  const bar = document.createElement('div')
  bar.id = 'locale-signal-sweep'
  bar.setAttribute('aria-hidden', 'true')
  bar.className = `locale-signal-sweep locale-signal-${direction}`
  document.body.appendChild(bar)

  sweepTimer = window.setTimeout(() => {
    bar.remove()
  }, 560)
}

/**
 * Wraps a language change (`commit`) in a directional editorial transition.
 * Safe in SSR, tests, and rapid repeated clicks.
 */
export function transitionLocale(next: Locale, commit: () => void): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    commit()
    return
  }

  const root = document.documentElement
  const direction: LocaleDirection = next === 'en' ? 'to-en' : 'to-pt'
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const nonce = ++activeNonce

  root.dataset.localeDir = direction

  // Browser without View Transitions API: commit immediately and animate the
  // incoming surface with the CSS fallback class.
  if (!('startViewTransition' in document)) {
    commit()
    if (!reduced) {
      root.classList.remove('locale-fallback')
      // Force reflow so rapid switches restart the CSS animation cleanly.
      void root.offsetWidth
      root.classList.add('locale-fallback')
      pulseSignalHairline(direction)
      window.clearTimeout(fallbackTimer)
      fallbackTimer = window.setTimeout(() => {
        if (nonce === activeNonce) root.classList.remove('locale-fallback')
      }, 480)
    }
    return
  }

  const modeClass = reduced ? 'locale-switch-reduced' : 'locale-switch'
  root.classList.remove('locale-switch', 'locale-switch-reduced', 'locale-fallback')
  root.classList.add(modeClass)
  transitioning = true

  if (!reduced) {
    pulseSignalHairline(direction)
  }

  const cleanup = () => {
    if (nonce !== activeNonce) return
    transitioning = false
    root.classList.remove('locale-switch', 'locale-switch-reduced')
  }

  try {
    const viewTransition = document.startViewTransition(() => {
      flushSync(commit)
    })
    void viewTransition.finished.catch(() => {}).finally(cleanup)
  } catch {
    commit()
    cleanup()
  }
}

/**
 * True only for a plain left-click without modifier keys, so Ctrl/Cmd/Shift
 * or middle-click on a `<Link>` keeps its native "open in new tab" behavior.
 */
export function isPlainLeftClick(event: {
  button: number
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  defaultPrevented: boolean
}): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}
