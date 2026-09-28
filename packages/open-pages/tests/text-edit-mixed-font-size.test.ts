import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createHtmlShowcaseDocument } from '../src/model/html-showcase-demo'
import { plainTextOf } from '../src/model/text-edit/plain-offset'
import { createCanvasMeasurer } from '../src/model/text-layout/measure'
import {
  copyPlain,
  expectedInsertSlot,
  listGutterPx,
  type MountedEdit,
  mountEditing,
  press,
  stubLayoutRects,
} from './helpers/wysiwyg-harness'

/**
 * Mixed inline font sizes must keep hit-test / selection / insert aligned with
 * the painted glyphs. Uniform line-font measure drifts once a run is larger or
 * smaller than the section face.
 */

function bodyIds(mounted: MountedEdit) {
  return { pageId: mounted.pageId, sectionId: mounted.sectionId }
}

/** Stub line boxes, then place each `[data-op-run]` by measuring its own font size. */
function stubMixedSizeRunRects(mounted: MountedEdit) {
  stubLayoutRects(mounted.wrapper, mounted.sectionId)
  const measure = createCanvasMeasurer()
  const root = mounted.wrapper.get(`[data-op-section="${mounted.sectionId}"]`)
  for (const line of root.findAll('[data-op-line]')) {
    const lineEl = line.element as HTMLElement
    const lineRect = lineEl.getBoundingClientRect()
    const gutter = listGutterPx(lineEl)
    const fontFamily = lineEl.style.fontFamily || 'Georgia, serif'
    let x = lineRect.left + gutter
    for (const run of line.findAll('[data-op-run]')) {
      const el = run.element as HTMLElement
      const text = el.textContent ?? ''
      const fontSize =
        Number.parseFloat(el.style.fontSize) || Number.parseFloat(lineEl.style.fontSize) || 14
      const fontBold = el.style.fontWeight === '700' || el.style.fontWeight === 'bold'
      const width = Math.max(1, measure(text, { fontFamily, fontSize, fontBold }))
      const height = lineRect.height || fontSize * 1.35
      const left = x
      const top = lineRect.top
      el.getBoundingClientRect = () =>
        ({
          x: left,
          y: top,
          left,
          top,
          right: left + width,
          bottom: top + height,
          width,
          height,
          toJSON() {
            return {}
          },
        }) as DOMRect
      x += width
    }
  }
}

function runByWord(mounted: MountedEdit, word: string): HTMLElement {
  const root = mounted.wrapper.get(`[data-op-section="${mounted.sectionId}"]`)
  const hit = root.findAll('[data-op-run]').find((r) => (r.text() ?? '') === word)
  if (!hit) throw new Error(`no painted run for ${JSON.stringify(word)}`)
  return hit.element as HTMLElement
}

function pointInRun(el: HTMLElement, into = 1) {
  const rect = el.getBoundingClientRect()
  const text = el.textContent ?? ''
  const fontSize = Number.parseFloat(el.style.fontSize) || 14
  const fontFamily = el.style.fontFamily || 'Georgia, serif'
  const fontBold = el.style.fontWeight === '700' || el.style.fontWeight === 'bold'
  const measure = createCanvasMeasurer()
  const end = Math.min(text.length, Math.max(0, into))
  const prefixW = measure(text.slice(0, end), { fontFamily, fontSize, fontBold })
  return {
    clientX: rect.left + Math.min(Math.max(0.5, prefixW + 0.5), Math.max(1, rect.width - 1)),
    clientY: rect.top + Math.min(4, rect.height / 2),
    pointerId: 1,
  }
}

async function selectPaintedWord(mounted: MountedEdit, word: string): Promise<string> {
  const el = runByWord(mounted, word)
  const edit = mounted.wrapper.get('[data-op-text-edit]')
  const at = pointInRun(el, 1)
  await press(edit, at)
  await press(edit, at)
  return copyPlain(edit)
}

async function typeIntoPaintedWord(mounted: MountedEdit, word: string, key: string) {
  const el = runByWord(mounted, word)
  const edit = mounted.wrapper.get('[data-op-text-edit]')
  const into = Math.min(2, Math.max(1, word.length - 1))
  const at = pointInRun(el, into)
  await edit.trigger('pointerdown', { button: 0, ...at })
  await nextTick()
  await edit.trigger('keydown', { key })
  await nextTick()
}

function waitMs(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

describe('HTML Showcase mixed font-size line', () => {
  let mounted: MountedEdit | null = null

  afterEach(() => {
    mounted?.wrapper.unmount()
    mounted = null
  })

  async function mountShowcase() {
    const doc = createHtmlShowcaseDocument()
    const page = doc.pages[0]
    if (!page) throw new Error('expected page')
    const section = page.sections.find((s) => s.type === 'text')
    if (!section) throw new Error('expected text section')
    expect(section.content).toMatch(/bravo/)
    mounted = await mountEditing(doc, page.id, section.id)
    stubMixedSizeRunRects(mounted)
    return { doc, page, section, mounted }
  }

  it('word-select on large "bravo" copies only that word', async () => {
    const { mounted: m } = await mountShowcase()
    const copied = await selectPaintedWord(m, 'bravo')
    expect(copied).toBe('bravo')
  })

  it('word-select on small "charlie" copies only that word', async () => {
    const { mounted: m } = await mountShowcase()
    const copied = await selectPaintedWord(m, 'charlie')
    expect(copied).toBe('charlie')
  })

  it('word-select on base "alpha" copies only that word', async () => {
    const { mounted: m } = await mountShowcase()
    const copied = await selectPaintedWord(m, 'alpha')
    expect(copied).toBe('alpha')
  })

  it('insert into large "bravo" lands in the exact glyph slot', async () => {
    const { section, mounted: m } = await mountShowcase()
    await typeIntoPaintedWord(m, 'bravo', 'X')
    expect(plainTextOf(section.content)).toContain(expectedInsertSlot('bravo', 'X'))
  })

  it('insert into small "charlie" lands in the exact glyph slot', async () => {
    const { section, mounted: m } = await mountShowcase()
    await typeIntoPaintedWord(m, 'charlie', 'Y')
    expect(plainTextOf(section.content)).toContain(expectedInsertSlot('charlie', 'Y'))
  })

  it('after enlarging "alpha" via chrome, word-select still copies alpha only', async () => {
    const { section, mounted: m } = await mountShowcase()
    const { sectionId } = bodyIds(m)

    // Select alpha, bump size — then selection/hit must still track the painted glyphs.
    const copiedBefore = await selectPaintedWord(m, 'alpha')
    expect(copiedBefore).toBe('alpha')

    await m.wrapper.get('[data-op-text-chrome-size]').trigger('mousedown')
    const sizeInput = m.wrapper.get('[data-op-text-chrome-size]')
    ;(sizeInput.element as HTMLInputElement).value = '24'
    await sizeInput.trigger('change')
    await nextTick()
    stubMixedSizeRunRects(m)

    expect(section.content).toMatch(/font-size:\s*24px/i)
    expect(runByWord(m, 'alpha').style.fontSize).toMatch(/24/)

    const copiedAfter = await selectPaintedWord(m, 'alpha')
    expect(copiedAfter).toBe('alpha')
    expect(copiedAfter.toLowerCase()).not.toContain('bravo')

    // Let the multi-click gesture expire so the next press places a caret (not line-select).
    await waitMs(650)
    stubMixedSizeRunRects(m)
    await typeIntoPaintedWord(m, 'alpha', 'Z')
    expect(plainTextOf(section.content)).toContain(expectedInsertSlot('alpha', 'Z'))
    void sectionId
  })
})
