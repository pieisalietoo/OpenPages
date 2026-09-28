import { describe, expect, it } from 'vitest'
import { columnRects, freeSegmentsForBand, iterLineSlots } from '../src/model/text-layout/geometry'

describe('text-layout geometry', () => {
  it('splits a host into equal columns with gap', () => {
    const cols = columnRects({ x: 0, y: 0, width: 330, height: 200 }, 3, 15)
    expect(cols).toEqual([
      { x: 0, y: 0, width: 100, height: 200 },
      { x: 115, y: 0, width: 100, height: 200 },
      { x: 230, y: 0, width: 100, height: 200 },
    ])
  })

  it('punches a centered exclusion into left and right free segments', () => {
    const segs = freeSegmentsForBand({ x: 0, y: 0, width: 200, height: 20 }, [
      { x: 60, y: 0, width: 40, height: 20 },
    ])
    expect(segs).toEqual([
      { x: 0, width: 60 },
      { x: 100, width: 100 },
    ])
  })

  it('walks columns top-to-bottom then next column, skipping covered bands', () => {
    const slots = iterLineSlots({
      host: { x: 0, y: 0, width: 215, height: 40 },
      columnCount: 2,
      columnGap: 15,
      lineHeightPx: 20,
      exclusions: [{ x: 0, y: 0, width: 100, height: 20 }],
    })
    // col0: y=0 fully covered → no slot; y=20 full width 100
    // col1: y=0 and y=20 full width 100
    expect(
      slots.map((s) => ({ x: s.x, y: s.y, width: s.width, columnIndex: s.columnIndex })),
    ).toEqual([
      { x: 0, y: 20, width: 100, columnIndex: 0 },
      { x: 115, y: 0, width: 100, columnIndex: 1 },
      { x: 115, y: 20, width: 100, columnIndex: 1 },
    ])
  })
})
