import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('floating selection chrome', () => {
  it('shows above the selection only when sections are selected, and yields to text chrome while editing', async () => {
    const doc = createDocument({ title: 'SelChrome' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 40,
      y: 120,
      width: 180,
      height: 50,
      content: 'Hello',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })

    expect(wrapper.find('[data-op-selection-chrome]').exists()).toBe(false)

    const target = wrapper.get(`[data-op-section="${section.id}"]`)
    await target.trigger('pointerdown', { button: 0 })

    const chrome = wrapper.get('[data-op-selection-chrome]')
    const style = (chrome.element as HTMLElement).style
    expect(style.top).toBe(`${section.y}px`)
    expect(style.transform).toMatch(/translateY/)
    expect(Number.parseFloat(style.width)).toBeGreaterThanOrEqual(260)
    expect(wrapper.find('[data-op-tool="section.delete"]').exists()).toBe(true)

    await target.trigger('dblclick')
    expect(wrapper.find('[data-op-selection-chrome]').exists()).toBe(false)
    expect(wrapper.find('[data-op-text-chrome]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('hides the selection chrome while dragging a section', async () => {
    const doc = createDocument({ title: 'DragHide' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 80,
      width: 160,
      height: 48,
      content: 'Move me',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })

    const target = wrapper.get(`[data-op-section="${section.id}"]`)
    await target.trigger('pointerdown', { button: 0, clientX: 100, clientY: 100 })
    expect(wrapper.find('[data-op-selection-chrome]').exists()).toBe(true)

    await wrapper.get('[data-op-renderer]').trigger('pointermove', { clientX: 140, clientY: 120 })
    expect(wrapper.find('[data-op-selection-chrome]').exists()).toBe(false)

    await wrapper.get('[data-op-renderer]').trigger('pointerup')
    expect(wrapper.find('[data-op-selection-chrome]').exists()).toBe(true)

    wrapper.unmount()
  })
})
