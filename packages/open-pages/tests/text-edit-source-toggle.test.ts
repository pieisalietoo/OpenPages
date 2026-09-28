import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('text edit WYSIWYG / HTML source toggle', () => {
  it('toggles between live layout WYSIWYG and HTML source, preserving content both ways', async () => {
    const doc = createDocument({ title: 'Src' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 80,
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
    expect(wrapper.find('[data-op-text-edit]').exists()).toBe(true)
    expect(wrapper.find('[data-op-text-source]').exists()).toBe(false)

    const toggle = wrapper.get('[data-op-chrome-source-toggle]')
    await toggle.trigger('click')

    expect(wrapper.find('[data-op-text-edit]').exists()).toBe(false)
    expect(wrapper.find('[data-op-lines]').exists()).toBe(false)
    const source = wrapper.get('[data-op-text-source]')
    expect((source.element as HTMLTextAreaElement).value).toMatch(/Hello/)
    expect((source.element as HTMLTextAreaElement).value).toMatch(
      /<b>world<\/b>|<strong>world<\/strong>/i,
    )

    ;(source.element as HTMLTextAreaElement).value = '<p>Edited <em>source</em></p>'
    await source.trigger('input')
    expect(section.content).toMatch(/Edited/)
    expect(section.content).toMatch(/<em>source<\/em>|<i>source<\/i>/i)

    await toggle.trigger('click')
    expect(wrapper.find('[data-op-text-source]').exists()).toBe(false)
    expect(wrapper.find('[data-op-lines]').exists()).toBe(true)
    expect(wrapper.find('[data-op-lines]').text()).toMatch(/Edited/)
    expect(wrapper.find('[data-op-lines]').text()).toMatch(/source/)

    wrapper.unmount()
  })
})
