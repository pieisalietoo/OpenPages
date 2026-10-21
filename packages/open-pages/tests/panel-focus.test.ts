import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument } from '../src/model/document'
import { applyLayoutPreset } from '../src/model/layout-presets'
import {
  canSelectWhileFocused,
  canvasTransformForPanelFocus,
  pagePointToPanelLocal,
} from '../src/model/panel-focus'
import type { PanelSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('A3 panel focus math', () => {
  it('maps page coords to panel-local origin', () => {
    const panel = { x: 40, y: 80, width: 200, height: 160 }
    expect(pagePointToPanelLocal(40, 80, panel)).toEqual({ x: 0, y: 0 })
    expect(pagePointToPanelLocal(60, 100, panel)).toEqual({ x: 20, y: 20 })
  })

  it('blocks selecting other panels while focused', () => {
    expect(canSelectWhileFocused(null, 'a')).toBe(true)
    expect(canSelectWhileFocused('a', 'a')).toBe(true)
    expect(canSelectWhileFocused('a', 'b')).toBe(false)
  })

  it('builds a scale+translate transform that frames the panel', () => {
    const page = firstPage(createDocument({ title: 'F' }))
    applyLayoutPreset(page, 'comic-2x2')
    const panel = page.sections.find((s): s is PanelSection => s.type === 'panel')
    if (!panel) throw new Error('panel')
    const t = canvasTransformForPanelFocus(page, panel, { width: 800, height: 600 })
    expect(t.scale).toBeGreaterThan(1)
    expect(t.transform).toContain('scale(')
    expect(t.transform).toContain('translate(')
  })
})

describe('A3 panel focus editor', () => {
  it('enter/exit focus emits events and shows exit chrome', async () => {
    const doc = createDocument({ title: 'Focus' })
    const page = firstPage(doc)
    applyLayoutPreset(page, 'comic-2x2')
    const panel = page.sections.find((s): s is PanelSection => s.type === 'panel')
    if (!panel) throw new Error('panel')

    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
    })
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      enterPanelFocus: (id: string) => void
      exitPanelFocus: () => void
    }
    vm.enterPanelFocus(panel.id)
    await flushPromises()
    expect(wrapper.emitted('panel-focus-enter')?.at(-1)?.[0]).toEqual({
      panelId: panel.id,
    })
    expect(wrapper.find('[data-op-panel-focus-bar]').exists()).toBe(true)

    await wrapper.get('[data-op-panel-focus-exit]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('panel-focus-exit')?.at(-1)?.[0]).toEqual({
      panelId: panel.id,
    })
    expect(wrapper.find('[data-op-panel-focus-bar]').exists()).toBe(false)
  })
})
