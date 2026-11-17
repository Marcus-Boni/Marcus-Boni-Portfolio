/**
 * Field plates.
 *
 * Every entry of the journal gets a plate: a small contour map of a terrain
 * that exists only for that entry. The terrain is a pure function of the
 * post's slug, so a post keeps the same plate on the index, in its masthead
 * and in "read next" — it works as the post's face when there is no cover.
 *
 * Everything here is deterministic and dependency-free: a seeded height field
 * (a handful of smooth hills and hollows under a gentle warp) and a painter
 * that draws its contour lines straight into a canvas, one pixel at a time.
 */

/** The terrain is authored in a fixed 1.6 × 1 world, then cropped to fit. */
const WORLD_ASPECT = 1.6
/** Contour lines per unit of height. */
const LEVELS = 9
/** The field is sampled on a coarse grid and interpolated per pixel. */
const CELL = 4

interface Bump {
  x: number
  y: number
  radius: number
  height: number
  phase: number
}

export interface PlateField {
  bumps: Bump[]
  warp: { fx: number; fy: number; px: number; py: number; amount: number }
  /** Which contour is drawn in ember. */
  accent: number
}

/** FNV-1a — a stable 32-bit hash of the slug. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32 — tiny seeded PRNG, uniform in [0, 1). */
function prng(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createPlateField(seed: number): PlateField {
  const random = prng(seed)
  const count = 5 + Math.floor(random() * 3)
  const bumps: Bump[] = Array.from({ length: count }, (_, index) => ({
    x: random() * WORLD_ASPECT,
    y: random(),
    radius: 0.2 + random() * 0.3,
    // the first two are always hills, so no plate comes out as a flat basin
    height: (index < 2 ? 1 : random() < 0.3 ? -1 : 1) * (0.55 + random() * 0.6),
    phase: random() * Math.PI * 2,
  }))
  return {
    bumps,
    warp: {
      fx: 2 + random() * 3,
      fy: 2 + random() * 3,
      px: random() * Math.PI * 2,
      py: random() * Math.PI * 2,
      amount: 0.03 + random() * 0.05,
    },
    accent: 2 + Math.floor(random() * 5),
  }
}

/** Height of the terrain at a world position. `time` lets the hills drift. */
export function sampleField(field: PlateField, x: number, y: number, time = 0): number {
  const { warp } = field
  const wx = x + Math.sin(y * warp.fy + warp.py) * warp.amount
  const wy = y + Math.sin(x * warp.fx + warp.px) * warp.amount
  let value = 0
  for (const bump of field.bumps) {
    const bx = bump.x + (time ? Math.sin(time * 0.35 + bump.phase) * 0.045 : 0)
    const by = bump.y + (time ? Math.cos(time * 0.29 + bump.phase * 1.7) * 0.045 : 0)
    const dx = wx - bx
    const dy = wy - by
    value += bump.height * Math.exp(-(dx * dx + dy * dy) / (bump.radius * bump.radius))
  }
  return value
}

// Signal & Ink, as bytes: bone-dim for the terrain, ember for the one accent.
const LINE = [181, 175, 164] as const
const EMBER = [255, 77, 23] as const

/**
 * Paints the contour map into `ctx`, covering `width × height` device pixels.
 * Transparent wherever no line passes, so the surface behind shows through.
 */
export function paintPlate(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  field: PlateField,
  time = 0,
): void {
  if (width < 2 || height < 2) return

  // "cover" fit of the world into the canvas, centred
  const scale = Math.max(width / WORLD_ASPECT, height)
  const offsetX = (WORLD_ASPECT - width / scale) / 2
  const offsetY = (1 - height / scale) / 2

  const cols = Math.ceil(width / CELL) + 1
  const rows = Math.ceil(height / CELL) + 1
  const grid = new Float32Array(cols * rows)
  for (let row = 0; row < rows; row++) {
    const y = offsetY + (row * CELL) / scale
    for (let col = 0; col < cols; col++) {
      grid[row * cols + col] = sampleField(field, offsetX + (col * CELL) / scale, y, time)
    }
  }

  const image = ctx.createImageData(width, height)
  const data = image.data
  for (let py = 0; py < height; py++) {
    const gy = py / CELL
    const row = Math.floor(gy)
    const fy = gy - row
    const top = row * cols
    const bottom = top + cols
    for (let px = 0; px < width; px++) {
      const gx = px / CELL
      const col = Math.floor(gx)
      const fx = gx - col
      const v00 = grid[top + col]
      const v10 = grid[top + col + 1]
      const v01 = grid[bottom + col]
      const v11 = grid[bottom + col + 1]
      const upper = v00 + (v10 - v00) * fx
      const lower = v01 + (v11 - v01) * fx
      const value = upper + (lower - upper) * fy

      // slope in height per pixel: turns "distance in height" into pixels,
      // which is what keeps every contour the same width on screen
      const slopeX = ((v10 - v00) * (1 - fy) + (v11 - v01) * fy) / CELL
      const slopeY = (lower - upper) / CELL
      const slope = Math.sqrt(slopeX * slopeX + slopeY * slopeY) + 1e-6

      const scaled = value * LEVELS
      const level = Math.round(scaled)
      const distance = Math.abs(scaled - level) / (slope * LEVELS)
      if (distance >= 1.15) continue

      const coverage = 1.15 - distance > 1 ? 1 : 1.15 - distance
      const isAccent = level === field.accent
      const color = isAccent ? EMBER : LINE
      const strength = isAccent ? 0.95 : level % 4 === 0 ? 0.62 : 0.3
      const offset = (py * width + px) * 4
      data[offset] = color[0]
      data[offset + 1] = color[1]
      data[offset + 2] = color[2]
      data[offset + 3] = Math.round(coverage * strength * 255)
    }
  }
  ctx.putImageData(image, 0, 0)
}
