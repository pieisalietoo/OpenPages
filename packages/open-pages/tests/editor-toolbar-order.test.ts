import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'

describe('OpenPagesEditor toolbar order props', () => {
  it('uses documentToolbar order and omits tools not listed', () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'T' }),
        documentToolbar: ['section.add', 'sep', 'view.magnet', 'page.setup'],
      },
    })
    const bar = wrapper.get('[data-op-toolbar="document"]')
    const ids = bar.findAll('[data-op-tool]').map((n) => n.attributes('data-op-tool'))
    expect(ids).toEqual(['section.add', 'view.magnet', 'page.setup'])
    expect(bar.find('[data-op-tool="layout.select"]').exists()).toBe(false)
    expect(bar.find('[data-op-toolbar-sep]').exists()).toBe(true)
  })

  it('renders grow markers from documentToolbar', () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'T' }),
        documentToolbar: ['grow', 'section.add', 'grow', 'view.magnet'],
      },
    })
    const bar = wrapper.get('[data-op-toolbar="document"]')
    expect(bar.findAll('[data-op-toolbar-grow]')).toHaveLength(2)
    expect(bar.find('[data-op-toolbar-spacer]').exists()).toBe(false)
  })

  it('hides the document toolbar when documentToolbar has no visible tools', () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'T' }),
        documentToolbar: [],
      },
    })
    expect(wrapper.find('[data-op-toolbar="document"]').exists()).toBe(false)
  })

  it('hides document toolbar when only sep/grow are configured', () => {
    const wrapper = mount(OpenPagesEditor, {
      props: {
        modelValue: createDocument({ title: 'T' }),
        documentToolbar: ['sep', 'grow'],
      },
    })
    expect(wrapper.find('[data-op-toolbar="document"]').exists()).toBe(false)
  })

  it('selectionToolbar order applies and empty config hides selection bar', async () => {
    const doc = createDocument({ title: 'T' })
    const page = doc.pages[0]
    if (!page) throw new Error('page')
    const section = addTextSection(page, {
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      content: 'x',
    })

    const ordered = mount(OpenPagesEditor, {
      props: {
        modelValue: doc,
        selectionToolbar: ['section.delete', 'sep', 'section.lock'],
      },
      attachTo: document.body,
    })
    await ordered.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', { button: 0 })
    const bar = ordered.get('[data-op-toolbar="selection"]')
    const ids = bar.findAll('[data-op-tool]').map((n) => n.attributes('data-op-tool'))
    expect(ids).toEqual(['section.delete', 'section.lock'])
    expect(bar.find('[data-op-tool="section.duplicate"]').exists()).toBe(false)
    ordered.unmount()

    const empty = mount(OpenPagesEditor, {
      props: {
        modelValue: doc,
        selectionToolbar: [],
      },
      attachTo: document.body,
    })
    await empty.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', { button: 0 })
    expect(empty.find('[data-op-toolbar="selection"]').exists()).toBe(false)
    empty.unmount()
  })
})
