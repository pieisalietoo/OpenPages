import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument, parseDocument, serializeDocument } from '../src/model/document'
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

  it('exports current layout JSON from the layout list menu', async () => {
    const doc = createDocument({ title: 'Export Me' })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
    })

    await wrapper.get('[data-op-tool="layout.select"]').trigger('click')
    const exportBtn = wrapper.get('[data-op-popover="layout.select"] [data-op-layout-export]')
    expect(exportBtn.text()).toMatch(/export/i)
    await exportBtn.trigger('click')

    const exported = wrapper.emitted('export')?.at(-1)?.[0] as
      | { format: string; result: string }
      | undefined
    expect(exported?.format).toBe('json')
    expect(exported?.result).toContain('"schemaVersion"')
    expect(exported?.result).toContain('Export Me')
    expect(wrapper.find('[data-op-popover="layout.select"]').exists()).toBe(false)
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

  it('skips layout save when beforeLayoutSave returns false', async () => {
    const blank = createDocument({ title: 'Blank' })
    const layouts = createLayoutLibrary({
      layouts: [{ name: 'Blank', document: blank }],
      activeName: 'Blank',
    })
    const beforeLayoutSave = async () => false

    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: blank,
        layoutLibrary: layouts,
        beforeLayoutSave,
      },
    })

    await wrapper.get('[data-op-tool="layout.save"]').trigger('click')
    const input = wrapper.get('.op-save-input')
    await input.setValue('Custom')
    await wrapper.get('.op-save-form').trigger('submit')

    expect(layouts.list().map((l) => l.name)).toEqual(['Blank'])
    expect(wrapper.find('[data-op-popover="layout.save"]').exists()).toBe(true)
  })

  it('saves layout when beforeLayoutSave returns true', async () => {
    const blank = createDocument({ title: 'Blank' })
    const layouts = createLayoutLibrary({
      layouts: [{ name: 'Blank', document: blank }],
      activeName: 'Blank',
    })
    const beforeLayoutSave = vi.fn(async () => true)

    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: blank,
        layoutLibrary: layouts,
        beforeLayoutSave,
      },
    })

    await wrapper.get('[data-op-tool="layout.save"]').trigger('click')
    await wrapper.get('.op-save-input').setValue('Custom')
    await wrapper.get('.op-save-form').trigger('submit')

    expect(layouts.list().map((l) => l.name)).toEqual(['Blank', 'Custom'])
    expect(beforeLayoutSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Custom', exists: false }),
    )
  })

  it('passes exists true to beforeLayoutSave when overwriting an unlocked layout', async () => {
    const blank = createDocument({ title: 'Blank' })
    const layouts = createLayoutLibrary({
      layouts: [{ name: 'Blank', document: blank }],
      activeName: 'Blank',
    })
    const beforeLayoutSave = vi.fn(async () => true)

    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: blank,
        layoutLibrary: layouts,
        beforeLayoutSave,
      },
    })

    await wrapper.get('[data-op-tool="layout.save"]').trigger('click')
    await wrapper.get('.op-save-input').setValue('Blank')
    await wrapper.get('.op-save-form').trigger('submit')

    expect(beforeLayoutSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Blank', exists: true }),
    )
  })

  it('marks the active layout and shows * when the document is dirty', async () => {
    const blank = createDocument({ title: 'Blank' })
    const layouts = createLayoutLibrary({
      layouts: [{ name: 'Blank', document: blank }],
      activeName: 'Blank',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: blank, layoutLibrary: layouts },
    })

    await wrapper.get('[data-op-tool="layout.select"]').trigger('click')
    const active = wrapper.get('[data-op-layout="Blank"]')
    expect(active.attributes('aria-current')).toBe('true')
    expect(active.text()).toBe('Blank')

    const page = blank.pages[0]
    if (!page) throw new Error('page')
    addTextSection(page, { x: 1, y: 1, width: 10, height: 10, content: 'dirty' })
    await wrapper.setProps({ modelValue: parseDocument(serializeDocument(blank)) })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-op-layout="Blank"]').text()).toBe('Blank *')
  })

  it('deletes an unlocked layout from the select popover', async () => {
    const blank = createDocument({ title: 'Blank' })
    const draft = createDocument({ title: 'Draft' })
    const layouts = createLayoutLibrary({
      layouts: [
        { name: 'Blank', document: blank },
        { name: 'Draft', document: draft },
      ],
      activeName: 'Blank',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: blank, layoutLibrary: layouts },
    })

    await wrapper.get('[data-op-tool="layout.select"]').trigger('click')
    const del = wrapper.get('[data-op-layout-delete="Draft"]')
    expect(del.find('.lucide-trash-2').exists()).toBe(true)
    await del.trigger('click')
    expect(wrapper.find('[data-op-delete-confirm]').exists()).toBe(true)
    expect(layouts.list().map((l) => l.name)).toEqual(['Blank', 'Draft'])
    await wrapper.get('[data-op-delete-confirm-yes]').trigger('click')
    expect(layouts.list().map((l) => l.name)).toEqual(['Blank'])
  })

  it('does not delete a layout when confirm is cancelled', async () => {
    const blank = createDocument({ title: 'Blank' })
    const draft = createDocument({ title: 'Draft' })
    const layouts = createLayoutLibrary({
      layouts: [
        { name: 'Blank', document: blank },
        { name: 'Draft', document: draft },
      ],
      activeName: 'Blank',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: blank, layoutLibrary: layouts },
    })

    await wrapper.get('[data-op-tool="layout.select"]').trigger('click')
    await wrapper.get('[data-op-layout-delete="Draft"]').trigger('click')
    await wrapper.get('[data-op-delete-confirm-no]').trigger('click')
    expect(layouts.list().map((l) => l.name)).toEqual(['Blank', 'Draft'])
    expect(wrapper.find('[data-op-delete-confirm]').exists()).toBe(false)
  })

  it('hides delete for locked layouts and refuses overwrite on save', async () => {
    const blank = createDocument({ title: 'Blank' })
    const layouts = createLayoutLibrary({
      layouts: [{ name: 'Blank', document: blank, locked: true }],
      activeName: 'Blank',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: blank, layoutLibrary: layouts },
    })

    await wrapper.get('[data-op-tool="layout.select"]').trigger('click')
    expect(wrapper.find('[data-op-layout-delete="Blank"]').exists()).toBe(false)

    await wrapper.get('[data-op-tool="layout.save"]').trigger('click')
    expect((wrapper.get('.op-save-input').element as HTMLInputElement).value).toBe('')
    await wrapper.get('.op-save-input').setValue('Blank')
    await wrapper.get('.op-save-form').trigger('submit')
    expect(wrapper.find('[data-op-save-error]').exists()).toBe(true)
    expect(layouts.select('Blank')?.document.meta.title).toBe('Blank')
  })

  it('prefills save name with the active unlocked layout', async () => {
    const blank = createDocument({ title: 'Blank' })
    const layouts = createLayoutLibrary({
      layouts: [{ name: 'Blank', document: blank }],
      activeName: 'Blank',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: blank, layoutLibrary: layouts },
    })

    await wrapper.get('[data-op-tool="layout.save"]').trigger('click')
    expect((wrapper.get('.op-save-input').element as HTMLInputElement).value).toBe('Blank')
  })

  it('saves over the active unlocked layout without an overwrite prompt', async () => {
    const blank = createDocument({ title: 'Blank' })
    const page = blank.pages[0]
    if (!page) throw new Error('page')
    addTextSection(page, { x: 1, y: 1, width: 10, height: 10, content: 'edited' })
    const layouts = createLayoutLibrary({
      layouts: [{ name: 'Blank', document: createDocument({ title: 'Blank' }) }],
      activeName: 'Blank',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: blank, layoutLibrary: layouts },
    })

    await wrapper.get('[data-op-tool="layout.save"]').trigger('click')
    expect((wrapper.get('.op-save-input').element as HTMLInputElement).value).toBe('Blank')
    await wrapper.get('.op-save-form').trigger('submit')

    expect(wrapper.find('[data-op-overwrite-confirm]').exists()).toBe(false)
    expect(layouts.getActive()?.document.pages[0]?.sections).toHaveLength(1)
  })

  it('asks before overwriting a different existing layout and can cancel', async () => {
    const blank = createDocument({ title: 'Blank' })
    const other = createDocument({ title: 'Other' })
    const page = blank.pages[0]
    if (!page) throw new Error('page')
    addTextSection(page, { x: 1, y: 1, width: 10, height: 10, content: 'from-blank' })
    const layouts = createLayoutLibrary({
      layouts: [
        { name: 'Blank', document: createDocument({ title: 'Blank' }) },
        { name: 'Other', document: other },
      ],
      activeName: 'Blank',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: blank, layoutLibrary: layouts },
    })

    await wrapper.get('[data-op-tool="layout.save"]').trigger('click')
    await wrapper.get('.op-save-input').setValue('Other')
    await wrapper.get('.op-save-form').trigger('submit')

    expect(wrapper.find('[data-op-overwrite-confirm]').exists()).toBe(true)
    expect(layouts.list().find((l) => l.name === 'Other')?.document.meta.title).toBe('Other')
    expect(
      layouts.list().find((l) => l.name === 'Other')?.document.pages[0]?.sections ?? [],
    ).toHaveLength(0)

    await wrapper.get('[data-op-overwrite-confirm-no]').trigger('click')
    expect(wrapper.find('[data-op-overwrite-confirm]').exists()).toBe(false)
    expect(layouts.list().find((l) => l.name === 'Other')?.document.meta.title).toBe('Other')

    await wrapper.get('.op-save-form').trigger('submit')
    await wrapper.get('[data-op-overwrite-confirm-yes]').trigger('click')
    expect(layouts.getActive()?.name).toBe('Other')
    expect(layouts.getActive()?.document.pages[0]?.sections).toHaveLength(1)
  })

  it('shows extraDocumentTools before the last grow by default and runs their action', async () => {
    const action = vi.fn()
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'Extras' }),
        extraDocumentTools: [{ id: 'host.stamp', label: 'Stamp', icon: 'plus', action }],
      },
    })

    const toolIds = wrapper
      .findAll('[data-op-toolbar="document"] [data-op-tool]')
      .map((el) => el.attributes('data-op-tool'))
    const stampAt = toolIds.indexOf('host.stamp')
    const setupAt = toolIds.indexOf('page.setup')
    expect(stampAt).toBeGreaterThan(-1)
    expect(setupAt).toBeGreaterThan(stampAt)
    // grow sits between stamp and page.setup in the default order
    expect(
      wrapper
        .findAll('[data-op-toolbar="document"] > *')
        .some((el) => el.classes().includes('op-toolbar-grow')),
    ).toBe(true)

    await wrapper.get('[data-op-tool="host.stamp"]').trigger('click')
    expect(action).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('toolActivate')?.at(-1)?.[0]).toMatchObject({ id: 'host.stamp' })
    wrapper.unmount()
  })

  it('omits extraDocumentTools unless listed when documentToolbar is customized', async () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'CustomOrder' }),
        documentToolbar: ['layout.select', 'page.setup'],
        extraDocumentTools: [{ id: 'host.stamp', label: 'Stamp', icon: 'plus' }],
      },
    })
    expect(wrapper.find('[data-op-tool="host.stamp"]').exists()).toBe(false)

    await wrapper.setProps({
      documentToolbar: ['layout.select', 'host.stamp', 'page.setup'],
    })
    expect(wrapper.find('[data-op-tool="host.stamp"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('merges toolbarIcons into the toolbar icon map for host-defined keys', () => {
    const HostIcon = defineComponent({
      name: 'HostSparklesIcon',
      setup() {
        return () => h('svg', { 'data-op-host-icon': 'sparkles', class: 'op-tool-icon' })
      },
    })
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'HostIcons' }),
        extraDocumentTools: [{ id: 'host.ai', label: 'AI', icon: 'sparkles' }],
        toolbarIcons: { sparkles: HostIcon },
      },
    })
    const btn = wrapper.get('[data-op-tool="host.ai"]')
    expect(btn.attributes('data-op-tool-icon')).toBe('sparkles')
    expect(btn.find('[data-op-host-icon="sparkles"]').exists()).toBe(true)
    expect(btn.find('.lucide-layout-template').exists()).toBe(false)
    wrapper.unmount()
  })

  it('exposes addSection for hosts to insert typed content with optional geometry', async () => {
    const doc = createDocument({ title: 'AddAPI' })
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: doc,
        'onUpdate:modelValue': (value: typeof doc) => {
          void wrapper.setProps({ modelValue: value })
        },
      },
    })
    const vm = wrapper.vm as unknown as {
      addSection: (
        type: string,
        options?: {
          content?: string
          x?: number
          y?: number
          width?: number
          height?: number
        },
      ) => { id: string; type: string; content?: string; x: number; y: number }
    }

    const created = vm.addSection('text', {
      content: '<p>Host block</p>',
      x: 40,
      y: 60,
      width: 180,
      height: 90,
    })
    expect(created).toMatchObject({
      type: 'text',
      content: expect.stringContaining('Host block'),
      x: 40,
      y: 60,
      width: 180,
      height: 90,
    })
    expect(wrapper.props('modelValue').pages[0]?.sections).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    wrapper.unmount()
  })
})
