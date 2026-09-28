import { describe, expect, it } from 'vitest'
import { plainTextOf } from '../src/model/text-edit/plain-offset'
import {
  applyInlineStyleToPlainRange,
  bumpFontSizeInPlainRange,
  plainOffsetFromDom,
  wrapPlainRangeWithCommand,
} from '../src/model/text-edit/plain-style'

describe('plain-style model edits', () => {
  it('wraps a plain range with inline color without changing outer text', () => {
    const next = applyInlineStyleToPlainRange('Hello World', 0, 5, { color: '#ff0000' })
    expect(plainTextOf(next)).toBe('Hello World')
    expect(next).toMatch(/color/i)
    expect(next).toContain('World')
  })

  it('wraps bold via command tag', () => {
    const next = wrapPlainRangeWithCommand('Hello', 0, 5, 'bold')
    expect(next).toMatch(/<b>Hello<\/b>|<strong>Hello<\/strong>/i)
  })

  it('bumps font size on a range', () => {
    const next = bumpFontSizeInPlainRange('Hello', 0, 5, 2, 14)
    expect(next).toMatch(/font-size:\s*16px/i)
  })

  it('maps DOM points to plain offsets', () => {
    const root = document.createElement('div')
    root.textContent = 'Hello'
    document.body.appendChild(root)
    const text = root.firstChild as Text
    expect(plainOffsetFromDom(root, text, 2)).toBe(2)
    root.remove()
  })
})
