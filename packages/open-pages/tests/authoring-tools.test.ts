import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { applyPagePreset, setPageMargins } from '../src/model/page'
import {
  addTextSection,
  type Section,
  updateSectionStyle,
  updateTextStyle,
} from '../src/model/section'
import { visibleSelectionTools } from '../src/tooling/selection-tools'
import { createToolController } from '../src/tooling/tools'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

function textStub(id: string): Section {
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    content: 'hi',
    locked: false,
    hidden: false,
    groupId: null,
    backgroundColor: 'transparent',
    color: '#1a1a1a',
    borderColor: 'transparent',
    borderWidth: 0,
    fontFamily: 'Georgia, serif',
    fontSize: 16,
    fontBold: false,
    fontItalic: false,
    fontUnderline: false,
    fontStrike: false,
    columnCount: 1,
    lineHeight: 1.4,
    textFit: 'none',
  }
}

describe('page setup + add + style tools', () => {
  it('orders page.setup, section.add, then magnet after the document separator', () => {
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: createDocument({ title: 'T' }) },
    })
    const bar = wrapper.get('[data-op-toolbar="document"]')
    const toolIds = bar.findAll('[data-op-tool]').map((el) => el.attributes('data-op-tool'))
    expect(toolIds.slice(-3)).toEqual(['page.setup', 'section.add', 'view.magnet'])
    const sep = bar.get('[data-op-toolbar-sep]')
    expect(
      sep.element.nextElementSibling?.querySelector('[data-op-tool="page.setup"]'),
    ).toBeTruthy()
  })

  it('page.setup popover applies preset and margins', async () => {
    const doc = createDocument({ title: 'Setup' })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
    })
    await wrapper.get('[data-op-tool="page.setup"]').trigger('click')
    expect(wrapper.find('[data-op-popover="page.setup"]').exists()).toBe(true)

    await wrapper.get('[data-op-page-preset="letter"]').trigger('click')
    expect(doc.pages[0]?.preset).toBe('letter')
    expect(doc.pages[0]?.width).toBe(816)

    await wrapper.get('[data-op-margin="top"]').setValue('72')
    await wrapper.get('[data-op-margin="top"]').trigger('change')
    expect(doc.pages[0]?.margins.top).toBe(72)
  })

  it('setPageMargins and applyPagePreset update page geometry', () => {
    const page = firstPage(createDocument({ title: 'P' }))
    applyPagePreset(page, 'tabloid')
    expect(page).toMatchObject({ preset: 'tabloid', width: 1056, height: 1632 })
    setPageMargins(page, { top: 10, right: 20, bottom: 30, left: 40 })
    expect(page.margins).toEqual({ top: 10, right: 20, bottom: 30, left: 40 })
  })

  it('section.add popover inserts each section type', async () => {
    const doc = createDocument({ title: 'Add' })
    const page = firstPage(doc)
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
    })
    await wrapper.get('[data-op-tool="section.add"]').trigger('click')
    expect(wrapper.find('[data-op-popover="section.add"]').exists()).toBe(true)

    await wrapper.get('[data-op-add-type="text"]').trigger('click')
    await wrapper.get('[data-op-tool="section.add"]').trigger('click')
    await wrapper.get('[data-op-add-type="headline"]').trigger('click')
    await wrapper.get('[data-op-tool="section.add"]').trigger('click')
    await wrapper.get('[data-op-add-type="image"]').trigger('click')
    await wrapper.get('[data-op-tool="section.add"]').trigger('click')
    await wrapper.get('[data-op-add-type="panel"]').trigger('click')
    await wrapper.get('[data-op-tool="section.add"]').trigger('click')
    await wrapper.get('[data-op-add-type="runaround"]').trigger('click')

    expect(page.sections.map((s) => s.type)).toEqual([
      'text',
      'headline',
      'image',
      'panel',
      'runaround',
    ])
  })

  it('shows style tool for any selection and font tool for text/headline', () => {
    const tools = createToolController()
    const styleIds = visibleSelectionTools(tools.list('selection'), [textStub('a')]).map(
      (t) => t.id,
    )
    expect(styleIds).toContain('section.style')
    expect(styleIds).toContain('section.font')

    const panel: Section = {
      id: 'p',
      type: 'panel',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      borderStyle: 'ink',
      locked: false,
      hidden: false,
      groupId: null,
      backgroundColor: 'transparent',
      color: '#1a1a1a',
      borderColor: '#1a1a1a',
      borderWidth: 2,
    }
    const panelIds = visibleSelectionTools(tools.list('selection'), [panel]).map((t) => t.id)
    expect(panelIds).toContain('section.style')
    expect(panelIds).not.toContain('section.font')
  })

  it('updateSectionStyle and updateTextStyle mutate model fields', () => {
    const page = firstPage(createDocument({ title: 'Style' }))
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      content: 'Hello',
    })
    updateSectionStyle(page, section.id, {
      backgroundColor: '#ffeeaa',
      color: '#112233',
      borderColor: '#000000',
      borderWidth: 2,
    })
    expect(section).toMatchObject({
      backgroundColor: '#ffeeaa',
      color: '#112233',
      borderColor: '#000000',
      borderWidth: 2,
    })
    updateTextStyle(page, section.id, {
      fontFamily: 'Arial, sans-serif',
      fontSize: 22,
      fontBold: true,
    })
    expect(section).toMatchObject({
      fontFamily: 'Arial, sans-serif',
      fontSize: 22,
      fontBold: true,
    })
  })

  it('shows floating text chrome only while editing text in place', async () => {
    const doc = createDocument({ title: 'Chrome' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 40,
      y: 80,
      width: 120,
      height: 40,
      content: 'Edit me',
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
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const chrome = wrapper.get('[data-op-text-chrome]')
    const style = (chrome.element as HTMLElement).style
    expect(style.top).toBe(`${section.y}px`)
    expect(style.transform).toContain('translateY')

    await chrome.get('[data-op-text-chrome-size]').setValue('20')
    await chrome.get('[data-op-text-chrome-size]').trigger('change')
    expect(section.fontSize).toBe(20)

    await chrome.get('[data-op-text-chrome-color]').setValue('#ff0000')
    await chrome.get('[data-op-text-chrome-color]').trigger('input')
    expect(section.color).toBe('#ff0000')
    wrapper.unmount()
  })
})
