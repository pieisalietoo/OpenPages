import { describe, expect, it } from 'vitest'
import { caretRectForOffset } from '../src/model/text-layout/caret'
import {
  lineRangeAtOffset,
  moveCaretVertically,
  offsetAtPoint,
} from '../src/model/text-layout/hit-test'
import { createFixedMeasurer } from '../src/model/text-layout/measure'
import { selectionRects } from '../src/model/text-layout/selection'
import { withModelOffsets } from './helpers/model-offsets'

describe('offsetAtPoint', () => {
  const measure = createFixedMeasurer(0.5)
  const style = { fontFamily: 'serif', fontSize: 16 }
  const lines = withModelOffsets([
    { text: 'Hello', x: 10, y: 0, width: 80, height: 20, columnIndex: 0 },
    { text: 'World', x: 10, y: 20, width: 80, height: 20, columnIndex: 0 },
  ])

  it('maps a click on the first line to a character offset', () => {
    // 'He' width = 2 * 16 * 0.5 = 16 → x = 10+16 = 26 is after 'He'
    expect(offsetAtPoint(lines, 10 + 16, 10, measure, style)).toBe(2)
  })

  it('maps a click on the second line into the concatenated offset', () => {
    expect(offsetAtPoint(lines, 10, 25, measure, style)).toBe(5)
  })
})

describe('selectionRects', () => {
  const measure = createFixedMeasurer(0.5)
  const style = { fontFamily: 'serif', fontSize: 16 }
  const lines = withModelOffsets([
    { text: 'Hello', x: 0, y: 0, width: 80, height: 20, columnIndex: 0 },
    { text: 'World', x: 0, y: 20, width: 80, height: 20, columnIndex: 0 },
  ])

  it('returns highlight rects covering an offset range across lines', () => {
    const rects = selectionRects(lines, 3, 7, measure, style)
    expect(rects.length).toBe(2)
    expect(rects[0]?.y).toBe(0)
    expect(rects[1]?.y).toBe(20)
  })
})

describe('moveCaretVertically', () => {
  const measure = createFixedMeasurer(0.5)
  const style = { fontFamily: 'serif', fontSize: 16 }

  it('reaches a taller heading line above a body line', () => {
    const lines = withModelOffsets([
      { text: 'Heading', x: 0, y: 0, width: 120, height: 28, columnIndex: 0, fontScale: 1.25 },
      { text: 'Body text here', x: 0, y: 28, width: 160, height: 20, columnIndex: 0 },
    ])
    // Offset at start of body (7)
    const next = moveCaretVertically(lines, 7, 'up', measure, style)
    expect(next).toBeLessThan(7)
    expect(lines[0] && next <= lines[0].text.length).toBe(true)
  })
})

describe('offsetAtPoint multi-column', () => {
  const measure = createFixedMeasurer(0.5)
  const style = { fontFamily: 'serif', fontSize: 16 }

  it('picks the column under x when several lines share the same y band', () => {
    // Side-by-side columns: first matching y must not win over x.
    const lines = withModelOffsets([
      { text: 'AAAA', x: 0, y: 0, width: 40, height: 20, columnIndex: 0 },
      { text: 'BBBB', x: 60, y: 0, width: 40, height: 20, columnIndex: 1 },
    ])
    // 2 glyphs into BBBB (each glyph 8px) → plain offset 4+2
    expect(offsetAtPoint(lines, 60 + 16, 10, measure, style)).toBe(6)
  })
})

describe('lineRangeAtOffset', () => {
  const lines = withModelOffsets([
    { text: 'Hello', x: 0, y: 0, width: 80, height: 20, columnIndex: 0 },
    { text: 'World', x: 0, y: 20, width: 80, height: 20, columnIndex: 0 },
  ])

  it('returns the plain range of the line that owns the offset', () => {
    expect(lineRangeAtOffset(lines, 2)).toEqual({ start: 0, end: 5 })
    expect(lineRangeAtOffset(lines, 7)).toEqual({ start: 5, end: 10 })
  })
})

describe('arrow navigation helpers stay consistent with caret', () => {
  it('caret at offset matches hit-test roundtrip on a glyph', () => {
    const measure = createFixedMeasurer(0.5)
    const style = { fontFamily: 'serif', fontSize: 16 }
    const lines = withModelOffsets([
      { text: 'Abc', x: 0, y: 0, width: 60, height: 20, columnIndex: 0 },
    ])
    const rect = caretRectForOffset(lines, 2, measure, style)
    expect(rect).not.toBeNull()
    if (!rect) return
    expect(offsetAtPoint(lines, rect.x, rect.y + 1, measure, style)).toBe(2)
  })
})
