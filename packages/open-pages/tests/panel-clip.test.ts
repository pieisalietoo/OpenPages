import { describe, expect, it } from 'vitest'
import { createDocument, parseDocument, serializeDocument } from '../src/model/document'
import { applyLayoutPreset } from '../src/model/layout-presets'
import { addPanelSection, type PanelSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

describe('A2 panel viewport clip', () => {
  it('new panels default clipContent true', () => {
    const page = firstPage(createDocument({ title: 'Clip' }))
    const panel = addPanelSection(page, {
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      borderStyle: 'ink',
    })
    expect(panel.clipContent).toBe(true)
    const preset = applyLayoutPreset(page, 'comic-2x2')
    expect(
      preset.filter((s): s is PanelSection => s.type === 'panel').every((p) => p.clipContent),
    ).toBe(true)
  })

  it('clipContent false round-trips; omitted field migrates to true', () => {
    const doc = createDocument({ title: 'Clip' })
    const page = firstPage(doc)
    const panel = addPanelSection(page, {
      x: 0,
      y: 0,
      width: 100,
      height: 80,
      borderStyle: 'ink',
      clipContent: false,
    })
    expect(panel.clipContent).toBe(false)
    const again = parseDocument(serializeDocument(doc))
    const parsed = again.pages[0]?.sections.find((s): s is PanelSection => s.type === 'panel')
    expect(parsed?.clipContent).toBe(false)

    const raw = JSON.parse(serializeDocument(doc)) as {
      pages: Array<{ sections: Array<Record<string, unknown>> }>
    }
    const section = raw.pages[0]?.sections[0]
    if (!section) throw new Error('expected section')
    delete section.clipContent
    const migrated = parseDocument(JSON.stringify(raw))
    const migratedPanel = migrated.pages[0]?.sections[0] as PanelSection
    expect(migratedPanel.clipContent).toBe(true)
  })
})
