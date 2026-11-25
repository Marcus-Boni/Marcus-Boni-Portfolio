import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ASCII_RAMP,
  createCodePortrait,
  detectBackdrop,
  PORTRAIT_ASSEMBLE_MS,
  PORTRAIT_SWEEP_MS,
  portraitCrop,
  portraitGlyphChar,
  portraitGlyphOpacity,
  portraitTiming,
} from '../src/animations/codePortrait'

describe('ASCII portrait choreography', () => {
  it('assembles top-to-bottom before activating the calm reflection sweep', () => {
    expect(portraitTiming(0, 0, 70)).toEqual({ assembled: 0, sweep: -1 })
    expect(portraitTiming(750, 0, 70).assembled).toBeGreaterThan(0.9)
    expect(portraitTiming(750, 69, 70).assembled).toBe(0)
    expect(portraitTiming(PORTRAIT_ASSEMBLE_MS, 69, 70)).toEqual({
      assembled: 1,
      sweep: -1,
    })
    // Active sweep phase after assembly
    const midSweep = portraitTiming(PORTRAIT_ASSEMBLE_MS + PORTRAIT_SWEEP_MS * 0.29, 0, 70)
    expect(midSweep.assembled).toBe(1)
    expect(midSweep.sweep).toBeCloseTo(0.5, 2)
    // Rest phase between sweeps so motion breathes instead of running constantly
    const rest = portraitTiming(PORTRAIT_ASSEMBLE_MS + PORTRAIT_SWEEP_MS * 0.8, 0, 70)
    expect(rest.sweep).toBe(-1)
  })

  it('keeps square portraits centered in the tall image layer', () => {
    expect(portraitCrop(640, 640, 320, 480)).toEqual({
      x: -80,
      y: 0,
      width: 480,
      height: 480,
    })
  })

  it('preserves the crop of landscape and portrait CMS replacements', () => {
    expect(portraitCrop(1200, 600, 300, 400)).toEqual({
      x: -250,
      y: 0,
      width: 800,
      height: 400,
    })
    expect(portraitCrop(600, 1200, 300, 400)).toEqual({
      x: 0,
      y: -100,
      width: 300,
      height: 600,
    })
  })
})

describe('pixel sampling fallback', () => {
  afterEach(() => vi.unstubAllGlobals())

  function sampleWith(error: Error) {
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({
          scale() {},
          drawImage() {},
          getImageData() {
            throw error
          },
        }),
      }),
    })
    const image = { naturalWidth: 640, naturalHeight: 640 } as HTMLImageElement
    const canvas = {
      clientWidth: 320,
      clientHeight: 480,
      getContext: () => ({ setTransform() {} }),
    } as unknown as HTMLCanvasElement
    return createCodePortrait(image, canvas, 'dark')
  }

  it('leaves the original photo available if a CMS host blocks sampling', () => {
    expect(sampleWith(new DOMException('Cross-origin image', 'SecurityError'))).toBeNull()
  })

  it('does not hide unexpected renderer failures as CORS problems', () => {
    expect(() => sampleWith(new Error('Unexpected failure'))).toThrow('Unexpected failure')
  })
})

describe('ASCII portrait tones & backdrop detection', () => {
  it('detects dark vs light image backdrops from corner pixels', () => {
    const dark = new Uint8ClampedArray(4 * 4).fill(0)
    const bright = new Uint8ClampedArray(4 * 4).fill(240)
    expect(detectBackdrop(dark, 2, 2)).toBe('dark')
    expect(detectBackdrop(bright, 2, 2)).toBe('light')
  })

  it('drops near-black background to zero and preserves sculpture highlights in both themes', () => {
    for (const theme of ['dark', 'light'] as const) {
      expect(portraitGlyphOpacity(0, theme, 'dark')).toBe(0)
      expect(portraitGlyphOpacity(0.03, theme, 'dark')).toBe(0)
      expect(portraitGlyphOpacity(0.4, theme, 'dark')).toBeGreaterThan(0.35)
      expect(portraitGlyphOpacity(1, theme, 'dark')).toBe(1)
    }
    // Ink on paper lacks optical halation, so light mode lifts midtones above dark mode.
    expect(portraitGlyphOpacity(0.35, 'light', 'dark')).toBeGreaterThan(
      portraitGlyphOpacity(0.35, 'dark', 'dark'),
    )
  })

  it('still handles light-backdrop CMS photos gracefully on paper', () => {
    expect(portraitGlyphOpacity(0.05, 'light', 'light')).toBeGreaterThan(0.8)
    expect(portraitGlyphOpacity(0.35, 'light', 'light')).toBeLessThan(0.25)
    expect(portraitGlyphOpacity(0.7, 'light', 'light')).toBe(0)
  })

  it('maps normalized tone across the full ASCII density ramp', () => {
    expect(portraitGlyphChar(0)).toBe(ASCII_RAMP[0])
    expect(portraitGlyphChar(1)).toBe(ASCII_RAMP[ASCII_RAMP.length - 1])
    expect(portraitGlyphChar(0.5)).not.toBe(' ')
  })
})
