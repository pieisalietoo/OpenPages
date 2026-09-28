import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument, serializeDocument } from '../src/model/document'
import { createFeatureDemoDocument } from '../src/model/feature-demo'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('renderer multi-select interactions', () => {
  it('emits select with additive flag and clear on empty page click', async () => {
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

    await wrapper.get(`[data-op-section="${b.id}"]`).trigger('pointerdown', {
      ctrlKey: true,
      button: 0,
      clientX: 60,
      clientY: 10,
    })
    expect(wrapper.emitted('select')?.at(-1)).toEqual([b.id, { additive: true }])

    await wrapper.get('[data-op-page]').trigger('click')
    expect(wrapper.emitted('clearSelection')).toBeTruthy()
  })
})

describe('editor selection toolbar + json bind + export layout', () => {
  it('shows no selection tools until a section is selected', async () => {
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: createFeatureDemoDocument() },
    })
    expect(wrapper.find('[data-op-tool="section.lock"]').exists()).toBe(false)

    const first = createFeatureDemoDocument().pages[0]?.sections.find((s) => !s.hidden)
    if (!first) throw new Error('section')
    // remount with same structure - click visible section from rendered doc
    const sectionEl = wrapper.find('[data-op-section]')
    await sectionEl.trigger('pointerdown', { button: 0, clientX: 1, clientY: 1 })
    expect(wrapper.find('[data-op-tool="section.lock"]').exists()).toBe(true)
  })

  it('hides disabled document tools from the toolbar', () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createFeatureDemoDocument(),
        toolEnabled: { 'export.pdf': false },
      },
    })
    expect(wrapper.find('[data-op-tool="export.pdf"]').exists()).toBe(false)
  })

  it('exports layout json via clipboard or download actions', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: createFeatureDemoDocument() },
    })

    await wrapper.get('[data-op-tool="layout.exportJson"]').trigger('click')
    expect(wrapper.find('[data-op-popover="layout.exportJson"]').exists()).toBe(true)

    await wrapper.get('[data-op-export-json="clipboard"]').trigger('click')
    expect(writeText).toHaveBeenCalled()
    expect(String(writeText.mock.calls[0]?.[0])).toContain('"schemaVersion"')
  })

  it('supports v-model:json round-trip edits', async () => {
    const doc = createFeatureDemoDocument()
    const json = serializeDocument(doc)
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: doc,
        json,
      },
    })

    const pretty = JSON.stringify(JSON.parse(json), null, 2)
    expect(wrapper.props('json')).toBe(json)

    const next = JSON.parse(json) as ReturnType<typeof createFeatureDemoDocument>
    next.meta.title = 'Edited From Json'
    await wrapper.setProps({ json: JSON.stringify(next) })

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.at(-1)?.[0]).toMatchObject({ meta: { title: 'Edited From Json' } })

    // local doc change emits update:json
    await wrapper
      .get('[data-op-section]')
      .trigger('pointerdown', { button: 0, clientX: 1, clientY: 1 })
    await wrapper.get('[data-op-tool="section.lock"]').trigger('click')
    const jsonEmits = wrapper.emitted('update:json')
    expect(jsonEmits?.length).toBeGreaterThan(0)
    expect(String(jsonEmits?.at(-1)?.[0])).toContain('"locked":true')
    expect(pretty).toContain('Feature Lab')
  })
})
