import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { createHistory } from '../src/model/history'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('A+ keeps chrome selection', () => {
  it('keeps the selection stand-in after clicking A+', async () => {
    const doc = createDocument({ title: 'APlus' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 200,
      height: 50,
      content: 'Hello World',
    })
    section.fontSize = 14
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    const edit = wrapper.get('[data-op-text-edit]').element as HTMLElement
    const text = edit.firstChild
    if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error('expected text')
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 5)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    await wrapper.get('[data-op-chrome-font-up]').trigger('mousedown')
    await wrapper.get('[data-op-chrome-font-up]').trigger('click')
    expect(edit.querySelector('[data-op-chrome-sel]')).toBeTruthy()
    expect(edit.querySelector('[data-op-chrome-sel]')?.textContent).toBe('Hello')
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*16px/i)

    await wrapper.get('[data-op-chrome-font-up]').trigger('mousedown')
    await wrapper.get('[data-op-chrome-font-up]').trigger('click')
    expect(edit.querySelector('[data-op-chrome-sel]')?.textContent).toBe('Hello')
    expect(section.content).toMatch(/font-size:\s*18px/i)
    wrapper.unmount()
  })
})

describe('ESC cancels in-progress drag', () => {
  it('restores section position when Escape is pressed mid-drag', async () => {
    const doc = createDocument({ title: 'EscDrag' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 40,
      y: 50,
      width: 80,
      height: 40,
      content: 'Drag',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionIds: [section.id],
        snapEnabled: false,
      },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', {
      button: 0,
      clientX: 40,
      clientY: 50,
    })
    await wrapper.get('[data-op-renderer]').trigger('pointermove', {
      clientX: 120,
      clientY: 90,
    })
    expect(section.x).not.toBe(40)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(section.x).toBe(40)
    expect(section.y).toBe(50)
    expect(wrapper.find('[data-op-snap-guide]').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('document history', () => {
  it('undoes and redoes snapshots with a bounded stack', () => {
    const history = createHistory({ limit: 3 })
    history.push('a')
    history.push('b')
    history.push('c')
    history.push('d')
    history.push('e')
    expect(history.undo()).toBe('d')
    expect(history.undo()).toBe('c')
    expect(history.undo()).toBe('b')
    expect(history.undo()).toBeNull()
    expect(history.redo()).toBe('c')
    history.push('x')
    expect(history.redo()).toBeNull()
    expect(history.undo()).toBe('c')
  })

  it('supports Ctrl+Z and Ctrl+Y in the editor', async () => {
    const doc = createDocument({ title: 'Undo' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 10,
      width: 100,
      height: 40,
      content: 'Hi',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: doc,
        'onUpdate:modelValue': (value: typeof doc) => {
          void wrapper.setProps({ modelValue: value })
        },
      },
      attachTo: document.body,
    })
    await nextTick()

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 10,
    })
    await wrapper.get('[data-op-renderer]').trigger('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
    })
    expect(wrapper.props('modelValue').pages[0]?.sections[0]?.x).toBe(11)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
    await nextTick()
    expect(wrapper.props('modelValue').pages[0]?.sections[0]?.x).toBe(10)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }))
    await nextTick()
    expect(wrapper.props('modelValue').pages[0]?.sections[0]?.x).toBe(11)
    wrapper.unmount()
  })
})
