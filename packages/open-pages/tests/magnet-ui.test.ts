import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'
import { BUILTIN_TOOLS } from '../src/tooling/tools'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('magnet tool + snap guides in UI', () => {
  it('exposes a document magnet toggle tool', () => {
    expect(BUILTIN_TOOLS.some((t) => t.id === 'view.magnet')).toBe(true)
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: createDocument({ title: 'M' }) },
    })
    expect(wrapper.find('[data-op-tool="view.magnet"]').exists()).toBe(true)
  })

  it('places magnet last in the document toolbar after page setup and add', () => {
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: createDocument({ title: 'M' }) },
    })
    const bar = wrapper.get('[data-op-toolbar="document"]')
    const toolIds = bar.findAll('[data-op-tool]').map((el) => el.attributes('data-op-tool'))
    expect(toolIds.at(-1)).toBe('view.magnet')
    expect(toolIds.slice(-3)).toEqual(['page.setup', 'section.add', 'view.magnet'])
    const sep = bar.get('[data-op-toolbar-sep]')
    expect(
      sep.element.nextElementSibling?.querySelector('[data-op-tool="page.setup"]'),
    ).toBeTruthy()
  })

  it('toggles magnet active state on the toolbar button', async () => {
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: createDocument({ title: 'M' }) },
    })
    const btn = wrapper.get('[data-op-tool="view.magnet"]')
    expect(btn.attributes('aria-pressed')).toBe('true')
    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('true')
  })

  it('shows alignment guide while dragging near another section when magnet is on', async () => {
    const doc = createDocument({ title: 'Snap' })
    const page = firstPage(doc)
    const a = addTextSection(page, { x: 100, y: 40, width: 40, height: 20, content: 'a' })
    const b = addTextSection(page, { x: 10, y: 40, width: 40, height: 20, content: 'b' })

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionIds: [b.id],
        snapEnabled: true,
      },
      attachTo: document.body,
    })

    const section = wrapper.get(`[data-op-section="${b.id}"]`)
    await section.trigger('pointerdown', { button: 0, clientX: 10, clientY: 40 })
    await wrapper.get('[data-op-renderer]').trigger('pointermove', {
      clientX: 58,
      clientY: 40,
      shiftKey: false,
    })

    expect(wrapper.find('[data-op-snap-guide]').exists()).toBe(true)
    expect(wrapper.find('.op-snap-align').exists()).toBe(true)
    expect(b.x).toBe(60)
    expect(wrapper.get(`[data-op-section="${a.id}"]`).classes()).toContain('is-snap-target')
    expect(wrapper.get(`[data-op-section="${a.id}"]`).attributes('data-op-snap-target')).toBe('')

    await wrapper.get('[data-op-renderer]').trigger('pointerup')
    expect(wrapper.find('[data-op-snap-guide]').exists()).toBe(false)
    expect(wrapper.get(`[data-op-section="${a.id}"]`).classes()).not.toContain('is-snap-target')
    wrapper.unmount()
  })

  it('skips snap guides when Shift is held during drag', async () => {
    const doc = createDocument({ title: 'Snap' })
    const page = firstPage(doc)
    addTextSection(page, { x: 100, y: 40, width: 40, height: 20, content: 'a' })
    const b = addTextSection(page, { x: 10, y: 40, width: 40, height: 20, content: 'b' })

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionIds: [b.id],
        snapEnabled: true,
      },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${b.id}"]`).trigger('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 40,
    })
    await wrapper.get('[data-op-renderer]').trigger('pointermove', {
      clientX: 58,
      clientY: 40,
      shiftKey: true,
    })

    expect(b.x).toBe(58)
    expect(wrapper.find('[data-op-snap-guide]').exists()).toBe(false)
    wrapper.unmount()
  })
})
