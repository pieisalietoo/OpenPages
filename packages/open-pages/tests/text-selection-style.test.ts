import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'
import {
  applyInlineStyleToSelection,
  bumpFontSizesInSelection,
  getEditableSelectionRange,
} from '../src/model/text-inline'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

function selectOffsets(el: HTMLElement, start: number, end: number) {
  const text = el.firstChild
  if (!text || text.nodeType !== Node.TEXT_NODE) {
    throw new Error('expected a text node')
  }
  const range = el.ownerDocument.createRange()
  range.setStart(text, start)
  range.setEnd(text, end)
  const sel = el.ownerDocument.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  el.ownerDocument.dispatchEvent(new Event('selectionchange'))
}

function selectNodeContents(node: Node) {
  const doc = node.ownerDocument
  if (!doc) throw new Error('expected ownerDocument')
  const range = doc.createRange()
  range.selectNodeContents(node)
  const sel = doc.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
  doc.dispatchEvent(new Event('selectionchange'))
}

describe('selection-scoped inline text styles', () => {
  it('detects a non-collapsed range inside the editable root', () => {
    const root = document.createElement('div')
    root.textContent = 'Hello World'
    document.body.appendChild(root)
    expect(getEditableSelectionRange(root)).toBeNull()
    selectOffsets(root, 0, 5)
    expect(getEditableSelectionRange(root)?.toString()).toBe('Hello')
    root.remove()
  })

  it('applies font/size/lineHeight/color only to the selected range', () => {
    const root = document.createElement('div')
    root.textContent = 'Hello World'
    document.body.appendChild(root)
    selectOffsets(root, 0, 5)
    expect(
      applyInlineStyleToSelection(root, {
        fontFamily: 'Arial, sans-serif',
        fontSize: 20,
        lineHeight: 1.8,
        color: '#ff0000',
      }),
    ).toBe(true)
    const span = root.querySelector('span')
    expect(span?.textContent).toBe('Hello')
    expect(span?.style.fontFamily).toContain('Arial')
    expect(span?.style.fontSize).toBe('20px')
    expect(span?.style.lineHeight).toBe('1.8')
    expect(span?.style.color).toMatch(/rgb\(255,\s*0,\s*0\)|#ff0000/i)
    expect(root.textContent).toBe('Hello World')
    root.remove()
  })

  it('bumps font sizes inside the selection relatively by ±2', () => {
    const root = document.createElement('div')
    root.style.fontSize = '14px'
    root.innerHTML =
      '<span style="font-size: 14px">aa</span><span style="font-size: 16px">bb</span>'
    document.body.appendChild(root)
    const firstText = root.firstChild?.firstChild
    const lastText = root.lastChild?.firstChild
    if (!firstText || !lastText) throw new Error('expected text nodes')
    const range = document.createRange()
    range.setStart(firstText, 0)
    range.setEnd(lastText, 2)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)

    expect(bumpFontSizesInSelection(root, 2)).toBe(true)
    expect(root.innerHTML).toMatch(/font-size:\s*16px/i)
    expect(root.innerHTML).toMatch(/font-size:\s*18px/i)
    expect(root.textContent).toBe('aabb')
    root.remove()
  })

  it('chrome color on a partial selection does not change section.color', async () => {
    const doc = createDocument({ title: 'ColorSel' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 220,
      height: 50,
      content: 'Hello World',
    })
    section.color = '#111111'
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    selectOffsets(wrapper.get('[data-op-text-edit]').element as HTMLElement, 0, 5)
    await wrapper.get('[data-op-text-chrome-color]').trigger('mousedown')
    const colorInput = wrapper.get('[data-op-text-chrome-color]')
    ;(colorInput.element as HTMLInputElement).value = '#ff0000'
    await colorInput.trigger('input')
    expect(section.color).toBe('#111111')
    expect(section.content).toMatch(/color/i)
    expect(section.content).toContain('World')
    wrapper.unmount()
  })

  it('chrome size / A+ / lineHeight / family apply to selection only', async () => {
    const doc = createDocument({ title: 'SizeSel' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 220,
      height: 50,
      content: 'Hello World',
    })
    section.fontSize = 14
    section.fontFamily = 'Georgia, serif'
    section.lineHeight = 1.4
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    const edit = wrapper.get('[data-op-text-edit]').element as HTMLElement

    selectOffsets(edit, 0, 5)
    await wrapper.get('[data-op-text-chrome-size]').trigger('mousedown')
    const sizeInput = wrapper.get('[data-op-text-chrome-size]')
    ;(sizeInput.element as HTMLInputElement).value = '20'
    await sizeInput.trigger('change')
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*20px/i)

    const sized = edit.querySelector('span')
    expect(sized).toBeTruthy()
    if (!sized) throw new Error('expected sized span')
    selectNodeContents(sized)
    await wrapper.get('[data-op-chrome-font-up]').trigger('mousedown')
    await wrapper.get('[data-op-chrome-font-up]').trigger('click')
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*22px/i)

    const afterBump = edit.querySelector('span')
    if (!afterBump) throw new Error('expected span after bump')
    selectNodeContents(afterBump)
    await wrapper.get('[data-op-text-chrome-lineheight]').trigger('mousedown')
    const lhInput = wrapper.get('[data-op-text-chrome-lineheight]')
    ;(lhInput.element as HTMLInputElement).value = '2'
    await lhInput.trigger('change')
    expect(section.lineHeight).toBe(1.4)
    expect(section.content).toMatch(/line-height:\s*2/i)

    const afterLh = edit.querySelector('span')
    if (!afterLh) throw new Error('expected span after line-height')
    selectNodeContents(afterLh)
    await wrapper.get('[data-op-text-chrome] select').trigger('mousedown')
    const family = wrapper.get('[data-op-text-chrome] select')
    ;(family.element as HTMLSelectElement).value = 'arial'
    await family.trigger('change')
    expect(section.fontFamily).toBe('Georgia, serif')
    expect(section.content.toLowerCase()).toContain('arial')

    wrapper.unmount()
  })
})
