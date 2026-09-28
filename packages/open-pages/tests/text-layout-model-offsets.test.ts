import { describe, expect, it } from 'vitest'
import { plainTextOf } from '../src/model/text-edit/plain-offset'
import { lineRangeAtOffset, offsetAtPoint } from '../src/model/text-layout/hit-test'
import { htmlToPlainText } from '../src/model/text-layout/html-text'
import { layoutTextFrame } from '../src/model/text-layout/layout'
import { createFixedMeasurer } from '../src/model/text-layout/measure'

const measure = createFixedMeasurer(0.5)

describe('model-first layout offsets', () => {
  it('line texts concatenate to the same plain string as plainTextOf(html)', () => {
    const html =
      '<h3>Title</h3><ul><li>Alpha</li><li>Beta</li></ul><ol><li>One</li><li>Two</li></ol><p>to show body flow</p>'
    const model = plainTextOf(html)
    const laid = layoutTextFrame({
      text: htmlToPlainText(html),
      host: { x: 0, y: 0, width: 400, height: 400 },
      columnCount: 1,
      columnGap: 12,
      fontSize: 14,
      lineHeight: 1.3,
      exclusions: [],
      measure,
    })
    const concat = laid.lines.map((l) => l.text).join('')
    expect(concat).toBe(model)
    // List markers are not part of editable plain text.
    expect(concat).not.toContain('•')
    expect(concat).not.toMatch(/\d+\. /)
  })

  it('assigns continuous modelStart/modelEnd covering the model plain range', () => {
    const html = '<p>Hello</p><ul><li>World</li></ul><p>show flow</p>'
    const model = plainTextOf(html)
    const laid = layoutTextFrame({
      text: htmlToPlainText(html),
      host: { x: 0, y: 0, width: 400, height: 300 },
      columnCount: 1,
      columnGap: 12,
      fontSize: 14,
      lineHeight: 1.3,
      exclusions: [],
      measure,
    })
    expect(laid.lines.length).toBeGreaterThan(0)
    let pos = 0
    for (const line of laid.lines) {
      expect(line.modelStart).toBe(pos)
      expect(line.modelEnd).toBe(pos + line.text.length)
      expect(model.slice(line.modelStart, line.modelEnd)).toBe(line.text)
      pos = line.modelEnd
    }
    expect(pos).toBe(model.length)
  })

  it('offsetAtPoint returns model offsets (show not shifted toward flow by list markers)', () => {
    const html =
      '<ul><li>Unordered item one</li><li>Unordered item two</li></ul>' +
      '<ol><li>Ordered item one</li><li>Ordered item two</li></ol>' +
      '<p>Closing paragraph after lists to show body flow resumes.</p>'
    const model = plainTextOf(html)
    const showAt = model.indexOf('show')
    expect(showAt).toBeGreaterThan(0)
    const laid = layoutTextFrame({
      text: htmlToPlainText(html),
      host: { x: 0, y: 0, width: 360, height: 400 },
      columnCount: 1,
      columnGap: 12,
      fontSize: 14,
      lineHeight: 1.3,
      exclusions: [],
      measure,
    })
    const line = laid.lines.find((l) => l.text.includes('show'))
    expect(line).toBeTruthy()
    if (!line) return
    const local = line.text.indexOf('show')
    // Click at the start of "show" on that line (fixed measurer: 0.5em per glyph).
    const x = line.x + local * 14 * 0.5
    const y = line.y + line.height / 2
    const style = { fontFamily: 'serif', fontSize: 14 }
    expect(offsetAtPoint(laid.lines, x, y, measure, style)).toBe(showAt)
    expect(lineRangeAtOffset(laid.lines, showAt)).toEqual({
      start: line.modelStart,
      end: line.modelEnd,
    })
  })

  it('keeps soft-wrap spaces in the model so offsets match plainTextOf', () => {
    // Narrow width forces a wrap on a space inside the blockquote sentence.
    const html =
      '<blockquote>A short block quote in italic, for pull language or epigraphs.</blockquote>'
    const model = plainTextOf(html)
    const laid = layoutTextFrame({
      text: htmlToPlainText(html),
      host: { x: 0, y: 0, width: 180, height: 200 },
      columnCount: 1,
      columnGap: 12,
      fontSize: 14,
      lineHeight: 1.3,
      exclusions: [],
      measure,
    })
    expect(laid.lines.length).toBeGreaterThan(1)
    const concat = laid.lines.map((l) => l.text).join('')
    expect(concat).toBe(model)
    expect(concat).toContain('language or')
  })

  it('offsetAtPoint on a scaled heading uses fontScale so end-of-word is not early', () => {
    const html = '<h3>Evening press</h3><p>Body follows here with more words.</p>'
    const model = plainTextOf(html)
    const endEve = model.indexOf('Evening') + 'Evening'.length
    const laid = layoutTextFrame({
      text: htmlToPlainText(html),
      host: { x: 0, y: 0, width: 400, height: 200 },
      columnCount: 1,
      columnGap: 12,
      fontSize: 14,
      lineHeight: 1.3,
      exclusions: [],
      measure,
    })
    const line = laid.lines.find((l) => l.text.startsWith('Evening'))
    expect(line).toBeTruthy()
    if (!line) return
    expect(line.fontScale ?? 1).toBeGreaterThan(1)
    // x at end of "Evening" in scaled ems (fixed measurer).
    const scaled = 14 * (line.fontScale ?? 1)
    const x = line.x + 'Evening'.length * scaled * 0.5 - 0.5
    const y = line.y + line.height / 2
    const style = { fontFamily: 'serif', fontSize: 14 }
    expect(offsetAtPoint(laid.lines, x, y, measure, style)).toBe(endEve)
  })
})
