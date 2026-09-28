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

describe('text source editing without live sanitize', () => {
  it('keeps incomplete attributes and caret while typing in source mode', async () => {
    const doc = createDocument({ title: 'SrcLive' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 80,
      width: 280,
      height: 100,
      content: '<h3 data-op-keep-with-next="2">Title</h3>',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await wrapper.get('[data-op-chrome-source-toggle]').trigger('click')
    const source = wrapper.get('[data-op-text-source]')
    const ta = source.element as HTMLTextAreaElement

    // Mid-edit: strip attribute value / leave trailing space for a new attr — must not be rewritten.
    const draft = '<h3 data-op-keep-with-next= >Title</h3>'
    ta.value = draft
    ta.setSelectionRange(28, 28)
    await source.trigger('input')

    expect(ta.value).toBe(draft)
    expect(ta.selectionStart).toBe(28)
    expect(section.content).toBe(draft)

    // Sanitize only when leaving source mode.
    await wrapper.get('[data-op-chrome-source-toggle]').trigger('click')
    expect(section.content).not.toContain('data-op-keep-with-next= >')
    expect(section.content).toMatch(/<h3[^>]*>Title<\/h3>/i)

    wrapper.unmount()
  })
})
