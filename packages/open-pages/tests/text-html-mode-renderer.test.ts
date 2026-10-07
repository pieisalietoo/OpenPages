import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('OpenPagesRenderer htmlMode text panels', () => {
  it('renders htmlMode text as pure HTML and edits only in source mode', async () => {
    const doc = createDocument({ title: 'Html render' })
    doc.data = {
      standings:
        '<div class="fp-standings table"><img class="logo" src="https://example.com/a.png" alt="A"><span class="table-cell">Alpha</span></div>',
    }
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 80,
      width: 240,
      height: 120,
      content: '{{standings}}',
      htmlMode: true,
    })

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await flushPromises()

    expect(wrapper.find('[data-op-lines]').exists()).toBe(false)
    const htmlHost = wrapper.get('[data-op-html]')
    expect(htmlHost.html()).toContain('fp-standings')
    expect(htmlHost.html()).toContain('https://example.com/a.png')
    expect(htmlHost.html()).toContain('Alpha')

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await flushPromises()

    expect(wrapper.find('[data-op-text-source]').exists()).toBe(true)
    expect(wrapper.find('[data-op-text-edit]').exists()).toBe(false)
    expect(wrapper.find('[data-op-lines]').exists()).toBe(false)
    expect(wrapper.find('[data-op-html]').exists()).toBe(false)

    const sourceToggle = wrapper.find('[data-op-chrome-source-toggle]')
    expect(sourceToggle.exists()).toBe(false)

    const modeToggle = wrapper.get('[data-op-chrome-html-mode]')
    expect(modeToggle.attributes('aria-pressed')).toBe('true')

    wrapper.unmount()
  })

  it('can toggle htmlMode from the text chrome', async () => {
    const doc = createDocument({ title: 'Toggle' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 80,
      width: 200,
      height: 80,
      content: '<p>Hello</p>',
    })
    expect(section.htmlMode).toBe(false)

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await flushPromises()

    expect(wrapper.find('[data-op-lines]').exists()).toBe(true)
    await wrapper.get('[data-op-chrome-html-mode]').trigger('click')
    await flushPromises()

    expect(section.htmlMode).toBe(true)
    expect(wrapper.find('[data-op-text-source]').exists()).toBe(true)
    expect(wrapper.find('[data-op-lines]').exists()).toBe(false)

    wrapper.unmount()
  })
})
