import { describe, expect, it, vi } from 'vitest'
import { offsetAtClientPoint } from '../src/model/text-layout/dom-hit'
import { createFixedMeasurer } from '../src/model/text-layout/measure'
import { withModelOffsets } from './helpers/model-offsets'

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

/**
 * Real browsers paint glyphs with CSS metrics while layout/hit fallback uses
 * canvas measure. Prefer DOM Range widths when available so multi-column
 * (narrower lines / smaller fitted fonts) does not accumulate a constant
 * character drift under the pointer.
 */
describe('multi-column insert vs canvas/CSS measure drift', () => {
  it('uses DOM Range glyph widths when layout lines are provided (not canvas alone)', () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const lineEl = document.createElement('div')
    lineEl.setAttribute('data-op-line', '')
    lineEl.textContent = 'abcdefghij'
    root.appendChild(lineEl)
    stubRect(lineEl, { left: 0, top: 0, width: 200, height: 20 })

    // Canvas fallback: 8px/glyph. CSS Range stub: 10px/glyph (systematic bias).
    const canvasEm = 0.5
    const cssPx = 10
    const measure = createFixedMeasurer(canvasEm)
    const style = { fontFamily: 'serif', fontSize: 16 }

    const createRange = document.createRange.bind(document)
    vi.spyOn(document, 'createRange').mockImplementation(() => {
      const range = createRange()
      let end = 0
      const setEnd = range.setEnd.bind(range)
      range.setEnd = ((node: Node, offset: number) => {
        end = offset
        setEnd(node, offset)
      }) as typeof range.setEnd
      range.getClientRects = () => {
        const w = end * cssPx
        const rect = {
          left: 0,
          right: w,
          width: w,
          top: 0,
          bottom: 20,
          height: 20,
          x: 0,
          y: 0,
          toJSON() {
            return {}
          },
        } as DOMRect
        return {
          length: w > 0 ? 1 : 0,
          item: (i: number) => (i === 0 && w > 0 ? rect : null),
          0: rect,
          [Symbol.iterator]: function* () {
            if (w > 0) yield rect
          },
        } as unknown as DOMRectList
      }
      range.getBoundingClientRect = () => {
        const w = end * cssPx
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: w,
          bottom: 20,
          width: w,
          height: 20,
          toJSON() {
            return {}
          },
        } as DOMRect
      }
      return range
    })

    const lines = withModelOffsets([
      { text: 'abcdefghij', x: 0, y: 0, width: 200, height: 20, columnIndex: 0 },
    ])

    // Click at CSS mid of glyph index 4 (localX = 4*10 + 5 = 45).
    // Canvas-only would treat 45px as ~5.6 glyphs (45/8) → snap to 6.
    const offset = offsetAtClientPoint([lineEl], 45, 10, { measure, style }, lines)
    expect(offset).toBe(4)

    vi.restoreAllMocks()
    root.remove()
  })
})
