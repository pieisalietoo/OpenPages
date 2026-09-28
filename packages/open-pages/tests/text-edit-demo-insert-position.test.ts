import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { createHtmlShowcaseDocument } from '../src/model/html-showcase-demo'
import { addTextSection } from '../src/model/section'
import { plainTextOf } from '../src/model/text-edit/plain-offset'
import { createCanvasMeasurer } from '../src/model/text-layout/measure'

/**
 * Acceptance: demo documents insert at the glyph under the pointer.
 * Relies on model-first offsets (line.modelStart/End === plainTextOf ranges).
 */
function stubLayoutRects(wrapper: VueWrapper, sectionId: string) {
  const section = wrapper.get(`[data-op-section="${sectionId}"]`).element as HTMLElement
  section.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 900,
      bottom: 1200,
      width: 900,
      height: 1200,
      toJSON() {
        return {}
      },
    }) as DOMRect
  for (const line of wrapper.findAll('[data-op-line]')) {
    const el = line.element as HTMLElement
    const left = Number.parseFloat(el.style.left) || 0
    const top = Number.parseFloat(el.style.top) || 0
    const width = Number.parseFloat(el.style.width) || 100
    const height = Number.parseFloat(el.style.height) || 20
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
  }
}

function measurePrefixWidth(text: string, end: number, fontSize: number, fontBold?: boolean) {
  const measure = createCanvasMeasurer()
  return measure(text.slice(0, end), {
    fontFamily: 'Georgia, serif',
    fontSize,
    fontBold,
  })
}

describe('demo WYSIWYG insert position (showcase + newspaper)', () => {
  it('HTML Showcase: click at start of "show" inserts before "show", not before "flow"', async () => {
    const doc = createHtmlShowcaseDocument()
    const page = doc.pages[0]
    if (!page) throw new Error('expected page')
    const body = page.sections.find((s) => s.type === 'text')
    if (!body) throw new Error('expected body')

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [body.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${body.id}"]`).trigger('dblclick')
    await nextTick()
    stubLayoutRects(wrapper, body.id)

    const line = wrapper.findAll('[data-op-line]').find((l) => {
      const t = l.text()
      return t.includes('show') && t.includes('flow')
    })
    if (!line) throw new Error('expected closing line containing show and flow')
    const el = line.element as HTMLElement
    const text = el.textContent ?? ''
    const showAt = text.indexOf('show')
    expect(showAt).toBeGreaterThanOrEqual(0)

    const fontSize = Number.parseFloat(el.style.fontSize) || body.fontSize
    // Aim at the middle of "show" so canvas snap cannot fall back onto the preceding space.
    const intoShow = showAt + 2
    const prefixW = measurePrefixWidth(text, intoShow, fontSize)
    const rect = el.getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + Math.min(prefixW, rect.width - 2),
      clientY: rect.top + Math.min(4, rect.height / 2),
      pointerId: 1,
    })
    await edit.trigger('keydown', { key: 'X' })
    await nextTick()

    const after = plainTextOf(body.content)
    expect(after).toMatch(/shXow|sXhow|shoXw|to Xshow/)
    expect(after).not.toMatch(/bodyX flow|body Xflow|Xflow|toX show/)

    wrapper.unmount()
  })

  it('Newspaper: click at end of "Evening" in the Evening press heading inserts after Evening', async () => {
    const doc = createDocument({ title: 'EveningHit' })
    const page = doc.pages[0]
    if (!page) throw new Error('expected page')
    // Same heading pattern as the Newspaper demo, without columns/fit/runaround noise.
    const body = addTextSection(page, {
      x: 0,
      y: 0,
      width: 400,
      height: 200,
      content: '<h3 data-op-keep-with-next="2">Evening press</h3><p>At the corner cafe.</p>',
    })
    body.fontSize = 14
    body.lineHeight = 1.35
    body.fontFamily = 'Georgia, serif'
    body.textFit = 'none'
    body.columnCount = 1

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [body.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${body.id}"]`).trigger('dblclick')
    await nextTick()
    stubLayoutRects(wrapper, body.id)

    const line = wrapper.findAll('[data-op-line]').find((l) => l.text().includes('Evening press'))
    if (!line) throw new Error('expected Evening press heading line')
    const el = line.element as HTMLElement
    const text = el.textContent ?? ''
    expect(text.startsWith('Evening')).toBe(true)
    const endEve = 'Evening'.length

    const fontSize = Number.parseFloat(el.style.fontSize) || body.fontSize * 1.25
    const prefixW = measurePrefixWidth(text, endEve, fontSize, true)
    const glyph = measurePrefixWidth('g', 1, fontSize, true)
    const rect = el.getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + Math.max(1, prefixW - glyph * 0.25),
      clientY: rect.top + Math.min(4, rect.height / 2),
      pointerId: 1,
    })
    await edit.trigger('keydown', { key: 'X' })
    await nextTick()

    const after = plainTextOf(body.content)
    expect(after).toMatch(/EveninXg|EveningX|EveniXng/)
    expect(after).not.toMatch(/EvXening|Exvening|XEvening/)

    wrapper.unmount()
  })
})
