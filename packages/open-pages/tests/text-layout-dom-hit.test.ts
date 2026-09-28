import { describe, expect, it } from 'vitest'
import { caretLeftInLineEl, offsetAtClientPoint } from '../src/model/text-layout/dom-hit'
import { createFixedMeasurer } from '../src/model/text-layout/measure'

function stubRect(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
) {
  el.getBoundingClientRect = () =>
    ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      toJSON() {
        return {}
      },
    }) as DOMRect
}

describe('offsetAtClientPoint (DOM hit-test)', () => {
  it('picks the second column line by client rect, not the first y-band sibling', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const col0 = document.createElement('div')
    col0.setAttribute('data-op-line', '')
    col0.textContent = 'AAAA'
    const col1 = document.createElement('div')
    col1.setAttribute('data-op-line', '')
    col1.textContent = 'BBBB'
    root.append(col0, col1)
    stubRect(col0, { left: 0, top: 0, width: 40, height: 20 })
    stubRect(col1, { left: 60, top: 0, width: 40, height: 20 })

    const measure = createFixedMeasurer(0.5)
    const style = { fontFamily: 'serif', fontSize: 16 }
    // 2 glyphs into BBBB (each glyph 8px) → plain offset 4+2; happy-dom has no Range widths
    // so canvas fallback uses localX from the CSS box.
    expect(offsetAtClientPoint([col0, col1], 60 + 16, 10, { measure, style })).toBe(6)

    root.remove()
  })

  it('maps caret left within a line from a local offset via fallback measure', () => {
    const el = document.createElement('div')
    el.textContent = 'Hi'
    document.body.appendChild(el)
    stubRect(el, { left: 10, top: 0, width: 40, height: 20 })
    const measure = createFixedMeasurer(0.5)
    const style = { fontFamily: 'serif', fontSize: 16 }
    expect(caretLeftInLineEl(el, 1, { measure, style })).toBe(measure('H', style))
    el.remove()
  })
})
