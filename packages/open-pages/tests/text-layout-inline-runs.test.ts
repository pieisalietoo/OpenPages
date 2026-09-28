import { describe, expect, it } from 'vitest'
import { inlineRunsFromHtml, sliceInlineRuns } from '../src/model/text-layout/inline-runs'

describe('inlineRunsFromHtml / sliceInlineRuns', () => {
  it('extracts bold italic underline strike and color', () => {
    const runs = inlineRunsFromHtml(
      'a <b>B</b> <i>I</i> <u>U</u> <s>S</s> <span style="color: #f00">C</span>',
    )
    const joined = runs.map((r) => r.text).join('')
    expect(joined.replace(/\s+/g, ' ').trim()).toMatch(/a B I U S C/)
    expect(runs.some((r) => r.text.includes('B') && r.bold)).toBe(true)
    expect(runs.some((r) => r.text.includes('I') && r.italic)).toBe(true)
    expect(runs.some((r) => r.text.includes('U') && r.underline)).toBe(true)
    expect(runs.some((r) => r.text.includes('S') && r.strike)).toBe(true)
    expect(runs.some((r) => r.text.includes('C') && r.color)).toBe(true)
  })

  it('slices without leaking full run text into a partial line range', () => {
    const runs = inlineRunsFromHtml('alpha bravo charlie delta echo foxtrot')
    const slice = sliceInlineRuns(runs, 6, 11) // "bravo"
    expect(slice.map((r) => r.text).join('')).toBe('bravo')
    expect(slice.every((r) => r.text.length <= 5)).toBe(true)
  })
})
