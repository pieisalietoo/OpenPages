import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

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
 * Real browsers paint line boxes a few px off canvas/layout x (worse in later
 * columns). Clicks must use the CSS box under the pointer, not layout.x alone.
 */
describe('WYSIWYG column insert vs CSS line-box drift', () => {
  it('inserts at the glyph under the pointer in column 2 when the CSS line box is shifted vs layout x', async () => {
    const doc = createDocument({ title: 'ColInsertDrift' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 220,
      height: 100,
      content: 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima',
    })
    section.columnCount = 2
    section.fontSize = 16
    section.lineHeight = 1.25
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()

    const sectionEl = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    stubRect(sectionEl, { left: 0, top: 0, width: 220, height: 100 })

    const lineEls = wrapper.findAll('[data-op-line]')
    const col2 = lineEls.find((l) => Number.parseFloat((l.element as HTMLElement).style.left) > 40)
    if (!col2) throw new Error('expected a second-column line')
    const col2El = col2.element as HTMLElement
    const col2Text = col2El.textContent ?? ''
    expect(col2Text.length).toBeGreaterThan(4)

    const layoutLeft = Number.parseFloat(col2El.style.left) || 0
    const layoutTop = Number.parseFloat(col2El.style.top) || 0
    // Visible line box is 10px to the right of layout.x (canvas/CSS mismatch).
    const cssDrift = 10
    for (const line of lineEls) {
      const el = line.element as HTMLElement
      const left = Number.parseFloat(el.style.left) || 0
      const top = Number.parseFloat(el.style.top) || 0
      const width = Number.parseFloat(el.style.width) || 100
      const height = Number.parseFloat(el.style.height) || 20
      const drift = el === col2El ? cssDrift : 0
      stubRect(el, { left: left + drift, top, width, height })
    }

    let col2PlainStart = 0
    for (const line of lineEls) {
      if (line.element === col2El) break
      col2PlainStart += ((line.element as HTMLElement).textContent ?? '').length
    }

    const edit = wrapper.get('[data-op-text-edit]')
    // Click the visual leading edge of the CSS box (localX ≈ 0).
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: layoutLeft + cssDrift,
      clientY: layoutTop + 4,
      pointerId: 1,
    })
    await edit.trigger('keydown', { key: 'X' })
    await nextTick()

    // Broken layout-x hit-test treats this as localX=cssDrift into the line.
    expect(section.content.indexOf('X')).toBe(col2PlainStart)

    wrapper.unmount()
  })
})
