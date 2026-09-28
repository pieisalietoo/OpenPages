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

describe('live layout WYSIWYG text edit', () => {
  it('keeps line boxes visible on double-click and shows a caret', async () => {
    const doc = createDocument({ title: 'LiveWysiwyg' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 40,
      width: 220,
      height: 80,
      content: 'Hello',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    expect(wrapper.find('[data-op-lines]').exists()).toBe(true)
    expect(wrapper.find('[data-op-line]').text()).toContain('Hello')
    expect(wrapper.find('[data-op-text-caret]').exists()).toBe(true)
    expect(wrapper.find('[data-op-text-edit]').exists()).toBe(true)
    // Source textarea is not the WYSIWYG surface.
    expect(wrapper.find('[data-op-text-source]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('updates content and line boxes while typing in WYSIWYG mode', async () => {
    const doc = createDocument({ title: 'LiveType' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 40,
      width: 220,
      height: 80,
      content: 'Hi',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('keydown', { key: '!', code: 'Digit1' })
    await nextTick()

    expect(section.content).toMatch(/Hi!/)
    expect(wrapper.find('[data-op-lines]').text()).toContain('Hi!')

    wrapper.unmount()
  })

  it('toggles to a normal source textarea and back to live line boxes', async () => {
    const doc = createDocument({ title: 'LiveSrc' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 40,
      width: 240,
      height: 80,
      content: '<p>Hello <b>world</b></p>',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    expect(wrapper.find('[data-op-lines]').exists()).toBe(true)

    await wrapper.get('[data-op-chrome-source-toggle]').trigger('click')
    expect(wrapper.find('[data-op-text-source]').exists()).toBe(true)
    expect(wrapper.find('[data-op-lines]').exists()).toBe(false)
    expect(wrapper.find('[data-op-text-caret]').exists()).toBe(false)

    const source = wrapper.get('[data-op-text-source]')
    expect((source.element as HTMLTextAreaElement).value).toMatch(/Hello/)

    await wrapper.get('[data-op-chrome-source-toggle]').trigger('click')
    expect(wrapper.find('[data-op-text-source]').exists()).toBe(false)
    expect(wrapper.find('[data-op-lines]').exists()).toBe(true)
    expect(wrapper.find('[data-op-text-caret]').exists()).toBe(true)

    wrapper.unmount()
  })
})
