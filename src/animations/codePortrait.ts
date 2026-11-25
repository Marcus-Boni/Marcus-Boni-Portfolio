import { paintColor, type Theme } from '@/lib/theme'

/** Duration of the initial top-to-bottom row assembly, in milliseconds. */
export const PORTRAIT_ASSEMBLE_MS = 2350
/** Full cycle of the calm diagonal chrome reflection sweep after assembly. */
export const PORTRAIT_SWEEP_MS = 5400
/** Retained export representing the full initial assembly window. */
export const PORTRAIT_DURATION = PORTRAIT_ASSEMBLE_MS

export type PortraitBackdrop = 'dark' | 'light'

/** Perceptual ASCII density ramp: sparse highlights -> dense metallic peaks. */
export const ASCII_RAMP = ' .`:-=+*csS#%@'

const AMBIENT_CODE = [
  'const engineer = { name: "Marcus Boni", role: "Software Engineer" };',
  'type Craft = "TypeScript" | "Rust" | "Applied AI";',
  'await deploy({ localFirst: true, verifiable: true });',
].join(' ')

export function portraitTiming(elapsed: number, row: number, rows: number) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n))
  const progress = clamp((elapsed - 140 - (row / rows) * 1260) / 860)
  const assembled = 1 - (1 - progress) ** 4
  // After the sculpture finishes assembling, a calm diagonal specular sweep
  // passes across the glyphs every PORTRAIT_SWEEP_MS (active for 58% of the
  // cycle, resting cleanly off-frame for the remaining 42%).
  const postAssemble = Math.max(0, elapsed - PORTRAIT_ASSEMBLE_MS)
  const cycle = (postAssemble % PORTRAIT_SWEEP_MS) / PORTRAIT_SWEEP_MS
  const sweep = postAssemble > 0 && cycle < 0.58 ? cycle / 0.58 : -1
  return { assembled, sweep }
}

/** Matches object-fit: cover at object-position: center. */
export function portraitCrop(iw: number, ih: number, width: number, height: number) {
  const scale = Math.max(width / iw, height / ih)
  return {
    x: (width - iw * scale) / 2,
    y: (height - ih * scale) / 2,
    width: iw * scale,
    height: ih * scale,
  }
}

/**
 * Inspect the four corners of the sampled grid to distinguish dark-backdrop
 * portraits (such as the metallic chrome bust) from light-backdrop photos.
 */
export function detectBackdrop(
  pixels: Uint8ClampedArray,
  cols: number,
  rows: number,
): PortraitBackdrop {
  const corners = [
    0,
    Math.max(0, cols - 1),
    Math.max(0, rows - 1) * cols,
    Math.max(0, rows * cols - 1),
  ]
  let sum = 0
  for (const idx of corners) {
    const o = idx * 4
    sum +=
      (pixels[o] * 0.2126 + pixels[o + 1] * 0.7152 + pixels[o + 2] * 0.0722) /
      255
  }
  return sum / corners.length < 0.18 ? 'dark' : 'light'
}

/** Maps pixel luminance (0..1) into glyph opacity for dark and light themes. */
export function portraitGlyphOpacity(
  light: number,
  theme: Theme,
  backdrop: PortraitBackdrop = 'dark',
) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n))
  if (backdrop === 'light' && theme === 'light') {
    // On paper with a bright photo backdrop, reserve strong marks for shadows.
    return clamp((0.65 - light) / 0.65) ** 2.1
  }
  // For dark-backdrop sculptures (or dark mode), chrome highlights carry the
  // glyphs while the near-black backdrop drops cleanly to zero. On paper,
  // dark ink lacks optical halation, so lift midtones to keep sculptural
  // volume crisp and legible against the archival plate.
  const divisor = theme === 'light' ? 0.72 : 0.78
  const tone = clamp((light - 0.045) / divisor)
  return tone ** (theme === 'light' ? 0.62 : 0.76)
}

/** Selects the ASCII density glyph matching normalized tone (0..1). */
export function portraitGlyphChar(tone: number): string {
  const clamped = Math.max(0, Math.min(1, tone))
  const index = Math.round(clamped * (ASCII_RAMP.length - 1))
  return ASCII_RAMP[index]
}

