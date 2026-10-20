import { describe, expect, it } from 'vitest'
import { createDocument } from '../src/model/document'
import {
  applyLayoutPreset,
  type LayoutPresetId,
  listLayoutPresets,
} from '../src/model/layout-presets'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

describe('E2 comic layout presets', () => {
  it('lists comic grid presets including 2x2, 2x3, 3x3, widescreen, splash+inset', () => {
    const ids = listLayoutPresets().map((p) => p.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'blank',
        'comic-2x2',
        'comic-2x3',
        'comic-3x3',
        'comic-widescreen',
        'comic-splash-inset',
      ]),
    )
  })

  it('applies comic-2x2 as four panels inside margins with gutters', () => {
    const page = firstPage(createDocument({ title: 'Grid' }))
    const panels = applyLayoutPreset(page, 'comic-2x2', { gutter: 12 })
    expect(panels).toHaveLength(4)
    expect(panels.every((s) => s.type === 'panel')).toBe(true)
    expect(page.sections).toHaveLength(4)

    const left = Math.min(...panels.map((p) => p.x))
    const top = Math.min(...panels.map((p) => p.y))
    expect(left).toBe(page.margins.left)
    expect(top).toBe(page.margins.top)

    const rights = panels.map((p) => p.x + p.width)
    const bottoms = panels.map((p) => p.y + p.height)
    expect(Math.max(...rights)).toBe(page.width - page.margins.right)
    expect(Math.max(...bottoms)).toBe(page.height - page.margins.bottom)
  })

  it.each([
    ['comic-2x3', 6],
    ['comic-3x3', 9],
    ['comic-widescreen', 3],
    ['comic-splash-inset', 2],
  ] as Array<[LayoutPresetId, number]>)('applies %s with %i panels', (id, count) => {
    const page = firstPage(createDocument({ title: id }))
    const panels = applyLayoutPreset(page, id)
    expect(panels).toHaveLength(count)
    expect(page.sections.filter((s) => s.type === 'panel')).toHaveLength(count)
  })

  it('blank clears sections; apply replaces existing content by default', () => {
    const page = firstPage(createDocument({ title: 'Replace' }))
    addTextSection(page, { x: 0, y: 0, width: 10, height: 10, content: 'keep?' })
    applyLayoutPreset(page, 'blank')
    expect(page.sections).toHaveLength(0)

    addTextSection(page, { x: 0, y: 0, width: 10, height: 10, content: 'gone' })
    applyLayoutPreset(page, 'comic-2x2')
    expect(page.sections).toHaveLength(4)
    expect(page.sections.every((s) => s.type === 'panel')).toBe(true)
  })
})
