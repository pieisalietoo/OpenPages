import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument } from '../src/model/document'
import { createFeatureDemoDocument } from '../src/model/feature-demo'
import { createLayoutLibrary } from '../src/model/layouts'
import { addTextSection } from '../src/model/section'

describe('OpenPagesEditor chrome', () => {
  it('renders document and selection toolbars with icon buttons', () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createFeatureDemoDocument(),
      },
    })

    expect(wrapper.find('[data-op-toolbar="document"]').exists()).toBe(true)
    expect(wrapper.find('[data-op-toolbar="selection"]').exists()).toBe(false)
    expect(wrapper.find('[data-op-tool="layout.select"]').exists()).toBe(true)
    expect(wrapper.find('[data-op-tool="layout.exportJson"]').exists()).toBe(true)
    // selection tools appear only after a section is selected
    expect(wrapper.find('[data-op-tool="section.lock"]').exists()).toBe(false)
  })

  it('hides tools disabled via toolEnabled prop', async () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createFeatureDemoDocument(),
        toolEnabled: { 'export.pdf': false },
      },
    })
    expect(wrapper.find('[data-op-tool="export.pdf"]').exists()).toBe(false)
    expect(wrapper.find('[data-op-tool="export.png"]').exists()).toBe(true)
  })

  it('opens layout popover and switches named layout', async () => {
    const blank = createDocument({ title: 'Blank' })
    const feature = createFeatureDemoDocument()
    const layouts = createLayoutLibrary({
      layouts: [
        { name: 'Blank', document: blank },
        { name: 'Feature', document: feature },
      ],
      activeName: 'Blank',
    })

    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: blank,
        layoutLibrary: layouts,
      },
    })

    await wrapper.get('[data-op-tool="layout.select"]').trigger('click')
    expect(wrapper.find('[data-op-popover="layout.select"]').exists()).toBe(true)
    await wrapper.get('[data-op-layout="Feature"]').trigger('click')

    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted?.at(-1)?.[0]).toMatchObject({ meta: { title: 'Feature Lab' } })
  })

  it('exposes activateTool for external hosts and emits toolActivate', async () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createFeatureDemoDocument(),
        exportAdapters: {
          print: () => undefined,
        },
      },
    })

    const vm = wrapper.vm as unknown as {
      activateTool: (id: string, payload?: unknown) => void
    }
    vm.activateTool('export.print')
    expect(wrapper.emitted('toolActivate')?.[0]).toEqual([
      { id: 'export.print', payload: undefined },
    ])
  })

  it('selection tools act on selected section', async () => {
    const doc = createDocument({ title: 'Sel' })
    const page = doc.pages[0]
    if (!page) throw new Error('page')
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      content: 'x',
    })

    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', {
      button: 0,
      clientX: 1,
      clientY: 1,
    })
    await wrapper.get('[data-op-tool="section.lock"]').trigger('click')
    expect(section.locked).toBe(true)
  })
})
