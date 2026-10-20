import { describe, expect, it } from 'vitest'
import { createDocument, serializeDocument } from '../src/model/document'
import { applyOp, applyOps, createOpsSession } from '../src/model/ops'
import { addPanelSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

describe('H1 ops patch list + undo/redo', () => {
  it('applyOp addPanel adds a panel on the target page', () => {
    const doc = createDocument({ title: 'Ops' })
    const page = firstPage(doc)
    const result = applyOp(doc, {
      type: 'addPanel',
      pageId: page.id,
      x: 40,
      y: 40,
      width: 200,
      height: 160,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.section.type).toBe('panel')
    expect(page.sections).toContain(result.section)
  })

  it('applyOp removeSection deletes by id', () => {
    const doc = createDocument({ title: 'Ops' })
    const page = firstPage(doc)
    const panel = addPanelSection(page, { x: 0, y: 0, width: 100, height: 100 })
    const result = applyOp(doc, {
      type: 'removeSection',
      pageId: page.id,
      sectionId: panel.id,
    })
    expect(result.ok).toBe(true)
    expect(page.sections.find((s) => s.id === panel.id)).toBeUndefined()
  })

  it('applyOps applies a patch list in order', () => {
    const doc = createDocument({ title: 'Ops' })
    const page = firstPage(doc)
    const results = applyOps(doc, [
      {
        type: 'addPanel',
        pageId: page.id,
        x: 10,
        y: 10,
        width: 120,
        height: 90,
      },
      {
        type: 'addPanel',
        pageId: page.id,
        x: 140,
        y: 10,
        width: 120,
        height: 90,
      },
    ])
    expect(results.every((r) => r.ok)).toBe(true)
    expect(page.sections.filter((s) => s.type === 'panel')).toHaveLength(2)
  })

  it('createOpsSession undo/redo restores document snapshots around ops', () => {
    const doc = createDocument({ title: 'Ops' })
    const page = firstPage(doc)
    const session = createOpsSession(doc)
    const before = serializeDocument(doc)

    session.apply({
      type: 'addPanel',
      pageId: page.id,
      x: 20,
      y: 20,
      width: 100,
      height: 80,
    })
    expect(page.sections).toHaveLength(1)
    expect(session.canUndo()).toBe(true)

    const undone = session.undo()
    expect(undone).toBe(true)
    expect(serializeDocument(doc)).toBe(before)
    expect(firstPage(doc).sections).toHaveLength(0)
    expect(session.canRedo()).toBe(true)

    const redone = session.redo()
    expect(redone).toBe(true)
    expect(firstPage(doc).sections).toHaveLength(1)
  })
})
