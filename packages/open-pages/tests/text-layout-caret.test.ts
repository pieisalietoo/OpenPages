import { describe, expect, it } from 'vitest'
import { type CaretRect, caretRectForOffset } from '../src/model/text-layout/caret'
import { createFixedMeasurer } from '../src/model/text-layout/measure'
import { withModelOffsets } from './helpers/model-offsets'

describe('caretRectForOffset', () => {
  const measure = createFixedMeasurer(0.5)
  const style = { fontFamily: 'serif', fontSize: 16 }

  it('returns null for empty lines', () => {
    expect(caretRectForOffset([], 0, measure, style)).toBeNull()
  })

  it('places the caret within a single line by measured prefix width', () => {
    const lines = withModelOffsets([
      { text: 'Hello', x: 10, y: 20, width: 80, height: 22, columnIndex: 0 },
    ])
    const mid = caretRectForOffset(lines, 2, measure, style) as CaretRect
    expect(mid.x).toBe(10 + measure('He', style))
    expect(mid.y).toBe(20)
    expect(mid.height).toBe(22)

    const end = caretRectForOffset(lines, 5, measure, style) as CaretRect
    expect(end.x).toBe(10 + measure('Hello', style))
  })

  it('continues offsets across soft-wrapped lines without synthetic newlines', () => {
    const lines = withModelOffsets([
      { text: 'Hi', x: 0, y: 0, width: 40, height: 20, columnIndex: 0 },
      { text: 'Yo', x: 0, y: 20, width: 40, height: 20, columnIndex: 0 },
    ])
    // concat "HiYo" → offsets 0..4
    const onSecond = caretRectForOffset(lines, 2, measure, style) as CaretRect
    expect(onSecond.y).toBe(20)
    expect(onSecond.x).toBe(0)

    const end = caretRectForOffset(lines, 4, measure, style) as CaretRect
    expect(end.y).toBe(20)
    expect(end.x).toBe(measure('Yo', style))
  })
})
