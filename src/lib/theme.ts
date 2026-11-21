import { useSyncExternalStore } from 'react'

/**
 * Colour scheme: which one is showing, and the reader's override of it.
 *
 * CSS does the theming (see "Colour scheme" in `styles/index.css`). This
 * module only moves the reader's choice between `localStorage`, the
 * `<meta name="color-scheme">` the stylesheet reads, and whatever paints
 * outside the cascade: canvases, the WebGL field, the browser's own chrome.
 */

export type Theme = 'light' | 'dark'

const KEY = 'color-scheme'
const LIGHT = '(prefers-color-scheme: light)'

/**
 * What to store after the reader flips the scheme, `null` meaning "follow the
 * system again". The control has two positions: the system's scheme and its
 * opposite. Landing back on the system's is an undo, so nothing stays pinned
 * and the site keeps following the system when it changes later.
 */
export function nextOverride(showing: Theme, system: Theme): Theme | null {
  const target: Theme = showing === 'dark' ? 'light' : 'dark'
  return target === system ? null : target
}

/** Without `light-dark()` the stylesheet has one scheme, so there is nothing to switch. */
export const themeSupported =
  typeof CSS !== 'undefined' && CSS.supports('color', 'light-dark(#000, #fff)')

const meta = () =>
  document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]')

const systemTheme = (): Theme =>
  window.matchMedia(LIGHT).matches ? 'light' : 'dark'

export function currentTheme(): Theme {
  if (!themeSupported) return 'dark'
  const pinned = meta()?.content
  return pinned === 'light' || pinned === 'dark' ? pinned : systemTheme()
}

/**
 * What `var(token)` paints as on `el` right now, as `rgb(r, g, b)`. A canvas
 * cannot be handed the token itself: read from script it is still the whole
 * `light-dark()` pair.
 */
export function paintColor(el: HTMLElement, token: string): string {
  const before = el.style.color
  el.style.color = `var(${token})`
  const color = getComputedStyle(el).color
  el.style.color = before
  return color
}

const listeners = new Set<() => void>()

/**
 * Tells everyone, and hands the page colour to the browser's own chrome
 * (mobile toolbars). The `theme-color` pair in the HTML covers the system's
 * scheme by media query; a pinned one is beyond its reach.
 */
function emit() {
  const page = getComputedStyle(document.documentElement).backgroundColor
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((tag) => (tag.content = page))
  listeners.forEach((listener) => listener())
}

function pin(theme: Theme | null) {
  const tag = meta()
  if (tag) tag.content = theme ?? 'light dark'
  emit()
}

if (typeof window !== 'undefined' && themeSupported) {
  window.matchMedia(LIGHT).addEventListener('change', emit)
  // another tab changed the override
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return
    pin(event.newValue === 'light' || event.newValue === 'dark' ? event.newValue : null)
  })
  if (currentTheme() !== systemTheme()) emit()
}

/**
 * Flips the scheme. With an `origin` (viewport coordinates of the control that
 * asked) and motion allowed, the new scheme floods out from that point as a
 * view transition.
 */
export function toggleTheme(origin?: { x: number; y: number }) {
  const override = nextOverride(currentTheme(), systemTheme())
  const root = document.documentElement
  const commit = () => {
    try {
      if (override) localStorage.setItem(KEY, override)
      else localStorage.removeItem(KEY)
    } catch {
      // storage blocked: the scheme still changes, it just is not remembered
    }
    pin(override)
  }
  const done = () => root.classList.remove('theme-switch')

  root.classList.add('theme-switch')
  if (
    !origin ||
    !('startViewTransition' in document) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    commit()
    // two frames: one for the new colours to land, one before easing returns
    requestAnimationFrame(() => requestAnimationFrame(done))
    return
  }

  const { x, y } = origin
  root.style.setProperty('--flood-x', `${x}px`)
  root.style.setProperty('--flood-y', `${y}px`)
  root.style.setProperty(
    '--flood-r',
    `${Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))}px`,
  )
  void document.startViewTransition(commit).finished.finally(done)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, currentTheme, () => 'dark')
}
