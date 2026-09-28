import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createHtmlShowcaseDocument } from '../src/model/html-showcase-demo'
import { plainTextOf } from '../src/model/text-edit/plain-offset'
import { type CaretAffinity, caretRectForOffset } from '../src/model/text-layout/caret'
import { createCanvasMeasurer, createFixedMeasurer } from '../src/model/text-layout/measure'
import { withModelOffsets } from './helpers/model-offsets'
import { listGutterPx } from './helpers/wysiwyg-harness'

/**
 * Soft-wrap / block boundaries share one model offset between the end of line N
 * and the start of line N+1. EOL must stay reachable (upstream affinity); word
 * select must not bleed across layout lines into the next block.
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
  const lines = wrapper.findAll('[data-op-line]')
  const hit = lines.find((l) => l.text().includes(needle))
  if (!hit) throw new Error(`no line containing ${JSON.stringify(needle)}`)
  return hit
}

describe('caret affinity at soft-wrap / block boundaries', () => {
  const measure = createFixedMeasurer(0.5)
  const style = { fontFamily: 'serif', fontSize: 16 }
  const lines = withModelOffsets([
    { text: 'Hi', x: 0, y: 0, width: 40, height: 20, columnIndex: 0 },
    { text: 'Yo', x: 0, y: 20, width: 40, height: 20, columnIndex: 0 },
  ])

  it('upstream affinity keeps the caret at the end of the earlier line', () => {
    const affinity: CaretAffinity = 'upstream'
    const rect = caretRectForOffset(lines, 2, measure, style, affinity)
    expect(rect).not.toBeNull()
    expect(rect?.y).toBe(0)
    expect(rect?.x).toBe(measure('Hi', style))
  })

  it('downstream affinity keeps the caret at the start of the later line', () => {
    const affinity: CaretAffinity = 'downstream'
    const rect = caretRectForOffset(lines, 2, measure, style, affinity)
    expect(rect).not.toBeNull()
    expect(rect?.y).toBe(20)
    expect(rect?.x).toBe(0)
  })
})

describe('HTML Showcase EOL caret + word select', () => {
  it('click at EOL of "Ordered item two" keeps caret on that line; typing inserts after two', async () => {
    const { body, wrapper } = await mountShowcase()
    const line = lineByText(wrapper, 'Ordered item two')
    const el = line.element as HTMLElement
    const text = el.textContent ?? ''
    const rect = el.getBoundingClientRect()
    const fontSize = Number.parseFloat(el.style.fontSize) || 16
    const measure = createCanvasMeasurer()
    const textW = measure(text, {
      fontFamily: el.style.fontFamily || 'Georgia, serif',
      fontSize,
    })
    const gutter = listGutterPx(el)
    const edit = wrapper.get('[data-op-text-edit]')

    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + gutter + Math.min(textW, Math.max(1, rect.width - gutter - 1)),
      clientY: rect.top + rect.height / 2,
      pointerId: 1,
    })
    await nextTick()

    const caret = wrapper.get('[data-op-text-caret]').element as HTMLElement
    const caretTop = Number.parseFloat(caret.style.top) || 0
    expect(Math.abs(caretTop - rect.top)).toBeLessThan(2)

    await edit.trigger('keydown', { key: 'X' })
    await nextTick()

    const plain = plainTextOf(body.content)
    // Next block after the ordered list is the mixed-size showcase line.
    expect(plain).toMatch(/twoXMixed sizes/)
    expect(plain).not.toMatch(/twXoMixed|twoMixedX/)

    wrapper.unmount()
  })

  it('ArrowRight can rest on the EOL of "Ordered item two" without jumping to Closing', async () => {
    const { wrapper } = await mountShowcase()
    const line = lineByText(wrapper, 'Ordered item two')
    const el = line.element as HTMLElement
    const text = el.textContent ?? ''
    const rect = el.getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')

    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left,
      clientY: rect.top + rect.height / 2,
      pointerId: 1,
    })
    await nextTick()
    for (let i = 0; i < text.length; i++) {
      await edit.trigger('keydown', { key: 'ArrowRight' })
      await nextTick()
    }

    const caret = wrapper.get('[data-op-text-caret]').element as HTMLElement
    const caretTop = Number.parseFloat(caret.style.top) || 0
    expect(Math.abs(caretTop - rect.top)).toBeLessThan(2)

    wrapper.unmount()
  })

  it('double-click on "two" selects only that word, not Closing', async () => {
    const { wrapper } = await mountShowcase()
    const line = lineByText(wrapper, 'Ordered item two')
    const el = line.element as HTMLElement
    const text = el.textContent ?? ''
    const twoAt = text.lastIndexOf('two')
    expect(twoAt).toBeGreaterThanOrEqual(0)
    const rect = el.getBoundingClientRect()
    const fontSize = Number.parseFloat(el.style.fontSize) || 16
    const measure = createCanvasMeasurer()
    const intoTwo = measure(text.slice(0, twoAt + 1), {
      fontFamily: el.style.fontFamily || 'Georgia, serif',
      fontSize,
    })
    const gutter = listGutterPx(el)
    const edit = wrapper.get('[data-op-text-edit]')
    const at = {
      clientX: rect.left + gutter + intoTwo,
      clientY: rect.top + rect.height / 2,
      pointerId: 1,
    }

    await edit.trigger('pointerdown', { button: 0, detail: 1, ...at })
    await edit.trigger('pointerup', { button: 0, pointerId: 1 })
    await nextTick()
    await edit.trigger('pointerdown', { button: 0, detail: 1, ...at })
    await edit.trigger('pointerup', { button: 0, pointerId: 1 })
    await nextTick()

    let copied = ''
    await edit.trigger('copy', {
      clipboardData: {
        setData(type: string, data: string) {
          if (type === 'text/plain') copied = data
        },
      },
    })

    expect(copied.toLowerCase()).toBe('two')
    expect(copied.toLowerCase()).not.toContain('closing')

    wrapper.unmount()
  })
})
