import { describe, expect, it } from 'vitest'
import { horizontalStretchScale } from '../src/model/text-layout/stretch'

describe('horizontalStretchScale', () => {
  it('returns lineWidth / contentWidth when both are positive', () => {
    expect(horizontalStretchScale(100, 200)).toBe(2)
    expect(horizontalStretchScale(50, 50)).toBe(1)
  })

  it('returns 1 when content or line width is non-positive', () => {
    expect(horizontalStretchScale(0, 200)).toBe(1)
    expect(horizontalStretchScale(100, 0)).toBe(1)
    expect(horizontalStretchScale(-1, 10)).toBe(1)
  })
})
