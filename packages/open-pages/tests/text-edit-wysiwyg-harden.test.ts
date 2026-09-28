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

describe('WYSIWYG harden: IME, columns, a11y', () => {
  it('exposes textbox semantics on the live edit surface', async () => {
    const doc = createDocument({ title: 'A11y' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 180,
      height: 60,
      content: 'Hi',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const edit = wrapper.get('[data-op-text-edit]')
    expect(edit.attributes('role')).toBe('textbox')
    expect(edit.attributes('aria-multiline')).toBe('true')

    wrapper.unmount()
  })

  it('keeps multi-column line boxes while editing and after typing', async () => {
    const doc = createDocument({ title: 'ColsLive' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 120,
      content:
        'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november',
    })
    section.columnCount = 2
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    expect(wrapper.find('[data-op-lines]').exists()).toBe(true)
    const before = wrapper.findAll('[data-op-line]').length
    expect(before).toBeGreaterThan(1)

    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('keydown', { key: '!' })
    await nextTick()
    expect(wrapper.find('[data-op-lines]').exists()).toBe(true)
    expect(wrapper.findAll('[data-op-line]').length).toBeGreaterThan(0)
    expect(section.content).toContain('!')

    wrapper.unmount()
  })

  it('commits IME composition into the model without dropping characters', async () => {
    const doc = createDocument({ title: 'Ime' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 180,
      height: 60,
      content: 'Hi',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const edit = wrapper.get('[data-op-text-edit]')
    const el = edit.element as HTMLElement

    await edit.trigger('compositionstart')
    el.textContent = 'Hi你'
    await edit.trigger('compositionupdate', { data: '你' })
    await edit.trigger('compositionend', { data: '你' })
    await nextTick()

    expect(section.content).toContain('你')
    expect(wrapper.find('[data-op-lines]').text()).toContain('你')

    wrapper.unmount()
  })

  it('places the caret in the second column on pointerdown', async () => {
    const doc = createDocument({ title: 'Col2Hit' })
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
    sectionEl.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 220,
        bottom: 100,
        width: 220,
        height: 100,
        toJSON() {
          return {}
        },
      }) as DOMRect
    for (const line of wrapper.findAll('[data-op-line]')) {
      const el = line.element as HTMLElement
      const left = Number.parseFloat(el.style.left) || 0
      const top = Number.parseFloat(el.style.top) || 0
      const width = Number.parseFloat(el.style.width) || 100
      const height = Number.parseFloat(el.style.height) || 20
      el.getBoundingClientRect = () =>
        ({
          x: left,
          y: top,
          left,
          top,
          right: left + width,
          bottom: top + height,
          width,
          height,
          toJSON() {
            return {}
          },
        }) as DOMRect
    }

    const lineEls = wrapper.findAll('[data-op-line]')
    const col2 = lineEls.find((l) => Number.parseFloat((l.element as HTMLElement).style.left) > 40)
    if (!col2) throw new Error('expected a second-column line')
    const col2El = col2.element as HTMLElement
    const col2Text = col2El.textContent ?? ''
    expect(col2Text.length).toBeGreaterThan(2)

    let col2PlainStart = 0
    for (const line of lineEls) {
      if (line.element === col2El) break
      col2PlainStart += ((line.element as HTMLElement).textContent ?? '').length
    }

    const rect = col2El.getBoundingClientRect()
    const before = section.content
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + Math.min(24, Math.max(12, rect.width * 0.4)),
      clientY: rect.top + 4,
      pointerId: 1,
    })
    await edit.trigger('keydown', { key: 'X' })
    await nextTick()

    expect(section.content).not.toBe(before)
    const xPos = section.content.indexOf('X')
    expect(xPos).toBeGreaterThanOrEqual(col2PlainStart)
    expect(xPos).toBeLessThan(col2PlainStart + col2Text.length)

    wrapper.unmount()
  })
})
