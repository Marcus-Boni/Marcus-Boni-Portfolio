import { useEffect } from 'react'

/**
 * Shared pointer state in normalized device coordinates (-1..1),
 * read per-frame by the WebGL scene without triggering React renders.
 */
export const pointerState = {
  x: 0,
  y: 0,
  active: false,
}

export function usePointerTracking() {
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointerState.x = (event.clientX / window.innerWidth) * 2 - 1
      pointerState.y = -((event.clientY / window.innerHeight) * 2 - 1)
      pointerState.active = true
    }
    const onLeave = () => {
      pointerState.active = false
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [])
}
