import { describe, expect, it } from 'vitest'
import { createDocument } from '../src/model/document'
import { addPanelSection, addTextSection } from '../src/model/section'
import {
  layerBringToFront,
  layerSetHidden,
  layerSetLocked,
  listPageLayers,
} from '../src/model/layer-nav'

describe('A4 layer navigator API', () => {
  it('lists layers in section order and supports reorder/hidden/locked', () => {
    const doc = createDocument({ title: 'L' })
    const page = doc.pages[0]!
    const a = addPanelSection(page, { x: 0, y: 0, width: 100, height: 100 })
    const b = addTextSection(page, {
      x: 10,
      y: 10,
      width: 80,
      height: 40,
      content: 'Hello layer',
    })

    const listed = listPageLayers(page)
    expect(listed.map((l) => l.id)).toEqual([a.id, b.id])
    expect(listed[1]?.name).toContain('Hello')

    expect(layerBringToFront(page, a.id)).toBe(true)
    expect(listPageLayers(page).map((l) => l.id)).toEqual([b.id, a.id])

    expect(layerSetHidden(page, b.id, true)).toBe(true)
    expect(layerSetLocked(page, a.id, true)).toBe(true)
    const after = listPageLayers(page)
    expect(after.find((l) => l.id === b.id)?.hidden).toBe(true)
    expect(after.find((l) => l.id === a.id)?.locked).toBe(true)
  })
})
