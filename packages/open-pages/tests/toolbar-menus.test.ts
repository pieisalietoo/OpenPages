import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('toolbar menus dismiss', () => {
  it('closes an open toolbar menu when clicking outside it', async () => {
    const doc = createDocument({ title: 'MenuDismiss' })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })

    await wrapper.get('[data-op-tool="section.add"]').trigger('click')
    expect(wrapper.find('[data-op-popover="section.add"]').exists()).toBe(true)

    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }))
    await nextTick()
    expect(wrapper.find('[data-op-popover="section.add"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('keeps the menu open when clicking inside the popover', async () => {
    const doc = createDocument({ title: 'MenuKeep' })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })

    await wrapper.get('[data-op-tool="section.add"]').trigger('click')
    const popover = wrapper.get('[data-op-popover="section.add"]')
    await popover.trigger('pointerdown')
    expect(wrapper.find('[data-op-popover="section.add"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('closes an open toolbar menu when Escape is pressed', async () => {
    const doc = createDocument({ title: 'MenuEsc' })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })

    await wrapper.get('[data-op-tool="section.add"]').trigger('click')
    expect(wrapper.find('[data-op-popover="section.add"]').exists()).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(wrapper.find('[data-op-popover="section.add"]').exists()).toBe(false)

    wrapper.unmount()
  })
})

describe('selection Delete key', () => {
  it('deletes the selected section when Delete is pressed', async () => {
    const doc = createDocument({ title: 'DelKey' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 40,
      width: 120,
      height: 40,
      content: 'Gone',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', {
      button: 0,
    })
    expect(page.sections.map((s) => s.id)).toEqual([section.id])

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
    await nextTick()
    expect(page.sections).toEqual([])
    expect(wrapper.find('[data-op-selection-chrome]').exists()).toBe(false)

    wrapper.unmount()
  })
})
