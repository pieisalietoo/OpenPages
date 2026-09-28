import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection, bumpFontSizes, updateTextStyle } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('chrome edit persistence, line-height, relative font bump', () => {
  it('keeps edit mode when interacting with floating chrome', async () => {
    const doc = createDocument({ title: 'Keep' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 80,
      width: 200,
      height: 60,
      content: 'Select me',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    expect(wrapper.find('[data-op-text-edit]').exists()).toBe(true)

    await wrapper.get('[data-op-text-chrome]').trigger('mousedown')
    await wrapper.get('[data-op-chrome-bold]').trigger('mousedown')
    await wrapper.get('[data-op-chrome-bold]').trigger('click')

    expect(wrapper.find('[data-op-text-edit]').exists()).toBe(true)
    expect(wrapper.find('[data-op-text-chrome]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('stores and applies lineHeight on text sections', () => {
    const page = firstPage(createDocument({ title: 'LH' }))
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      content: 'x',
    })
    updateTextStyle(page, section.id, { lineHeight: 1.8 })
    expect(section.lineHeight).toBe(1.8)
  })

  it('bumps every font size by ±2 relatively', () => {
    expect(bumpFontSizes([14, 16], 2)).toEqual([16, 18])
    expect(bumpFontSizes([14, 16], -2)).toEqual([12, 14])
    expect(bumpFontSizes([2], -2)).toEqual([1])
  })

  it('A+ / A- buttons bump the section fontSize by 2 while editing', async () => {
    const doc = createDocument({ title: 'Bump' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 180,
      height: 50,
      content: 'Sized',
    })
    section.fontSize = 14
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await wrapper.get('[data-op-chrome-font-up]').trigger('click')
    expect(section.fontSize).toBe(16)
    await wrapper.get('[data-op-chrome-font-down]').trigger('click')
    expect(section.fontSize).toBe(14)
    wrapper.unmount()
  })
})
