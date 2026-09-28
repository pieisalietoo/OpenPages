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

describe('text chrome on model offsets (live WYSIWYG)', () => {
  it('applies color to the model selection range without execCommand', async () => {
    const doc = createDocument({ title: 'ModelChrome' })
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
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('keydown', { key: 'a', ctrlKey: true })
    await nextTick()
    expect(wrapper.find('[data-op-text-sel]').exists()).toBe(true)

    await wrapper.get('[data-op-text-chrome-color]').trigger('mousedown')
    const colorInput = wrapper.get('[data-op-text-chrome-color]')
    ;(colorInput.element as HTMLInputElement).value = '#ff0000'
    await colorInput.trigger('input')

    expect(section.color).toBe('#111111')
    expect(section.content).toMatch(/color/i)
    expect(section.content).toContain('World')

    wrapper.unmount()
  })

  it('applies bold from chrome to the model selection range', async () => {
    const doc = createDocument({ title: 'ModelBold' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 220,
      height: 50,
      content: 'Hello',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('keydown', { key: 'a', ctrlKey: true })
    await nextTick()
    await wrapper.get('[data-op-chrome-bold]').trigger('mousedown')
    await wrapper.get('[data-op-chrome-bold]').trigger('click')
    expect(section.content).toMatch(/<b>|<strong>/i)

    wrapper.unmount()
  })
})
