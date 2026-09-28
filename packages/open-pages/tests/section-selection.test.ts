import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument, parseDocument, serializeDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'
import { createSelection, selectSection } from '../src/model/selection'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

describe('A3 text section + selection', () => {
  it('addTextSection appends a text section with geometry and content', () => {
    const doc = createDocument({ title: 'Body' })
    const section = addTextSection(firstPage(doc), {
      x: 64,
      y: 80,
      width: 400,
      height: 120,
      content: 'Hello columns',
    })

    expect(firstPage(doc).sections).toHaveLength(1)
    expect(section).toMatchObject({
      id: expect.any(String),
      type: 'text',
      x: 64,
      y: 80,
      width: 400,
      height: 120,
      content: 'Hello columns',
    })
  })

  it('serialize/parse round-trips text sections', () => {
    const doc = createDocument({ title: 'Round' })
    addTextSection(firstPage(doc), {
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      content: 'Ink',
    })
    const parsed = parseDocument(serializeDocument(doc))
    expect(firstPage(parsed).sections[0]).toMatchObject({
      type: 'text',
      content: 'Ink',
      x: 10,
      y: 20,
    })
  })

  it('selection model tracks selected section ids', () => {
    const selection = createSelection()
    expect(selection.selectedSectionId).toBeNull()
    expect(selection.selectedSectionIds).toEqual([])
    expect(selection.hoveredSectionId).toBeNull()

    selectSection(selection, 'sec_1')
    expect(selection.selectedSectionId).toBe('sec_1')
    expect(selection.selectedSectionIds).toEqual(['sec_1'])

    selectSection(selection, null)
    expect(selection.selectedSectionId).toBeNull()
    expect(selection.selectedSectionIds).toEqual([])
  })

  it('renderer shows text content and selection/hover rings', async () => {
    const doc = createDocument({ title: 'UI' })
    const section = addTextSection(firstPage(doc), {
      x: 48,
      y: 64,
      width: 240,
      height: 80,
      content: 'Lead paragraph',
    })

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: firstPage(doc).id,
        selectedSectionId: section.id,
        hoveredSectionId: null,
      },
    })

    const sectionEl = wrapper.get(`[data-op-section="${section.id}"]`)
    expect(sectionEl.text()).toContain('Lead paragraph')
    expect(sectionEl.classes()).toContain('is-selected')
    expect(sectionEl.attributes('style')).toContain('left: 48px')
    expect(sectionEl.attributes('style')).toContain('top: 64px')

    await wrapper.setProps({ selectedSectionId: null, hoveredSectionId: section.id })
    expect(sectionEl.classes()).toContain('is-hovered')
    expect(sectionEl.classes()).not.toContain('is-selected')
  })

  it('clicking a section emits select', async () => {
    const doc = createDocument({ title: 'Click' })
    const section = addTextSection(firstPage(doc), {
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      content: 'Tap',
    })

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: firstPage(doc).id,
        selectedSectionId: null,
      },
    })

    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', {
      button: 0,
      clientX: 1,
      clientY: 1,
    })
    expect(wrapper.emitted('select')).toEqual([[section.id, { additive: false }]])
  })
})
