import { describe, expect, it } from 'vitest'
import { sanitizeTextHtml } from '../src/model/sanitize-html'
import { htmlToPlainText } from '../src/model/text-layout/html-text'
import { layoutTextFrame } from '../src/model/text-layout/layout'
import { createFixedMeasurer } from '../src/model/text-layout/measure'

/** Keep marker: private-use bookends around a positive integer. */
const KEEP_RE = /\uE000(\d+)\uE001/

describe('keep-with-next', () => {
  it('sanitize preserves heading tags and data-op-keep-with-next', () => {
    const cleaned = sanitizeTextHtml(
      '<h3 data-op-keep-with-next="2">Late edition</h3><p>Body copy here.</p>',
    )
    expect(cleaned).toMatch(/<h3[^>]*data-op-keep-with-next="2"[^>]*>Late edition<\/h3>/i)
    expect(cleaned).toMatch(/<p>Body copy here\.<\/p>/i)
  })

  it('htmlToPlainText embeds a keep marker before the titled block', () => {
    const plain = htmlToPlainText(
      '<h3 data-op-keep-with-next="2">Late edition</h3><p>Reporters filled the gallery.</p>',
    )
    const m = plain.match(KEEP_RE)
    expect(m?.[1]).toBe('2')
    expect(plain).toMatch(/\uE0002\uE001\uE010h3\uE011Late edition/)
    expect(plain).toContain('Reporters filled the gallery.')
  })

  it('moves a title to the next column when fewer than min following lines fit below', () => {
    // 2 columns × 3 line slots each (host height / lineHeightPx = 3).
    // Title with keep=2 at the last slot of col 0 would leave 0 following lines → must jump to col 1.
    // em 0.5 → char width 5px at fontSize 10; column ≈95px → ~19 chars/line.
    const measure = createFixedMeasurer(0.5)
    const title = 'Late edition'
    const body =
      'Reporters filled the gallery while typesetters locked the late columns for press and more words.'
    const text = `\uE0002\uE001${title}\n${body}`

    // Fill col0 with two short lines so the title would land on the last slot without keep.
    const filler = 'aaaa aaaa\nbbbb bbbb\n'
    const result = layoutTextFrame({
      text: filler + text,
      host: { x: 0, y: 0, width: 200, height: 60 },
      columnCount: 2,
      columnGap: 10,
      fontSize: 10,
      lineHeight: 2, // 20px lines → 3 slots per column
      exclusions: [],
      measure,
    })

    const titleLine = result.lines.find((l) => l.text.includes('Late edition'))
    expect(titleLine).toBeTruthy()
    if (!titleLine) return

    const following = result.lines.filter(
      (l) => l.columnIndex === titleLine.columnIndex && l.y > titleLine.y,
    )
    expect(following.length).toBeGreaterThanOrEqual(2)
    // Title must not be alone on the last band of its column.
    expect(titleLine.columnIndex).toBe(1)
  })
})
