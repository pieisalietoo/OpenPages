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

describe('text chrome delete section', () => {
  it('shows a trailing delete control that removes the edited text block', async () => {
    const doc = createDocument({ title: 'Del' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 80,
      width: 200,
      height: 60,
      content: 'Remove me',
    })
    const sectionId = section.id
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [sectionId] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${sectionId}"]`).trigger('dblclick')
    const del = wrapper.get('[data-op-chrome-delete]')
    expect(del.classes()).toContain('op-chrome-delete')
    expect(del.find('svg').exists()).toBe(true)
    expect(del.text()).not.toMatch(/×/)

    await del.trigger('click')

    expect(page.sections.find((s) => s.id === sectionId)).toBeUndefined()
    expect(wrapper.find('[data-op-text-edit]').exists()).toBe(false)
    expect(wrapper.find('[data-op-text-chrome]').exists()).toBe(false)
    expect(wrapper.emitted('clearSelection')).toBeTruthy()
    expect(wrapper.emitted('change')).toBeTruthy()

    wrapper.unmount()
  })
})
