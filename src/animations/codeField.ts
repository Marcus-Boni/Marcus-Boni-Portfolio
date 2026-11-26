/**
 * Source field.
 *
 * What is printed behind the name is this file: the code that draws the hero,
 * set across it in Fragment Mono and lit by a slow current of noise, ember
 * where the current runs hot.
 *
 * The glyphs are rasterized once into an alpha mask. A frame only shades a
 * small buffer (one texel for a handful of characters), stretches it over the
 * canvas and keeps what falls inside the glyphs, so no text is laid out per
 * frame.
 */
import { paintColor } from '@/lib/theme'
import { clamp } from '@/lib/utils'

import source from './codeField.ts?raw'

/** Seconds the wall takes to print, top to bottom. */
export const FIELD_PRINT_S = 1.7

const FONT_PX = 12
const LINE_PX = 18
/** Texels down the canvas: the current is low-frequency, the glyphs carry the detail. */
const BUFFER_ROWS = 26
/** Rows behind the print head that are still ember-hot. */
const PRINT_TRAIL = 7
/** How much of a vein's light spills between its glyphs. */
const HAZE = 0.14
/** Device pixels the canvas may hold before its density is lowered. */
const PIXEL_BUDGET = 4_000_000
/** CSS pixels over which the wall comes back around a quiet zone. */
const QUIET_EDGE = 52
/** Seconds a single character takes to decode and cool. */
const SPARK_S = 0.9
const SPARK_GLYPHS = '!<>-_\\/[]{}=+*^?#:.'

/** This file as one run of text, the way the wall sets it. */
export const FIELD_SOURCE = source.replace(/\s+/g, ' ').trim()

/** The character a cell holds; the source repeats once the wall outruns it. */
export const fieldChar = (index: number) => FIELD_SOURCE[index % FIELD_SOURCE.length]

const smoothstep = (from: number, to: number, n: number) => {
  const t = clamp((n - from) / (to - from), 0, 1)
  return t * t * (3 - 2 * t)
}

// ── 2D simplex noise (Gustavson), about -1..1 ───────────────
// A fixed shuffle: the field is the same on every visit until time moves it.
const PERM = new Uint8Array(512)
{
  const order = Uint8Array.from({ length: 256 }, (_, i) => i)
  let seed = 7
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807) % 2147483647
    const j = seed % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  for (let i = 0; i < 512; i++) PERM[i] = order[i & 255]
}
const GRAD = Float32Array.of(1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 0, 1, 0, -1)
const SKEW = 0.5 * (Math.sqrt(3) - 1)
const UNSKEW = (3 - Math.sqrt(3)) / 6

// Written out corner by corner: this runs some ten thousand times a frame.
export function simplex(x: number, y: number) {
  const skew = (x + y) * SKEW
  const i = Math.floor(x + skew)
  const j = Math.floor(y + skew)
  const unskew = (i + j) * UNSKEW
  const x0 = x - i + unskew
  const y0 = y - j + unskew
  const i1 = x0 > y0 ? 1 : 0
  const j1 = 1 - i1
  const x1 = x0 - i1 + UNSKEW
  const y1 = y0 - j1 + UNSKEW
  const x2 = x0 - 1 + 2 * UNSKEW
  const y2 = y0 - 1 + 2 * UNSKEW
  const ii = i & 255
  const jj = j & 255
  let sum = 0
  let falloff = 0.5 - x0 * x0 - y0 * y0
  if (falloff > 0) {
    const g = (PERM[ii + PERM[jj]] & 7) * 2
    falloff *= falloff
    sum += falloff * falloff * (GRAD[g] * x0 + GRAD[g + 1] * y0)
  }
  falloff = 0.5 - x1 * x1 - y1 * y1
  if (falloff > 0) {
    const g = (PERM[ii + i1 + PERM[jj + j1]] & 7) * 2
    falloff *= falloff
    sum += falloff * falloff * (GRAD[g] * x1 + GRAD[g + 1] * y1)
  }
  falloff = 0.5 - x2 * x2 - y2 * y2
  if (falloff > 0) {
    const g = (PERM[ii + 1 + PERM[jj + 1]] & 7) * 2
    falloff *= falloff
    sum += falloff * falloff * (GRAD[g] * x2 + GRAD[g + 1] * y2)
  }
  return 70 * sum
}