export interface PortraitRenderOptions {
  /** Paint the settled static ASCII frame with no sweep motion. */
  reduced?: boolean
}

/**
 * Rasterize ASCII glyph layers once; each animation frame only composites
 * pre-rendered offscreen canvases (zero per-frame text layout).
 */
export function createCodePortrait(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  theme: Theme,
) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) return null
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  const cols = 74
  const cell = width / cols
  const line = cell * 1.56
  const rows = Math.ceil(height / line)

  const sample = document.createElement('canvas')
  sample.width = cols
  sample.height = rows
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true })
  if (!sampleCtx) return null
  const crop = portraitCrop(image.naturalWidth, image.naturalHeight, width, height)
  sampleCtx.scale(cols / width, rows / height)
  sampleCtx.drawImage(image, crop.x, crop.y, crop.width, crop.height)

  let pixels: Uint8ClampedArray
  try {
    pixels = sampleCtx.getImageData(0, 0, cols, rows).data
  } catch (error) {
    // A remote host may prohibit pixel sampling; other failures are bugs.
    if (error instanceof DOMException && error.name === 'SecurityError') return null
    throw error
  }

  const backdrop = detectBackdrop(pixels, cols, rows)

  const fontSize = cell * (theme === 'light' ? 1.72 : 1.66)
  const makeLayer = () => {
    const layer = document.createElement('canvas')
    layer.width = canvas.width
    layer.height = canvas.height
    const context = layer.getContext('2d')!
    context.scale(dpr, dpr)
    context.font = `${fontSize}px "Fragment Mono", monospace`
    context.textBaseline = 'top'
    return { layer, context }
  }

  const portrait = makeLayer()
  const specular = makeLayer()
  const catchlight = theme === 'light' ? makeLayer() : null
  const ambient = makeLayer()
  const ember = makeLayer()
  const shimmer = makeLayer()

  const ink = paintColor(canvas, '--color-ink')
  const ground = theme === 'light' ? paintColor(canvas, '--color-ink-soft') : ink
  const bone = paintColor(canvas, '--color-bone')
  const smoke = paintColor(canvas, '--color-smoke')
  const accent = paintColor(canvas, '--color-ember')

  portrait.context.fillStyle = bone
  // On paper, metallic reflections read as a burnished ember-signal sheen with
  // a crisp paper catchlight crest rather than a dark smudge over dark ink.
  specular.context.fillStyle = theme === 'light' ? accent : bone
  if (catchlight) catchlight.context.fillStyle = ink
  ambient.context.fillStyle = theme === 'light' ? smoke : bone
  ember.context.fillStyle = accent

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const offset = (row * cols + col) * 4
      const light =
        (pixels[offset] * 0.2126 +
          pixels[offset + 1] * 0.7152 +
          pixels[offset + 2] * 0.0722) /
        255
      const opacity = portraitGlyphOpacity(light, theme, backdrop)
      const x = col * cell
      const y = row * line

      // Subtle background code grid texture behind the sculpture.
      const bgChar = AMBIENT_CODE[(row * 79 + col) % AMBIENT_CODE.length]
      ambient.context.globalAlpha = theme === 'light' ? 0.11 : 0.04
      ambient.context.fillText(bgChar, x, y)

      if (opacity <= 0.015) continue

      const char = portraitGlyphChar(opacity)
      if (char === ' ') continue

      portrait.context.globalAlpha = opacity
      portrait.context.fillText(char, x, y)

      ember.context.globalAlpha = opacity
      ember.context.fillText(char, x, y)

      // Specular highlight pass emphasizes metallic ridges and brightest glyphs.
      specular.context.globalAlpha = Math.min(1, opacity * 1.25)
      specular.context.fillText(char, x, y)

      // In light mode, reserve a crisp paper catchlight for the brightest ridges.
      if (catchlight && opacity > 0.52) {
        catchlight.context.globalAlpha = Math.min(1, (opacity - 0.52) / 0.48)
        catchlight.context.fillText(char, x, y)
      }
    }
  }

  // Reusable diagonal reflection mask on `shimmer` composited over `specular`.
  const compositeBand = (
    source: HTMLCanvasElement,
    progress: number,
    bandRatio: number,
    alpha: number,
    blend?: GlobalCompositeOperation,
  ) => {
    const sCtx = shimmer.context
    sCtx.globalCompositeOperation = 'source-over'
    sCtx.globalAlpha = 1
    sCtx.clearRect(0, 0, width, height)

    const band = height * bandRatio
    const travel = height + width * 0.36 + band * 2
    const offset = -band - width * 0.18 + progress * travel

    sCtx.save()
    sCtx.transform(1, -0.14, 0, 1, 0, width * 0.07)
    // Alpha-only sweep mask: `source-in` carries 100% of its hue from `source`.
    const grad = sCtx.createLinearGradient(0, offset, 0, offset + band)
    grad.addColorStop(0, 'rgb(0 0 0 / 0)')
    grad.addColorStop(0.32, 'rgb(0 0 0 / 0.30)')
    grad.addColorStop(0.5, 'rgb(0 0 0 / 0.94)')
    grad.addColorStop(0.72, 'rgb(0 0 0 / 0.26)')
    grad.addColorStop(1, 'rgb(0 0 0 / 0)')
    sCtx.fillStyle = grad
    sCtx.fillRect(0, offset, width, band)
    sCtx.restore()

    // Mask the gradient strictly to the rasterized specular ASCII glyphs.
    sCtx.globalCompositeOperation = 'source-in'
    sCtx.drawImage(source, 0, 0, width, height)

    ctx.save()
    if (blend) ctx.globalCompositeOperation = blend
    ctx.globalAlpha = alpha
    ctx.drawImage(shimmer.layer, 0, 0, width, height)
    ctx.restore()
  }

  const drawSweep = (progress: number) => {
    if (theme === 'dark') {
      compositeBand(specular.layer, progress, 0.42, 0.65, 'lighter')
      return
    }
    // Light mode: burnished ember sheen across metallic ridges + tight paper catchlight crest.
    compositeBand(specular.layer, progress, 0.44, 0.82)
    if (catchlight) {
      compositeBand(catchlight.layer, progress, 0.18, 0.5)
    }
  }

  return (elapsed: number, options?: PortraitRenderOptions) => {
    const reduced = options?.reduced === true
    const effective = reduced ? PORTRAIT_ASSEMBLE_MS : elapsed

    ctx.globalAlpha = 1
    ctx.fillStyle = ground
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(ambient.layer, 0, 0, width, height)

    if (effective >= PORTRAIT_ASSEMBLE_MS) {
      // Settled permanent ASCII state: single blit + optional chrome sheen.
      ctx.globalAlpha = 1
      ctx.drawImage(portrait.layer, 0, 0, width, height)
      if (!reduced) {
        const { sweep } = portraitTiming(effective, 0, rows)
        if (sweep >= 0) drawSweep(sweep)
      }
    } else {
      for (let row = 0; row < rows; row++) {
        const { assembled } = portraitTiming(effective, row, rows)
        if (assembled <= 0.005) continue
        const y = row * line
        const stripHeight = Math.min(line, height - y)
        const drift = (1 - assembled) * (row % 2 ? -1 : 1) * width * 0.24
        ctx.globalAlpha = assembled
        ctx.drawImage(
          portrait.layer,
          0,
          y * dpr,
          canvas.width,
          stripHeight * dpr,
          drift,
          y,
          width,
          stripHeight,
        )
        // The Signal & Ink ember leading wave settles cleanly into monochrome.
        const glow = Math.sin(assembled * Math.PI) ** 3
        if (glow > 0.01) {
          ctx.globalAlpha = glow * (theme === 'light' ? 0.95 : 0.85)
          ctx.drawImage(
            ember.layer,
            0,
            y * dpr,
            canvas.width,
            stripHeight * dpr,
            drift,
            y,
            width,
            stripHeight,
          )
        }
      }
    }

    ctx.globalAlpha = 1
    canvas.style.opacity = '1'
  }
}
