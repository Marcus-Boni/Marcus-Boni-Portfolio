/** A finite, row-staggered assembly. All timing is in visible milliseconds. */
export const PORTRAIT_DURATION = 4800

const SOURCE = [
  'const engineer = { name: "Marcus Boni", craft: "web" };',
  'import { curiosity, precision } from "./human";',
  'export function build(idea: Idea): Product {',
  '  const solution = simplify(understand(idea));',
  '  return create({ ...solution, care: true });',
  '} // learning by building. always.',
  'type Craft = "React" | "TypeScript" | "Node.js";',
  'const signal = details.map(detail => refine(detail));',
  'await ship({ accessible: true, resilient: true });',
].join(' ')

export function portraitTiming(elapsed: number, row: number, rows: number) {
  const clamp = (n: number) => Math.max(0, Math.min(1, n))
  const progress = clamp((elapsed - 180 - (row / rows) * 1250) / 900)
  return {
    assembled: 1 - (1 - progress) ** 4,
    photo: clamp((elapsed - 3500) / 1300),
  }
}

/** Matches object-fit: cover at object-position: center. */
export function portraitCrop(iw: number, ih: number, width: number, height: number) {
  const scale = Math.max(width / iw, height / ih)
  return { x: (width - iw * scale) / 2, y: (height - ih * scale) / 2,
    width: iw * scale, height: ih * scale }
}

/** Rasterize characters once; animation only composites cached row strips. */
export function createCodePortrait(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
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

  const cell = width / 76
  const line = cell * 1.55
  const rows = Math.ceil(height / line)
  const sample = document.createElement('canvas')
  sample.width = 76
  sample.height = rows
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true })
  if (!sampleCtx) return null
  const crop = portraitCrop(image.naturalWidth, image.naturalHeight, width, height)
  sampleCtx.scale(76 / width, rows / height)
  sampleCtx.drawImage(image, crop.x, crop.y, crop.width, crop.height)
  let pixels: Uint8ClampedArray
  try {
    pixels = sampleCtx.getImageData(0, 0, 76, rows).data
  } catch (error) {
    // A remote host may prohibit pixel sampling; other failures are bugs.
    if (error instanceof DOMException && error.name === 'SecurityError') return null
    throw error
  }

  const makeLayer = () => {
    const layer = document.createElement('canvas')
    layer.width = canvas.width
    layer.height = canvas.height
    const context = layer.getContext('2d')!
    context.scale(dpr, dpr)
    context.font = `${cell * 1.65}px "Fragment Mono", monospace`
    context.textBaseline = 'top'
    return { layer, context }
  }
  const portrait = makeLayer()
  const ambient = makeLayer()
  const ember = makeLayer()
  const styles = getComputedStyle(canvas)
  const ink = styles.getPropertyValue('--color-ink').trim() || '#0d0c0a'
  const bone = styles.getPropertyValue('--color-bone').trim() || '#ece7df'
  const accent = styles.getPropertyValue('--color-ember').trim() || '#ff4d17'
  portrait.context.fillStyle = bone
  ambient.context.fillStyle = bone
  ember.context.fillStyle = accent

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < 76; col++) {
      const offset = (row * 76 + col) * 4
      const luminance = (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 +
        pixels[offset + 2] * 0.0722) / 255
      const char = SOURCE[(row * 83 + col) % SOURCE.length]
      const x = col * cell
      const y = row * line
      portrait.context.globalAlpha = Math.max(0, (luminance - 0.075) / 0.72) ** 0.8
      portrait.context.fillText(char, x, y)
      ember.context.globalAlpha = portrait.context.globalAlpha
      ember.context.fillText(char, x, y)
      ambient.context.globalAlpha = 0.055
      ambient.context.fillText(char, x, y)
    }
  }

  return (elapsed: number) => {
    const { photo } = portraitTiming(elapsed, 0, rows)
    ctx.globalAlpha = 1
    ctx.fillStyle = ink
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(ambient.layer, 0, 0, width, height)
    for (let row = 0; row < rows; row++) {
      const { assembled } = portraitTiming(elapsed, row, rows)
      const y = row * line
      const stripHeight = Math.min(line, height - y)
      const drift = (1 - assembled) * (row % 2 ? -1 : 1) * width * 0.28
      ctx.globalAlpha = assembled
      ctx.drawImage(portrait.layer, 0, y * dpr, canvas.width, stripHeight * dpr,
        drift, y, width, stripHeight)
      // An ember front travels through the code, then leaves bone-white glyphs.
      const glow = Math.sin(assembled * Math.PI) ** 3
      if (glow > 0.01) {
        ctx.globalAlpha = glow * 0.85
        ctx.drawImage(ember.layer, 0, y * dpr, canvas.width, stripHeight * dpr,
          drift, y, width, stripHeight)
      }
    }
    ctx.globalAlpha = 1
    canvas.style.opacity = String(1 - photo * photo * (3 - 2 * photo))
  }
}