function fbm(x: number, y: number, octaves: number) {
  let value = 0
  let amplitude = 0.55
  for (let i = 0; i < octaves; i++) {
    value += amplitude * simplex(x, y)
    x = x * 2.05 + 13.7
    y = y * 2.05 + 7.3
    amplitude *= 0.48
  }
  return value
}

/**
 * The current at a point: fbm under two rounds of domain warp, the recipe of
 * the WebGL ink field this replaced. `y` runs -0.5..0.5 and `x` the same times
 * the aspect ratio. `energy` is how far the warp throws the field, `pull` how
 * hard the pointer draws it in. Stays within about ±1.
 */
export function current(x: number, y: number, t: number, energy: number, pull = 0) {
  const qx = fbm(x * 0.85 + t, y * 0.85 + t, 2)
  const qy = fbm(x * 0.85 - t * 0.8 + 4, y * 0.85 - t * 0.8 + 4, 2)
  const wx = x * 1.1 + qx * 1.3
  const wy = y * 1.1 + qy * 1.3
  const rx = fbm(wx + 1.7 + t * 0.6, wy + 9.2 + t * 0.6, 2)
  const ry = fbm(wx + 8.3 - t * 0.4, wy + 2.8 - t * 0.4, 2)
  const scale = 0.9 + pull * 0.5
  return fbm(x * scale + rx * energy, y * scale + ry * energy, 3)
}

/**
 * How hot a vein runs at a field value. Veins follow one contour of the
 * current; `spread` widens them (the pointer, a fast scroll).
 */
export function veinHeat(field: number, spread = 0) {
  return smoothstep(0.68 - spread, 0.95, 1 - Math.abs(field * 2 - 0.2))
}

/** Where the print head is: rows fill top to bottom, each from the left. */
export function printHead(reveal: number, cols: number, rows: number) {
  const cells = clamp(reveal, 0, 1) * cols * rows
  const row = Math.min(rows - 1, Math.floor(cells / cols))
  return { row, col: Math.floor(cells - row * cols) }
}

export interface ToothTile {
  url: string
  /** CSS pixels: the image is rasterized at the device's density. */
  width: number
  height: number
}

let tooth: Promise<ToothTile | null> | undefined

/**
 * The page's code tooth: a sparse cut of the same source on the wall's own
 * grid, as an alpha tile the stylesheet uses for a mask. One run of three
 * tokens in four survives, so what is left still reads as fragments of code
 * and not as stray characters. Rasterized once per visit, however many pages
 * ask.
 */
export function toothTile(): Promise<ToothTile | null> {
  tooth ??= document.fonts.load(`${FONT_PX}px "Fragment Mono"`).then(() => {
    const cols = 30
    const rows = 72
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const font = `${FONT_PX * dpr}px "Fragment Mono", monospace`
    ctx.font = font
    const cell = ctx.measureText('0'.repeat(64)).width / 64
    canvas.width = Math.round(cols * cell)
    canvas.height = Math.round(rows * LINE_PX * dpr)
    ctx.font = font // sizing the canvas reset it
    ctx.textBaseline = 'top'
    const sparse = FIELD_SOURCE.split(' ')
      .map((token, i) =>
        Math.imul(Math.floor(i / 3) + 1, 0x9e3779b1) >>> 30 ? ' '.repeat(token.length) : token,
      )
      .join(' ')
    for (let row = 0; row < rows; row++) {
      ctx.fillText(sparse.slice(row * cols, (row + 1) * cols), 0, row * LINE_PX * dpr)
    }
    return new Promise<ToothTile | null>((resolve) =>
      canvas.toBlob((blob) =>
        resolve(
          blob && {
            url: URL.createObjectURL(blob),
            width: canvas.width / dpr,
            height: canvas.height / dpr,
          },
        ),
      ),
    )
  })
  return tooth
}

/**
 * A box of the canvas, in CSS pixels, that the field must not compete with.
 * Around small type the wall itself steps back. `veinsOnly` is for display
 * type: the wall stays behind it and only the veins calm down.
 */
export interface QuietZone {
  x: number
  y: number
  width: number
  height: number
  veinsOnly?: boolean
}

/** 1 inside the zone, easing to 0 over `QUIET_EDGE` pixels outside it. */
export function calmAt(x: number, y: number, zone: QuietZone) {
  const dx = Math.max(zone.x - x, 0, x - zone.x - zone.width)
  const dy = Math.max(zone.y - y, 0, y - zone.y - zone.height)
  return 1 - smoothstep(0, QUIET_EDGE, Math.hypot(dx, dy))
}

