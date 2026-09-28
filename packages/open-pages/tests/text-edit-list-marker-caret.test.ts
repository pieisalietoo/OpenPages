import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createHtmlShowcaseDocument } from '../src/model/html-showcase-demo'
import { plainTextOf } from '../src/model/text-edit/plain-offset'
import { caretLeftInLineEl, offsetAtClientPoint } from '../src/model/text-layout/dom-hit'
import { createCanvasMeasurer, createFixedMeasurer } from '../src/model/text-layout/measure'
import { listGutterPx } from './helpers/wysiwyg-harness'

/**
 * List markers live in padding-left: 1.35em (CSS ::before). Hit-test and caret
 * paint must resolve that gutter in px. parseFloat('1.35em') === 1.35 is NOT px —
 * that shifts the caret under the "2." and makes EOL look like mid-"two".
 */

function stubLayoutRects(wrapper: VueWrapper, sectionId: string) {
  const section = wrapper.get(`[data-op-section="${sectionId}"]`).element as HTMLElement
  section.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 800,
      bottom: 1000,
      width: 800,
      height: 1000,
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

async function mountShowcase() {
  const doc = createHtmlShowcaseDocument()
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  const body = page.sections.find((s) => s.type === 'text')
  if (!body) throw new Error('expected body text section')
  const wrapper = mount(OpenPagesRenderer, {
    props: { document: doc, pageId: page.id, selectedSectionIds: [body.id] },
    attachTo: document.body,
  })
  await wrapper.get(`[data-op-section="${body.id}"]`).trigger('dblclick')
  await nextTick()
  stubLayoutRects(wrapper, body.id)
  return { doc, page, body, wrapper }
}

function lineByText(wrapper: VueWrapper, needle: string) {
  const hit = wrapper.findAll('[data-op-line]').find((l) => l.text().includes(needle))
  if (!hit) throw new Error(`no line containing ${JSON.stringify(needle)}`)
  return hit
}

describe('list marker gutter: em padding vs caret/hit', () => {
  it('caretLeftInLineEl at offset 0 includes the full em gutter, not parseFloat(em)', () => {
    const el = document.createElement('div')
    el.style.paddingLeft = '1.35em'
    el.style.fontSize = '14px'
    el.textContent = 'Ordered item two'
    document.body.appendChild(el)
    el.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 200,
        bottom: 20,
        width: 200,
        height: 20,
        toJSON() {
          return {}
        },
      }) as DOMRect

    const measure = createFixedMeasurer(0.5)
    const style = { fontFamily: 'serif', fontSize: 14 }
    const left = caretLeftInLineEl(el, 0, { measure, style })
    const gutter = 1.35 * 14
    expect(left).toBeGreaterThan(gutter - 1)
    expect(left).toBeLessThan(gutter + 1)
    // Guard against the parseFloat('1.35em') === 1.35 trap:
    expect(left).toBeGreaterThan(10)

    el.remove()
  })

  it('hit-test at the visual start of glyphs (after gutter) maps to offset 0', () => {
    const el = document.createElement('div')
    el.style.paddingLeft = '1.35em'
    el.style.fontSize = '14px'
    el.textContent = 'Ordered item two'
    document.body.appendChild(el)
    el.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 200,
        bottom: 20,
        width: 200,
        height: 20,
        toJSON() {
          return {}
        },
      }) as DOMRect

    const measure = createFixedMeasurer(0.5)
    const style = { fontFamily: 'serif', fontSize: 14 }
    const gutter = 1.35 * 14
    // First glyph of "O" sits just after the marker gutter.
    const offset = offsetAtClientPoint([el], gutter + 1, 10, { measure, style })
    expect(offset).toBe(0)

    el.remove()
  })
})

describe('showcase ordered list: caret chrome vs marker (user-visible)', () => {
  it('caret at start of "Ordered item two" sits after the 2. gutter, not under the marker', async () => {
    const { wrapper } = await mountShowcase()
    const line = lineByText(wrapper, 'Ordered item two')
    const el = line.element as HTMLElement
    expect(el.getAttribute('data-op-marker')).toMatch(/2/)
    expect(el.style.paddingLeft).toMatch(/em/)

    const rect = el.getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    // Click in the marker gutter / line-box origin — user "inizio riga".
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + 1,
      clientY: rect.top + rect.height / 2,
      pointerId: 1,
    })
    await nextTick()

    const caret = wrapper.get('[data-op-text-caret]').element as HTMLElement
    const caretLeft = Number.parseFloat(caret.style.left) || 0
    const gutter = listGutterPx(el)
    // Caret is section-relative; line.left is also section-relative via stub.
    expect(caretLeft).toBeGreaterThanOrEqual(rect.left + gutter - 2)

    wrapper.unmount()
  })

  it('click on the first glyph of "Ordered item two" inserts at the start of that line', async () => {
    const { body, wrapper } = await mountShowcase()
    const line = lineByText(wrapper, 'Ordered item two')
    const el = line.element as HTMLElement
    const rect = el.getBoundingClientRect()
    const gutter = listGutterPx(el)
    const edit = wrapper.get('[data-op-text-edit]')

    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + gutter + 1,
      clientY: rect.top + rect.height / 2,
      pointerId: 1,
    })
    await nextTick()
    await edit.trigger('keydown', { key: 'X' })
    await nextTick()

    const plain = plainTextOf(body.content)
    expect(plain).toMatch(/XOrdered item two/)
    expect(plain).not.toMatch(/OXordered|OrXdered|item tXwo/)

    wrapper.unmount()
  })

  it('EOL caret on "Ordered item two" sits at the visual end (gutter + text), not mid-"two"', async () => {
    const { wrapper } = await mountShowcase()
    const line = lineByText(wrapper, 'Ordered item two')
    const el = line.element as HTMLElement
    const text = el.textContent ?? ''
    const rect = el.getBoundingClientRect()
    const gutter = listGutterPx(el)
    const fontSize = Number.parseFloat(el.style.fontSize) || 14
    const measure = createCanvasMeasurer()
    const textW = measure(text, {
      fontFamily: el.style.fontFamily || 'Georgia, serif',
      fontSize,
      fontBold: false,
    })
    const edit = wrapper.get('[data-op-text-edit]')

    // Visual end of the line content (after gutter + glyphs).
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + gutter + textW - 0.5,
      clientY: rect.top + rect.height / 2,
      pointerId: 1,
    })
    await nextTick()

    const caret = wrapper.get('[data-op-text-caret]').element as HTMLElement
    const caretLeft = Number.parseFloat(caret.style.left) || 0
    const expected = rect.left + gutter + textW
    expect(Math.abs(caretLeft - expected)).toBeLessThan(3)

    // From true EOL, one ArrowRight must leave this line (next block).
    const caretTop = Number.parseFloat(caret.style.top) || 0
    await edit.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    const after = wrapper.get('[data-op-text-caret]').element as HTMLElement
    const afterTop = Number.parseFloat(after.style.top) || 0
    expect(afterTop).toBeGreaterThan(caretTop + 2)

    wrapper.unmount()
  })
})
