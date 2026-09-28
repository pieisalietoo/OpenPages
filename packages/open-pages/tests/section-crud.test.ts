import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import {
  addTextSection,
  deleteSection,
  duplicateSection,
  moveSection,
  nudgeSection,
  reorderSection,
  resizeSection,
} from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

describe('B1 section CRUD + geometry', () => {
  it('deleteSection removes by id', () => {
    const page = firstPage(createDocument({ title: 'Del' }))
    const a = addTextSection(page, { x: 0, y: 0, width: 10, height: 10, content: 'a' })
    addTextSection(page, { x: 1, y: 1, width: 10, height: 10, content: 'b' })
    expect(deleteSection(page, a.id)).toBe(true)
    expect(page.sections).toHaveLength(1)
    expect(
      page.sections[0] && 'content' in page.sections[0] ? page.sections[0].content : null,
    ).toBe('b')
    expect(deleteSection(page, 'missing')).toBe(false)
  })

  it('duplicateSection clones geometry offset and content', () => {
    const page = firstPage(createDocument({ title: 'Dup' }))
    const original = addTextSection(page, {
      x: 40,
      y: 50,
      width: 100,
      height: 60,
      content: 'Copy me',
    })
    const copy = duplicateSection(page, original.id)
    expect(copy).toMatchObject({
      content: 'Copy me',
      x: 56,
      y: 66,
      width: 100,
      height: 60,
    })
    expect(copy?.id).not.toBe(original.id)
    expect(page.sections).toHaveLength(2)
  })

  it('reorderSection moves index and clamps bounds', () => {
    const page = firstPage(createDocument({ title: 'Order' }))
    const a = addTextSection(page, { x: 0, y: 0, width: 1, height: 1, content: 'a' })
    const b = addTextSection(page, { x: 0, y: 0, width: 1, height: 1, content: 'b' })
    const c = addTextSection(page, { x: 0, y: 0, width: 1, height: 1, content: 'c' })

    reorderSection(page, c.id, 0)
    expect(page.sections.map((s) => s.id)).toEqual([c.id, a.id, b.id])

    reorderSection(page, c.id, 99)
    expect(page.sections.map((s) => s.id)).toEqual([a.id, b.id, c.id])
  })

  it('moveSection and resizeSection update geometry', () => {
    const page = firstPage(createDocument({ title: 'Geom' }))
    const section = addTextSection(page, {
      x: 10,
      y: 20,
      width: 100,
      height: 80,
      content: 'box',
    })
    moveSection(page, section.id, 30, 40)
    expect(section).toMatchObject({ x: 30, y: 40 })
    resizeSection(page, section.id, 120, 90)
    expect(section).toMatchObject({ width: 120, height: 90 })
  })

  it('nudgeSection moves by step on arrow directions', () => {
    const page = firstPage(createDocument({ title: 'Nudge' }))
    const section = addTextSection(page, {
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      content: 'n',
    })
    nudgeSection(page, section.id, 'ArrowRight', 1)
    expect(section).toMatchObject({ x: 101, y: 100 })
    nudgeSection(page, section.id, 'ArrowUp', 10)
    expect(section).toMatchObject({ x: 101, y: 90 })
  })

  it('renderer keyboard nudge updates selected section', async () => {
    const doc = createDocument({ title: 'Keys' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 10,
      width: 80,
      height: 40,
      content: 'Move',
    })

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionId: section.id,
      },
      attachTo: document.body,
    })

    await wrapper.get('[data-op-renderer]').trigger('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      shiftKey: false,
    })
    expect(section.x).toBe(11)

    await wrapper.get('[data-op-renderer]').trigger('keydown', {
      key: 'ArrowDown',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(section.y).toBe(20)

    wrapper.unmount()
  })

  it('renderer drag moves the selected section', async () => {
    const doc = createDocument({ title: 'Drag' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 20,
      y: 30,
      width: 100,
      height: 50,
      content: 'Drag',
    })

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionId: section.id,
      },
    })

    const el = wrapper.get(`[data-op-section="${section.id}"]`)
    await el.trigger('pointerdown', { clientX: 40, clientY: 50, button: 0 })
    await el.trigger('pointermove', { clientX: 60, clientY: 80 })
    await el.trigger('pointerup', { clientX: 60, clientY: 80 })

    expect(section).toMatchObject({ x: 40, y: 60 })
  })

  it('renderer resize handle grows the selected section', async () => {
    const doc = createDocument({ title: 'Resize' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 10,
      width: 100,
      height: 80,
      content: 'Resize',
    })

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionId: section.id,
      },
    })

    const handle = wrapper.get(`[data-op-resize="${section.id}"]`)
    await handle.trigger('pointerdown', { clientX: 110, clientY: 90, button: 0 })
    await handle.trigger('pointermove', { clientX: 130, clientY: 120 })
    await handle.trigger('pointerup', { clientX: 130, clientY: 120 })

    expect(section).toMatchObject({ width: 120, height: 110 })
  })
})
