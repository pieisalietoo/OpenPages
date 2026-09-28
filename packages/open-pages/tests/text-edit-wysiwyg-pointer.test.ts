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

describe('WYSIWYG pointer caret and keyboard', () => {
  it('places the caret from a click on a line box', async () => {
    const doc = createDocument({ title: 'ClickCaret' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 60,
      content: 'Hello',
    })
    section.fontSize = 16
    section.lineHeight = 1.25
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const line = wrapper.get('[data-op-line]')
    const el = line.element as HTMLElement
    const rect = el.getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + 1,
      clientY: rect.top + 4,
    })
    await nextTick()

    // Caret near start — typing inserts at start.
    await edit.trigger('keydown', { key: 'X' })
    await nextTick()
    expect(section.content.startsWith('X')).toBe(true)

    wrapper.unmount()
  })

  it('moves the caret with arrow keys and deletes across the caret', async () => {
    const doc = createDocument({ title: 'ArrowCaret' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 60,
      content: 'ABCD',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const edit = wrapper.get('[data-op-text-edit]')
    // beginTextEdit leaves caret at end (4). Move left twice → offset 2, backspace → remove 'B'
    await edit.trigger('keydown', { key: 'ArrowLeft' })
    await edit.trigger('keydown', { key: 'ArrowLeft' })
    await edit.trigger('keydown', { key: 'Backspace' })
    await nextTick()
    expect(section.content).toBe('ACD')

    wrapper.unmount()
  })

  it('shows a selection highlight when the range is non-collapsed', async () => {
    const doc = createDocument({ title: 'SelHi' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 60,
      content: 'Hello',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const edit = wrapper.get('[data-op-text-edit]')
    // Select all via shortcut handled in Phase 2
    await edit.trigger('keydown', { key: 'a', ctrlKey: true })
    await nextTick()
    expect(wrapper.find('[data-op-text-sel]').exists()).toBe(true)

    wrapper.unmount()
  })
})
