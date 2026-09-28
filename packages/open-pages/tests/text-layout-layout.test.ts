import { describe, expect, it } from 'vitest'
import { fitTextFrame } from '../src/model/text-layout/fit'
import { htmlToPlainText } from '../src/model/text-layout/html-text'
import { layoutTextFrame } from '../src/model/text-layout/layout'
import { createFixedMeasurer } from '../src/model/text-layout/measure'

const measure = createFixedMeasurer(0.5)

describe('text-layout layout + fit', () => {
  it('strips html to plain text', () => {
    expect(htmlToPlainText('<b>Hello</b> &amp; <i>world</i>')).toBe('Hello & world')
  })

  it('wraps words across a centered hole on the same band then continues below', () => {
    const result = layoutTextFrame({
      text: 'aaa bbb ccc ddd eee fff',
      host: { x: 0, y: 0, width: 200, height: 60 },
      columnCount: 1,
      columnGap: 16,
      fontSize: 10,
      lineHeight: 1,
      exclusions: [{ x: 50, y: 0, width: 50, height: 10 }],
      measure,
    })
    // char width 5; left seg w=50 → 10 chars; right seg w=100 → 20 chars
    expect(result.lines.length).toBeGreaterThanOrEqual(2)
    const firstBand = result.lines.filter((l) => l.y === 0)
    expect(firstBand.length).toBe(2)
    expect(firstBand[0]?.x).toBe(0)
    expect(firstBand[1]?.x).toBe(100)
    expect(firstBand.every((l) => l.x + l.width <= 50 || l.x >= 100)).toBe(true)
  })

  it('fills columns in order when columnCount is 2', () => {
    const result = layoutTextFrame({
      text: 'one two three four five six seven eight nine ten',
      host: { x: 0, y: 0, width: 110, height: 20 },
      columnCount: 2,
      columnGap: 10,
      fontSize: 10,
      lineHeight: 1,
      exclusions: [],
      measure,
    })
    // col width 50 → 10 chars per line; height 20 → 2 lines per col
    expect(result.lines.some((l) => l.columnIndex === 0)).toBe(true)
    expect(result.lines.some((l) => l.columnIndex === 1)).toBe(true)
    const maxYCol0 = Math.max(
      ...result.lines.filter((l) => l.columnIndex === 0).map((l) => l.y),
      -1,
    )
    const minYCol1 = Math.min(
      ...result.lines.filter((l) => l.columnIndex === 1).map((l) => l.y),
      999,
    )
    expect(maxYCol0).toBeLessThanOrEqual(10)
    expect(minYCol1).toBe(0)
  })

  it('fit fill grows short text toward frame height and shrinks long text to fit', () => {
    const host = { x: 0, y: 0, width: 100, height: 80 }
    const short = fitTextFrame({
      text: 'hi',
      host,
      columnCount: 1,
      columnGap: 16,
      fontSize: 10,
      lineHeight: 1.2,
      exclusions: [],
      measure,
      mode: 'fill',
    })
    expect(short.fontSize).toBeGreaterThan(10)
    expect(short.lineHeight).toBe(1.2)
    expect(short.overflow).toBe(false)
    const last = short.lines[short.lines.length - 1]
    expect(last).toBeTruthy()
    if (last) {
      expect(last.y + last.height).toBeLessThanOrEqual(host.height + 0.5)
    }

    const longWords = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ')
    const long = fitTextFrame({
      text: longWords,
      host,
      columnCount: 1,
      columnGap: 16,
      fontSize: 20,
      lineHeight: 1.2,
      exclusions: [],
      measure,
      mode: 'fill',
    })
    expect(long.fontSize).toBeLessThan(20)
    expect(long.overflow).toBe(false)
  })

  it('fit none keeps the given font size', () => {
    const result = fitTextFrame({
      text: 'hello world',
      host: { x: 0, y: 0, width: 200, height: 100 },
      columnCount: 1,
      columnGap: 16,
      fontSize: 14,
      lineHeight: 1.4,
      exclusions: [],
      measure,
      mode: 'none',
    })
    expect(result.fontSize).toBe(14)
    expect(result.lineHeight).toBe(1.4)
  })
})
