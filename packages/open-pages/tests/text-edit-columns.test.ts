import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection, updateTextStyle } from '../src/model/section'
import { visibleSelectionTools } from '../src/tooling/selection-tools'
import { createToolController } from '../src/tooling/tools'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('text editing, variants, columns, transparent bg', () => {
  it('can reset background color to transparent from style popover', async () => {
    const doc = createDocument({ title: 'Bg' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 10,
      width: 100,
      height: 40,
      content: 'x',
    })
    section.backgroundColor = '#ff0000'
    const wrapper = mount(OpenPagesEditor, { props: { modelValue: doc } })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', { button: 0 })
    await wrapper.get('[data-op-tool="section.style"]').trigger('click')
    await wrapper.get('[data-op-bg-transparent]').trigger('click')
    expect(section.backgroundColor).toBe('transparent')
  })

  it('hides text chrome until double-click edit; chrome sits above with a gap', async () => {
    const doc = createDocument({ title: 'Edit' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 40,
      y: 100,
      width: 160,
      height: 48,
      content: 'Hello',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionIds: [section.id],
      },
      attachTo: document.body,
    })

    expect(wrapper.find('[data-op-text-chrome]').exists()).toBe(false)
    expect(wrapper.find('[data-op-text-edit]').exists()).toBe(false)

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    expect(wrapper.find('[data-op-text-edit]').exists()).toBe(true)
    const chrome = wrapper.get('[data-op-text-chrome]')
    const style = (chrome.element as HTMLElement).style
    expect(style.top).toBe(`${section.y}px`)
    expect(style.transform).toContain('translateY')
    expect(style.transform).toMatch(/-\d+px|calc\(-100%/)

    const editor = wrapper.get('[data-op-text-edit]')
    ;(editor.element as HTMLElement).textContent = 'Updated'
    await editor.trigger('input')
    expect(section.content).toContain('Updated')
    wrapper.unmount()
  })

  it('supports bold italic underline strike font variants', () => {
    const page = firstPage(createDocument({ title: 'Var' }))
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      content: 'v',
    })
    updateTextStyle(page, section.id, {
      fontBold: true,
      fontItalic: true,
      fontUnderline: true,
      fontStrike: true,
    })
    expect(section).toMatchObject({
      fontBold: true,
      fontItalic: true,
      fontUnderline: true,
      fontStrike: true,
    })
  })

  it('exposes columns tool for text and applies columnCount', async () => {
    const tools = createToolController()
    const page = firstPage(createDocument({ title: 'Cols' }))
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      content: 'a b c d e f',
    })
    const ids = visibleSelectionTools(tools.list('selection'), [section]).map((t) => t.id)
    expect(ids).toContain('section.columns')

    const doc = createDocument({ title: 'ColsUI' })
    const p = firstPage(doc)
    const s = addTextSection(p, { x: 0, y: 0, width: 200, height: 100, content: 'cols' })
    const wrapper = mount(OpenPagesEditor, { props: { modelValue: doc } })
    await wrapper.get(`[data-op-section="${s.id}"]`).trigger('pointerdown', { button: 0 })
    await wrapper.get('[data-op-tool="section.columns"]').trigger('click')
    await wrapper.get('[data-op-columns]').setValue('3')
    await wrapper.get('[data-op-columns]').trigger('change')
    expect(s.columnCount).toBe(3)
    await wrapper.get('[data-op-text-fit]').setValue(true)
    await wrapper.get('[data-op-text-fit]').trigger('change')
    expect(s.textFit).toBe('fill')
  })

  it('columns popover sets horizontal and vertical alignment, including justify and stretch', async () => {
    const doc = createDocument({ title: 'Align' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 20,
      width: 220,
      height: 160,
      content: 'Align me please across the frame.',
    })
    expect(section.textAlign).toBe('left')
    expect(section.verticalAlign).toBe('top')

    const wrapper = mount(OpenPagesEditor, { props: { modelValue: doc } })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', { button: 0 })
    await wrapper.get('[data-op-tool="section.columns"]').trigger('click')

    // Icon buttons (not text labels) for align controls.
    for (const h of ['left', 'center', 'right', 'justify', 'stretch'] as const) {
      const btn = wrapper.get(`[data-op-align-h="${h}"]`)
      expect(btn.find('svg').exists()).toBe(true)
      expect(btn.text().trim()).toBe('')
    }
    for (const v of ['top', 'middle', 'bottom'] as const) {
      const btn = wrapper.get(`[data-op-align-v="${v}"]`)
      expect(btn.find('svg').exists()).toBe(true)
      expect(btn.text().trim()).toBe('')
    }

    await wrapper.get('[data-op-align-h="center"]').trigger('click')
    expect(section.textAlign).toBe('center')
    await wrapper.get('[data-op-align-h="justify"]').trigger('click')
    expect(section.textAlign).toBe('justify')
    await wrapper.get('[data-op-align-h="stretch"]').trigger('click')
    expect(section.textAlign).toBe('stretch')
    await wrapper.get('[data-op-align-v="middle"]').trigger('click')
    expect(section.verticalAlign).toBe('middle')
    await wrapper.get('[data-op-align-v="bottom"]').trigger('click')
    expect(section.verticalAlign).toBe('bottom')

    const columnsInput = wrapper.get('[data-op-columns]')
    expect(columnsInput.classes()).toContain('op-columns-input')
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/style.css'),
      'utf8',
    )
    expect(css).toMatch(/\.op-columns-input\s*\{[^}]*max-width:\s*3\.5rem/s)

    const fitLabel = wrapper.get('label.op-field--check')
    expect(fitLabel.classes()).toContain('op-field--check')
    expect(fitLabel.find('[data-op-text-fit]').exists()).toBe(true)

    wrapper.unmount()

    section.textAlign = 'justify'
    const justifyRenderer = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
    })
    const justifyStyle = justifyRenderer.get('[data-op-line]').attributes('style') ?? ''
    expect(justifyStyle).toMatch(/text-align:\s*justify/)
    expect(justifyStyle).toMatch(/text-align-last:\s*justify/)
    expect(justifyStyle).toMatch(/white-space:\s*normal/)
    justifyRenderer.unmount()

    section.textAlign = 'stretch'
    const stretchRenderer = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
    })
    const stretchStyle = stretchRenderer.get('[data-op-line]').attributes('style') ?? ''
    expect(stretchStyle).toMatch(/transform:\s*scaleX\(/)
    expect(stretchStyle).toMatch(/transform-origin:\s*left/)
    expect(stretchStyle).not.toMatch(/text-align-last:\s*justify/)
    stretchRenderer.unmount()
  })
})
