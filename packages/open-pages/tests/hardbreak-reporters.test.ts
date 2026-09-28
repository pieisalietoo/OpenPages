import { describe, expect, it } from 'vitest'
import { htmlToPlainText } from '../src/model/text-layout/html-text'
import { layoutTextFrame } from '../src/model/text-layout/layout'
import { createCanvasMeasurer } from '../src/model/text-layout/measure'

const BEFORE = 'City hall convened an extraordinary session as printers inked the morning edition.'
const AFTER = 'Reporters filled the gallery while typesetters locked the late columns for press.'

describe('hard break: reporters must not sit clipped inside the edition line box', () => {
  it('tokenizes space+newline as separate tokens (\\s+ must not swallow \\n)', () => {
    // Root cause: /\\s+/ matched " \\n\\n" as one token; fillSlot appended it into line.text.
    // With white-space:pre + overflow:hidden the words after the embedded newlines were clipped.
    const plain = `${BEFORE} \n\n${AFTER}`
    const result = layoutTextFrame({
      text: plain,
      host: { x: 0, y: 0, width: 698, height: 400 },
      columnCount: 1,
      columnGap: 16,
      fontSize: 14,
      lineHeight: 1.35,
      fontFamily: 'Georgia, serif',
      exclusions: [],
      measure: createCanvasMeasurer(),
    })

    const edition = result.lines.find((l) => l.text.includes('edition.'))
    const reporters = result.lines.find((l) => l.text.includes('Reporters'))
    expect(edition).toBeTruthy()
    expect(reporters).toBeTruthy()
    if (!edition || !reporters) return

    // Exact demo DOM symptom: first op-line must NOT contain Reporters (or embedded newlines).
    expect(edition.text).not.toContain('\n')
    expect(edition.text).not.toContain('Reporters')
    expect(reporters.text).toMatch(/^Reporters/)
    expect(reporters.y).toBeGreaterThan(edition.y)
  })

  it('contenteditable div break becomes a newline and starts a new line box', () => {
    const plain = htmlToPlainText(`${BEFORE}<div> ${AFTER}</div>`)
    expect(plain).toMatch(/edition\.\n\s*Reporters/)

    const result = layoutTextFrame({
      text: plain,
      host: { x: 0, y: 0, width: 698, height: 400 },
      columnCount: 1,
      columnGap: 16,
      fontSize: 14,
      lineHeight: 1.35,
      fontFamily: 'Georgia, serif',
      exclusions: [],
      measure: createCanvasMeasurer(),
    })
    const edition = result.lines.find((l) => l.text.includes('edition.'))
    const reporters = result.lines.find((l) => l.text.includes('Reporters'))
    expect(edition?.text).not.toContain('Reporters')
    expect(reporters?.text).toMatch(/^Reporters/)
    if (!edition || !reporters) return
    expect(reporters.y).toBe(edition.y + edition.height)
  })
})
