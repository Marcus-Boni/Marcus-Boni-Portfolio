/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest'

import {
  calmAt,
  current,
  FIELD_SOURCE,
  fieldChar,
  printHead,
  simplex,
  veinHeat,
} from '../src/animations/codeField'

describe('source field', () => {
  it('prints its own source as one run of text', () => {
    // the wall opens on this file's own header comment
    expect(FIELD_SOURCE.startsWith('/** * Source field.')).toBe(true)
    expect(FIELD_SOURCE).toContain('export function createCodeField')
    expect(FIELD_SOURCE).not.toMatch(/\s{2,}|\n/)
    // the wall outruns the file and starts over
    expect(fieldChar(FIELD_SOURCE.length + 4)).toBe(FIELD_SOURCE[4])
  })

  it('keeps the current deterministic, bounded and moving', () => {
    expect(current(0.3, -0.2, 1, 0.22)).toBe(current(0.3, -0.2, 1, 0.22))
    expect(current(0.3, -0.2, 1, 0.22)).not.toBe(current(0.3, -0.2, 9, 0.22))
    for (let i = 0; i < 400; i++) {
      const x = (i % 20) / 10 - 1
      const y = Math.floor(i / 20) / 20 - 0.5
      expect(Math.abs(current(x, y, i * 0.05, 1.2, 1))).toBeLessThan(1.2)
      expect(Math.abs(simplex(i * 0.37, i * 0.11))).toBeLessThanOrEqual(1)
    }
  })

  it('lights a vein along one contour and widens it on demand', () => {
    expect(veinHeat(0.1)).toBe(1)
    expect(veinHeat(-0.4)).toBe(0)
    expect(veinHeat(0.6)).toBe(0)
    expect(veinHeat(0.22, 0.2)).toBeGreaterThan(veinHeat(0.22))
  })

  it('steps back inside a quiet zone and returns over a soft edge', () => {
    const zone = { x: 100, y: 200, width: 300, height: 40 }
    expect(calmAt(250, 220, zone)).toBe(1)
    expect(calmAt(100, 200, zone)).toBe(1)
    const near = calmAt(80, 220, zone)
    expect(near).toBeGreaterThan(0)
    expect(near).toBeLessThan(1)
    expect(calmAt(250, 400, zone)).toBe(0)
  })

  it('moves the print head row by row, left to right', () => {
    expect(printHead(0, 100, 40)).toEqual({ row: 0, col: 0 })
    expect(printHead(0.5, 100, 40)).toEqual({ row: 20, col: 0 })
    expect(printHead(0.5625, 100, 40)).toEqual({ row: 22, col: 50 })
    // done: the last row is full, and an overshoot cannot leave the wall
    expect(printHead(1, 100, 40)).toEqual({ row: 39, col: 100 })
    expect(printHead(1.4, 100, 40)).toEqual({ row: 39, col: 100 })
  })
})
