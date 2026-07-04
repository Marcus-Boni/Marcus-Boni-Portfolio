const INTERACTION_EVENTS = [
  'pointermove',
  'pointerdown',
  'wheel',
  'touchstart',
  'keydown',
  'scroll',
] as const

// Tracks whether the visitor has interacted at all — set once, module-wide.
let interacted = false
if (typeof window !== 'undefined') {
  const markInteracted = () => {
    interacted = true
  }
  for (const event of INTERACTION_EVENTS) {
    window.addEventListener(event, markInteracted, {
      passive: true,
      once: true,
    })
  }
}

/** How long after navigation the hero intro is still worth playing. */
const INTRO_BUDGET_MS = 2500

/**
 * `true` when the page reached interactivity so late that replaying the hero
 * intro would *hide already-visible content* (the static HTML shell) just to
 * animate it back in. On slow devices that yank-and-replay is bad UX and it
 * pushes the Largest Contentful Paint to the end of the animation. Once the
 * visitor has interacted the page is warm (e.g. a language switch remount),
 * so the intro always plays then.
 */
export function shouldSkipIntro(): boolean {
  return !interacted && performance.now() > INTRO_BUDGET_MS
}

interface DeferOptions {
  /**
   * Also fire when the tab is being hidden (tab switch / close). Use for
   * work that must not be lost when a visitor bounces without interacting,
   * e.g. flushing the pageview event.
   */
  flushOnHide?: boolean
}

/**
 * Runs `callback` once, on the first user interaction. Non-hook counterpart
 * of `useDeferredActivation` for effects that don't need a re-render — used
 * to keep the Firestore SDK (live content + analytics) out of the initial
 * load window so it never contributes to Total Blocking Time.
 *
 * Returns a cancel function.
 */
export function onFirstInteraction(
  callback: () => void,
  { flushOnHide = false }: DeferOptions = {},
): () => void {
  let done = false

  const fire = () => {
    if (done) return
    done = true
    cleanup()
    callback()
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') fire()
  }

  const cleanup = () => {
    for (const event of INTERACTION_EVENTS) {
      window.removeEventListener(event, fire)
    }
    if (flushOnHide) {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }

  for (const event of INTERACTION_EVENTS) {
    window.addEventListener(event, fire, { passive: true, once: true })
  }
  if (flushOnHide) {
    document.addEventListener('visibilitychange', onVisibilityChange)
  }

  return () => {
    done = true
    cleanup()
  }
}
