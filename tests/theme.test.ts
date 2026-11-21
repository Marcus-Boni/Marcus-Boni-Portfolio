import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { nextOverride } from '../src/lib/theme'

/**
 * The colour scheme lives in CSS, so the stylesheet is what gets tested: every
 * token has both values, each scheme keeps the contrast DESIGN.md promises,
 * and the copies of the light values outside the app have not drifted.
 */
const css = readFileSync('src/styles/index.css', 'utf8')

type Scheme = 'light' | 'dark'

/** Every `--name: light-dark(#light, #dark)` in the stylesheet. */
const pairs: Record<string, Record<Scheme, string>> = Object.fromEntries(
  [...css.matchAll(/--([\w-]+): light-dark\((#\w{6}), (#\w{6})\)/g)].map(
    ([, name, light, dark]) => [name, { light, dark }],
  ),
)

const channels = (hex: string) =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))

function luminance(rgb: number[]) {
  const [r, g, b] = rgb.map((byte) => {
    const c = byte / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast of `text` on `page`, with `text` at `alpha`. */
function contrast(text: string, page: string, alpha = 1) {
  const ground = channels(page)
  const blended = channels(text).map((c, i) => c * alpha + ground[i] * (1 - alpha))
  const [hi, lo] = [luminance(blended), luminance(ground)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

describe('colour scheme tokens', () => {
  it('gives every @theme colour a light value and keeps its dark one', () => {
    const theme = [...css.matchAll(/^ {2}--(color-[\w-]+): (#\w{6});/gm)]
    expect(theme).toHaveLength(8)
    for (const [, name, dark] of theme) expect(pairs[name]?.dark, name).toBe(dark)
  })

  it.each(['light', 'dark'] as const)('%s: type clears AA on the page', (scheme) => {
    const on = (text: string, surface = 'color-ink', alpha = 1) =>
      contrast(pairs[text][scheme], pairs[surface][scheme], alpha)

    for (const surface of ['color-ink', 'color-ink-soft']) {
      expect(on('color-bone', surface)).toBeGreaterThanOrEqual(7)
      expect(on('color-bone-dim', surface)).toBeGreaterThanOrEqual(4.5)
    }
    expect(on('color-ember')).toBeGreaterThanOrEqual(4.5)
    // labels, and the rule that is a form field's only outline (DESIGN.md: 4:1)
    expect(on('color-smoke')).toBeGreaterThanOrEqual(4)
    for (const hue of ['code-sand', 'code-amber', 'code-clay']) {
      expect(on(hue), hue).toBeGreaterThanOrEqual(4.5)
    }
  })

  it.each([
    ['dark', /^ {2}--dim: ([\d.]+);/m],
    ['light', /content='light'\]\) \{[^}]*--dim: ([\d.]+);/],
  ] as const)('%s: text that steps back stays readable', (scheme, declared) => {
    const dim = Number(css.match(declared)![1])
    expect(
      contrast(pairs['color-bone-dim'][scheme], pairs['color-ink'][scheme], dim),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['public/page.css', 'public/404.html', 'netlify/lib/kit.ts'])(
    '%s repeats the stylesheet’s light values',
    (file) => {
      const known = new Set(Object.values(pairs).map((pair) => pair.light))
      const copies = [...readFileSync(file, 'utf8').matchAll(/light-dark\((#\w{6}),/g)]
      expect(copies.length).toBeGreaterThan(0)
      for (const [, light] of copies) expect(known, light).toContain(light)
    },
  )
})

describe('nextOverride', () => {
  it('pins the scheme the system is not showing', () => {
    expect(nextOverride('dark', 'dark')).toBe('light')
    expect(nextOverride('light', 'light')).toBe('dark')
  })

  it('unpins when the flip lands back on the system’s scheme', () => {
    expect(nextOverride('light', 'dark')).toBeNull()
    expect(nextOverride('dark', 'light')).toBeNull()
  })
})
