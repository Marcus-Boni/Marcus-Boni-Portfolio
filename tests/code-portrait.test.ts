import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCodePortrait, portraitCrop, portraitTiming, PORTRAIT_DURATION } from '../src/animations/codePortrait'

describe('code portrait choreography', () => {
  it('assembles from top to bottom without starting the photo dissolve early', () => {
    expect(portraitTiming(0, 0, 70)).toEqual({ assembled: 0, photo: 0 })
    expect(portraitTiming(800, 0, 70).assembled).toBeGreaterThan(0.9)
    expect(portraitTiming(800, 69, 70).assembled).toBe(0)
    expect(portraitTiming(2350, 69, 70)).toEqual({ assembled: 1, photo: 0 })
    expect(portraitTiming(3500, 0, 70).photo).toBe(0)
    expect(portraitTiming(PORTRAIT_DURATION, 69, 70)).toEqual({ assembled: 1, photo: 1 })
    expect(portraitTiming(PORTRAIT_DURATION * 2, 69, 70).photo).toBe(1)
  })

  it('keeps square portraits centered in the tall image layer', () => {
    expect(portraitCrop(640, 640, 320, 480)).toEqual({
      x: -80, y: 0, width: 480, height: 480,
    })
  })

  it('preserves the crop of landscape and portrait CMS replacements', () => {
    expect(portraitCrop(1200, 600, 300, 400)).toEqual({
      x: -250, y: 0, width: 800, height: 400,
    })
    expect(portraitCrop(600, 1200, 300, 400)).toEqual({
      x: 0, y: -100, width: 300, height: 600,
    })
  })
})

describe('pixel sampling fallback', () => {
  afterEach(() => vi.unstubAllGlobals())

  function sampleWith(error: Error) {
    vi.stubGlobal('window', { devicePixelRatio: 1 })
    vi.stubGlobal('document', { createElement: () => ({
      getContext: () => ({ scale() {}, drawImage() {}, getImageData() { throw error } }),
    }) })
    const image = { naturalWidth: 640, naturalHeight: 640 } as HTMLImageElement
    const canvas = { clientWidth: 320, clientHeight: 480,
      getContext: () => ({ setTransform() {} }),
    } as unknown as HTMLCanvasElement
    return createCodePortrait(image, canvas)
  }

  it('leaves the original photo available if a CMS host blocks sampling', () => {
    expect(sampleWith(new DOMException('Cross-origin image', 'SecurityError'))).toBeNull()
  })

  it('does not hide unexpected renderer failures as CORS problems', () => {
    expect(() => sampleWith(new Error('Unexpected failure'))).toThrow('Unexpected failure')
  })
})
