/**
 * Shared mutable scroll state, written by the Lenis scroll handler and read
 * per-frame by the hero's canvas loop. A plain module-level object avoids
 * re-renders that React state or context would cause at 60fps.
 */
export const scrollState = {
  /** Lenis smoothed velocity, px/frame */
  velocity: 0,
  /** Normalized page progress 0–1 */
  progress: 0,
  /** Current scroll position in px */
  scroll: 0,
}