/** What moves the field. A plain object, so GSAP can tween it. */
export interface FieldState {
  /** 0..1, how much of the wall has been printed. */
  reveal: number
  /** 0..1, how strongly the pointer lights and bends the field. */
  lens: number
  /** The pointer on the canvas, in CSS pixels. */
  x: number
  y: number
  /** 0..1, scroll velocity: the current runs hotter while the page moves. */
  energy: number
}

/**
 * Rasterizes the wall for the canvas's current size and palette, and returns
 * the painter for one frame. Call again after a resize or a change of scheme.
 * `quiet` lists what sits on top of the canvas and must stay easy to read.
 * The painter's `live` flag adds the single characters that decode on their
 * own; a still frame leaves them out.
 */
export function createCodeField(canvas: HTMLCanvasElement, quiet: QuietZone[] = []) {
  const ctx = canvas.getContext('2d')
  if (!ctx || !canvas.clientWidth || !canvas.clientHeight) return null
  // sharp on a laptop, bounded on a 5K screen: the canvas and its mask each
  // stay within the budget
  const dpr = Math.max(
    1,
    Math.min(
      window.devicePixelRatio || 1,
      2,
      Math.sqrt(PIXEL_BUDGET / (canvas.clientWidth * canvas.clientHeight)),
    ),
  )
  const w = (canvas.width = Math.round(canvas.clientWidth * dpr))
  const h = (canvas.height = Math.round(canvas.clientHeight * dpr))
  const font = `${FONT_PX * dpr}px "Fragment Mono", monospace`

  const mask = document.createElement('canvas')
  mask.width = w
  mask.height = h
  const glyphs = mask.getContext('2d')!
  glyphs.font = font
  glyphs.textBaseline = 'top'
  // averaged over a run: a single advance can come back rounded
  const cell = glyphs.measureText('0'.repeat(64)).width / 64
  const line = Math.round(LINE_PX * dpr)
  const pad = (line - FONT_PX * dpr) / 2
  const cols = Math.ceil(w / cell)
  const rows = Math.ceil(h / line)
  for (let row = 0; row < rows; row++) {
    let text = ''
    for (let col = 0; col < cols; col++) text += fieldChar(row * cols + col)
    glyphs.fillText(text, 0, row * line + pad)
  }

  const aspect = w / h
  const tw = Math.max(8, Math.round(BUFFER_ROWS * aspect))
  const buffer = document.createElement('canvas')
  buffer.width = tw
  buffer.height = BUFFER_ROWS
  const shade = buffer.getContext('2d')!
  const image = shade.createImageData(tw, BUFFER_ROWS)
  const px = image.data

  // how far each texel steps back: `hush` for the wall, `cool` for the veins
  const hush = new Float32Array(tw * BUFFER_ROWS)
  const cool = new Float32Array(tw * BUFFER_ROWS)
  for (let k = 0; k < hush.length; k++) {
    const x = (((k % tw) + 0.5) / tw) * canvas.clientWidth
    const y = ((Math.floor(k / tw) + 0.5) / BUFFER_ROWS) * canvas.clientHeight
    for (const zone of quiet) {
      const calm = calmAt(x, y, zone)
      cool[k] = Math.max(cool[k], calm)
      if (!zone.veinsOnly) hush[k] = Math.max(hush[k], calm)
    }
  }

  const boneCss = paintColor(canvas, '--color-bone')
  const emberCss = paintColor(canvas, '--color-ember')
  // "rgb(r, g, b)" → the bytes the buffer is written in
  const bone = boneCss.match(/\d+/g)!.map(Number)
  const ember = emberCss.match(/\d+/g)!.map(Number)
  const sparks: { col: number; row: number; born: number }[] = []

  return (seconds: number, state: FieldState, live = true) => {
    const t = seconds * 0.04
    const lensX = ((state.x * dpr) / w - 0.5) * aspect
    const lensY = (state.y * dpr) / h - 0.5

    for (let j = 0, o = 0; j < BUFFER_ROWS; j++) {
      const y = (j + 0.5) / BUFFER_ROWS - 0.5
      for (let i = 0; i < tw; i++, o += 4) {
        const x = ((i + 0.5) / tw - 0.5) * aspect
        const pull = state.lens * Math.exp(-((x - lensX) ** 2 + (y - lensY) ** 2) * 16)
        const field = current(x, y, t, 0.22 + state.energy, pull)
        const k = o >> 2
        const heat =
          Math.min(
            1,
            veinHeat(field, state.energy * 0.1 + pull * 0.14) *
              (0.85 + pull * 0.9 + state.energy * 0.45),
          ) *
          (1 - cool[k] * 0.82)
        // the wall itself: barely there, breathing with the current
        const glow =
          (0.05 + smoothstep(-0.7, 0.9, field) * 0.13 + pull * 0.3) * (1 - hush[k] * 0.94)
        // ember as the vein warms, then a step back toward the type colour at its core
        const tint = Math.min(1, heat * 1.6) - smoothstep(0.7, 1, heat) * 0.3
        px[o] = bone[0] + (ember[0] - bone[0]) * tint
        px[o + 1] = bone[1] + (ember[1] - bone[1]) * tint
        px[o + 2] = bone[2] + (ember[2] - bone[2]) * tint
        px[o + 3] = (glow + (1 - glow) * heat) * 255
      }
    }
    shade.putImageData(image, 0, 0)

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'copy'
    ctx.drawImage(buffer, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'

    const printing = state.reveal < 1
    const head = printHead(state.reveal, cols, rows)
    const headX = head.col * cell
    const headY = head.row * line
    if (printing) {
      // rows leave the head ember-hot and cool into the field's own colour
      ctx.fillStyle = emberCss
      for (let k = 0; k < PRINT_TRAIL && head.row - k >= 0; k++) {
        ctx.globalAlpha = (1 - k / PRINT_TRAIL) ** 2
        ctx.fillRect(0, headY - k * line, k ? w : headX, line)
      }
      ctx.globalAlpha = 1
      ctx.clearRect(headX, headY, w - headX, line)
      ctx.clearRect(0, headY + line, w, h - headY - line)
    }

    ctx.globalCompositeOperation = 'destination-in'
    ctx.drawImage(mask, 0, 0)
    // the same light again, faint and unmasked: a vein glows behind its glyphs
    ctx.globalCompositeOperation = 'destination-over'
    ctx.globalAlpha = HAZE
    const printed = printing ? headY / h : 1
    ctx.drawImage(buffer, 0, 0, tw, BUFFER_ROWS * printed, 0, 0, w, h * printed)
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    if (printing) {
      ctx.fillStyle = emberCss
      ctx.fillRect(headX, headY, cell, line)
      return
    }
    if (!live) return

    // single characters decode in the type colour: often under the pointer,
    // now and then anywhere
    if (sparks.length < 28 && Math.random() < 0.06 + state.lens * 0.5) {
      const near = Math.random() < state.lens
      const col = near ? (state.x * dpr) / cell + (Math.random() - 0.5) * 26 : Math.random() * cols
      const row = near ? (state.y * dpr) / line + (Math.random() - 0.5) * 9 : Math.random() * rows
      const texel =
        Math.floor(((row * line) / h) * BUFFER_ROWS) * tw + Math.floor(((col * cell) / w) * tw)
      // never over the type the wall stepped back for
      if (!(hush[texel] > 0.2)) {
        sparks.push({ col: Math.floor(col), row: Math.floor(row), born: seconds })
      }
    }
    ctx.font = font
    ctx.textBaseline = 'top'
    ctx.fillStyle = boneCss
    for (let s = sparks.length - 1; s >= 0; s--) {
      const { col, row, born } = sparks[s]
      const life = (seconds - born) / SPARK_S
      if (life >= 1) {
        sparks.splice(s, 1)
        continue
      }
      const x = col * cell
      const y = row * line
      if (life < 0.35) {
        // still scrambled: the cell shows a stand-in, changing as it settles
        ctx.clearRect(x, y, cell, line)
        ctx.globalAlpha = 0.25 + life * 1.8
        ctx.fillText(SPARK_GLYPHS[(Math.floor(seconds * 14) + col * 7 + row * 3) % SPARK_GLYPHS.length], x, y + pad)
      } else {
        ctx.globalAlpha = 0.9 * ((1 - life) / 0.65) ** 2
        ctx.fillText(fieldChar(row * cols + col), x, y + pad)
      }
    }
    ctx.globalAlpha = 1
  }
}
