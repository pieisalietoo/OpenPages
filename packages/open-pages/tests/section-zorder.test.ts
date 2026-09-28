import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import {
  addTextSection,
  bringForward,
  bringToFront,
  sendBackward,
  sendToBack,
  setSectionHidden,
  setSectionLocked,
} from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

describe('B2 z-order lock hide', () => {
  it('sections default to unlocked and visible', () => {
    const page = firstPage(createDocument({ title: 'Defaults' }))
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      content: 'd',
    })
    expect(section.locked).toBe(false)
    expect(section.hidden).toBe(false)
  })

  it('bringForward / sendBackward / front / back reorder stacking', () => {
    const page = firstPage(createDocument({ title: 'Z' }))
    const a = addTextSection(page, { x: 0, y: 0, width: 1, height: 1, content: 'a' })
    const b = addTextSection(page, { x: 0, y: 0, width: 1, height: 1, content: 'b' })
    const c = addTextSection(page, { x: 0, y: 0, width: 1, height: 1, content: 'c' })

    bringForward(page, a.id)
    expect(page.sections.map((s) => ('content' in s ? s.content : s.type))).toEqual(['b', 'a', 'c'])

    sendBackward(page, c.id)
    expect(page.sections.map((s) => ('content' in s ? s.content : s.type))).toEqual(['b', 'c', 'a'])

    bringToFront(page, b.id)
    expect(page.sections.map((s) => ('content' in s ? s.content : s.type))).toEqual(['c', 'a', 'b'])

    sendToBack(page, b.id)
    expect(page.sections.map((s) => ('content' in s ? s.content : s.type))).toEqual(['b', 'c', 'a'])
  })

  it('setSectionLocked and setSectionHidden toggle flags', () => {
    const page = firstPage(createDocument({ title: 'Flags' }))
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      content: 'f',
    })
    setSectionLocked(page, section.id, true)
    setSectionHidden(page, section.id, true)
    expect(section.locked).toBe(true)
    expect(section.hidden).toBe(true)
  })

  it('renderer omits hidden sections and blocks drag when locked', async () => {
    const doc = createDocument({ title: 'UI' })
    const page = firstPage(doc)
    const hidden = addTextSection(page, {
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      content: 'gone',
    })
    const locked = addTextSection(page, {
      x: 10,
      y: 10,
      width: 40,
      height: 20,
      content: 'lock',
    })
    setSectionHidden(page, hidden.id, true)
    setSectionLocked(page, locked.id, true)

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionId: locked.id,
      },
    })

    expect(wrapper.find(`[data-op-section="${hidden.id}"]`).exists()).toBe(false)
    const el = wrapper.get(`[data-op-section="${locked.id}"]`)
    await el.trigger('pointerdown', { clientX: 20, clientY: 20, button: 0 })
    await wrapper.get('[data-op-renderer]').trigger('pointermove', { clientX: 40, clientY: 50 })
    expect(locked).toMatchObject({ x: 10, y: 10 })
  })
})
