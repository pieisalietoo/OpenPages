import { describe, expect, it } from 'vitest'
import { createDocument } from '../src/model/document'
import { applyLayoutPreset } from '../src/model/layout-presets'
import {
  addPanelInFlow,
  mergePanels,
  removePanelFromFlow,
  splitPanel,
} from '../src/model/panel-flow'
import { addTextSection, type PanelSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

function asPanels(sections: ReturnType<typeof applyLayoutPreset>): PanelSection[] {
  return sections.filter((s): s is PanelSection => s.type === 'panel')
}

describe('A1 comics panel flow + reflow', () => {
  it('comic-2x2 assigns reading indices 0–3 L→R T→B', () => {
    const page = firstPage(createDocument({ title: 'Flow' }))
    const panels = asPanels(applyLayoutPreset(page, 'comic-2x2', { gutter: 12 }))
    expect(panels.map((p) => p.readingIndex)).toEqual([0, 1, 2, 3])
    const ordered = [...panels].sort((a, b) => a.readingIndex - b.readingIndex)
    const a = ordered[0]
    const b = ordered[1]
    const c = ordered[2]
    if (!a || !b || !c) throw new Error('expected panels')
    expect(a.x).toBeLessThan(b.x)
    expect(a.y).toBeLessThan(c.y)
  })

  it('removePanelFromFlow redistributes and keeps surviving ids', () => {
    const page = firstPage(createDocument({ title: 'Flow' }))
    const panels = asPanels(applyLayoutPreset(page, 'comic-2x2', { gutter: 12 }))
    const removed = panels[1]
    if (!removed) throw new Error('expected panel')
    const keep = panels.filter((_, i) => i !== 1).map((p) => p.id)
    removePanelFromFlow(page, removed.id, { gutter: 12 })
    const remaining = page.sections.filter((s): s is PanelSection => s.type === 'panel')
    expect(remaining).toHaveLength(3)
    expect(remaining.map((p) => p.id).sort()).toEqual(keep.sort())
    expect(remaining.map((p) => p.readingIndex).sort()).toEqual([0, 1, 2])
  })

  it('addPanelInFlow increases count and fills content box', () => {
    const page = firstPage(createDocument({ title: 'Flow' }))
    applyLayoutPreset(page, 'comic-2x2', { gutter: 10 })
    addPanelInFlow(page, undefined, { gutter: 10 })
    const panels = page.sections.filter((s): s is PanelSection => s.type === 'panel')
    expect(panels).toHaveLength(5)
    const boxRight = page.width - page.margins.right
    const boxBottom = page.height - page.margins.bottom
    expect(Math.max(...panels.map((p) => p.x + p.width))).toBeCloseTo(boxRight, 5)
    expect(Math.max(...panels.map((p) => p.y + p.height))).toBeCloseTo(boxBottom, 5)
  })

  it('mergePanels keeps lowest readingIndex id', () => {
    const page = firstPage(createDocument({ title: 'Flow' }))
    const panels = asPanels(applyLayoutPreset(page, 'comic-2x2', { gutter: 12 }))
    const a = panels[0]
    const b = panels[1]
    if (!a || !b) throw new Error('expected panels')
    const merged = mergePanels(page, [a.id, b.id], { gutter: 12 })
    expect(merged.id).toBe(a.id)
    expect(page.sections.filter((s) => s.type === 'panel')).toHaveLength(3)
  })

  it('splitPanel creates parts and reindexes flow', () => {
    const page = firstPage(createDocument({ title: 'Flow' }))
    const panels = asPanels(applyLayoutPreset(page, 'comic-2x2', { gutter: 12 }))
    const first = panels[0]
    if (!first) throw new Error('expected panel')
    const created = splitPanel(page, first.id, 2, { gutter: 12 })
    expect(created).toHaveLength(2)
    expect(page.sections.filter((s) => s.type === 'panel')).toHaveLength(5)
    const indices = page.sections
      .filter((s): s is PanelSection => s.type === 'panel')
      .map((p) => p.readingIndex)
      .sort((x, y) => x - y)
    expect(indices).toEqual([0, 1, 2, 3, 4])
  })

  it('reflow leaves non-panel sections intact', () => {
    const page = firstPage(createDocument({ title: 'Flow' }))
    applyLayoutPreset(page, 'comic-2x2', { gutter: 12 })
    const text = addTextSection(page, {
      x: 10,
      y: 10,
      width: 100,
      height: 40,
      content: 'caption',
    })
    const panel = page.sections.find((s) => s.type === 'panel')
    if (!panel) throw new Error('expected panel')
    removePanelFromFlow(page, panel.id, { gutter: 12 })
    expect(page.sections.find((s) => s.id === text.id)).toEqual(text)
  })
})
