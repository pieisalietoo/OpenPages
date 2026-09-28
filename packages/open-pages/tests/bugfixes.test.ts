import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createBrowserExportAdapters } from '../src/export/exporters'
import { createDocument } from '../src/model/document'
import { createFeatureDemoDocument } from '../src/model/feature-demo'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('bugfixes: multi-select, tool visibility, pdf', () => {
  it('ctrl pointerdown selects additively without click toggling it off', async () => {
    const doc = createDocument({ title: 'M' })
    const page = firstPage(doc)
    const a = addTextSection(page, { x: 0, y: 0, width: 40, height: 20, content: 'a' })
    const b = addTextSection(page, { x: 50, y: 0, width: 40, height: 20, content: 'b' })

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionIds: [a.id],
      },
    })

    const el = wrapper.get(`[data-op-section="${b.id}"]`)
    await el.trigger('pointerdown', { ctrlKey: true, button: 0, clientX: 60, clientY: 10 })
    await el.trigger('click', { ctrlKey: true })

    const selects = wrapper.emitted('select') ?? []
    expect(selects).toHaveLength(1)
    expect(selects[0]).toEqual([b.id, { additive: true }])
  })

  it('hides export.pdf when disabled and shows it again when re-enabled', async () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createFeatureDemoDocument(),
        toolEnabled: {},
      },
    })

    expect(wrapper.find('[data-op-tool="export.pdf"]').exists()).toBe(true)

    await wrapper.setProps({ toolEnabled: { 'export.pdf': false } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-op-tool="export.pdf"]').exists()).toBe(false)

    await wrapper.setProps({ toolEnabled: { 'export.pdf': true } })
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-op-tool="export.pdf"]').exists()).toBe(true)
  })

  it('browser toPdf returns a PDF payload without calling window.print', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    const el = document.createElement('div')
    el.getBoundingClientRect = () =>
      ({
        width: 200,
        height: 100,
        top: 0,
        left: 0,
        bottom: 100,
        right: 200,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect

    const jpeg =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z'

    const adapters = createBrowserExportAdapters({
      captureJpeg: async () => jpeg,
    })
    const result = await adapters.toPdf?.(el)

    expect(print).not.toHaveBeenCalled()
    expect(typeof result).toBe('string')
    expect(String(result).startsWith('data:application/pdf')).toBe(true)

    vi.unstubAllGlobals()
  })

  it('hides selection toolbar until a section is selected', () => {
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: createFeatureDemoDocument() },
    })
    expect(wrapper.find('[data-op-toolbar="selection"]').exists()).toBe(false)
    expect(wrapper.find('[data-op-tool="section.lock"]').exists()).toBe(false)
  })
})
