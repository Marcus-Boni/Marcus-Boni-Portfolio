/**
 * Scroll spent per pixel of horizontal travel. Below 1 the gallery outruns the
 * wheel, so the whole track costs less scrolling than it is wide.
 */
export const WORK_TRAVEL_RATIO = 0.7

interface WorkTrackDistanceInput {
  trackWidth: number
  visibleWidth: number
}

export function workTrackDistance({
  trackWidth,
  visibleWidth,
}: WorkTrackDistanceInput): number {
  return Math.max(0, trackWidth - visibleWidth)
}
