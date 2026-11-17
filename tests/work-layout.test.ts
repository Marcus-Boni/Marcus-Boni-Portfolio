import { describe, expect, it } from 'vitest'

import { workTrackDistance } from '@/lib/work-layout'

describe('workTrackDistance', () => {
  it('scrolls until the padded track end reaches the visible track width', () => {
    expect(workTrackDistance({
      trackWidth: 2600,
      visibleWidth: 1238,
    })).toBe(1362)
  })

  it('does not create a negative scroll range when the track already fits', () => {
    expect(workTrackDistance({
      trackWidth: 900,
      visibleWidth: 1238,
    })).toBe(0)
  })
})
