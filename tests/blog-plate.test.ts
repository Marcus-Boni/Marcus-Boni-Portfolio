import { describe, expect, it } from 'vitest'

import { createPlateField, hashSeed, sampleField } from '@/blog/lib/plate'
import { entryNumber, formatPostDateCompact } from '@/blog/lib/text'

describe('field plates', () => {
  it('derives the same terrain from the same slug, every time', () => {
    const first = createPlateField(hashSeed('da-planilha-ao-produto'))
    const second = createPlateField(hashSeed('da-planilha-ao-produto'))
    expect(second).toEqual(first)
    expect(sampleField(second, 0.4, 0.6)).toBe(sampleField(first, 0.4, 0.6))
  })

  it('gives different posts different terrain', () => {
    const one = createPlateField(hashSeed('rag-sobre-notas-de-reuniao'))
    const other = createPlateField(hashSeed('agentes-como-colegas-de-time'))
    expect(other).not.toEqual(one)
    expect(sampleField(other, 0.4, 0.6)).not.toBe(sampleField(one, 0.4, 0.6))
  })

  it('always raises at least two hills, so no plate is an empty basin', () => {
    for (const slug of ['a', 'postgres-legado-sem-medo', 'what-a-hackathon-teaches', '']) {
      const { bumps, accent } = createPlateField(hashSeed(slug))
      expect(bumps.length).toBeGreaterThanOrEqual(5)
      expect(bumps[0].height).toBeGreaterThan(0)
      expect(bumps[1].height).toBeGreaterThan(0)
      expect(accent).toBeGreaterThanOrEqual(2)
    }
  })

  it('only moves the terrain when time is passed', () => {
    const field = createPlateField(hashSeed('pwa-para-portal-do-cliente'))
    expect(sampleField(field, 0.8, 0.5, 0)).toBe(sampleField(field, 0.8, 0.5))
    expect(sampleField(field, 0.8, 0.5, 3)).not.toBe(sampleField(field, 0.8, 0.5))
  })
})

describe('ledger formatting', () => {
  it('pads entry ordinals to three digits', () => {
    expect(entryNumber(7)).toBe('007')
    expect(entryNumber(128)).toBe('128')
  })

  it('prints fixed-width day–month–year dates in both languages', () => {
    expect(formatPostDateCompact('2026-11-03T12:00:00.000Z', 'pt')).toBe('03 nov 2026')
    expect(formatPostDateCompact('2026-11-03T12:00:00.000Z', 'en')).toBe('03 Nov 2026')
  })

  it('returns nothing for a missing or malformed date', () => {
    expect(formatPostDateCompact(null, 'pt')).toBe('')
    expect(formatPostDateCompact(undefined, 'en')).toBe('')
    expect(formatPostDateCompact('not-a-date', 'pt')).toBe('')
  })
})
