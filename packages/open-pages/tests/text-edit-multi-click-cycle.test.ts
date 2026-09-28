import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

function stubRect(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
) {
  el.getBoundingClientRect = () =>
    ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      width: rect.width,
      height: rect.height,
      toJSON() {
        return {}
      },
    }) as DOMRect
}

async function copySel(edit: ReturnType<ReturnType<typeof mount>['get']>): Promise<string> {
  let written = ''
  await edit.trigger('copy', {
    clipboardData: {
      setData(type: string, data: string) {
        if (type === 'text/plain') written = data
      },
    },
  })
  return written
}

async function press(
  edit: ReturnType<ReturnType<typeof mount>['get']>,
  at: { clientX: number; clientY: number },
) {
  // Real UI: repeated single presses (detail stays 1 when prior presses cancel default).
  await edit.trigger('pointerdown', { button: 0, detail: 1, ...at, pointerId: 1 })
  await edit.trigger('pointerup', { button: 0, pointerId: 1 })
  await nextTick()
}

/**
 * Browser-like multi-click cycle on the same spot:
 * 1 → caret, 2 → word, 3 → line, 4 → caret.
 * A long gap after the word selection starts a new gesture (caret).
 */
describe('WYSIWYG multi-click cycle (caret / word / line / caret)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('cycles caret → word → line → caret across four presses at the same point', async () => {
    const doc = createDocument({ title: 'ClickCycle' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 60,
      content: 'Hello World',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()

    const sectionEl = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    stubRect(sectionEl, { left: 0, top: 0, width: 200, height: 60 })
    for (const line of wrapper.findAll('[data-op-line]')) {
      const el = line.element as HTMLElement
      stubRect(el, {
        left: Number.parseFloat(el.style.left) || 0,
        top: Number.parseFloat(el.style.top) || 0,
        width: Number.parseFloat(el.style.width) || 180,
        height: Number.parseFloat(el.style.height) || 20,
      })
    }

    const line = wrapper.get('[data-op-line]')
    const rect = (line.element as HTMLElement).getBoundingClientRect()
    const lineText = (line.element as HTMLElement).textContent ?? ''
    const edit = wrapper.get('[data-op-text-edit]')
    const at = { clientX: rect.left + 8, clientY: rect.top + 4 }

    await press(edit, at)
    expect(wrapper.find('[data-op-text-sel]').exists()).toBe(false)
    expect(await copySel(edit)).toBe('')

    await press(edit, at)
    expect(await copySel(edit)).toBe('Hello')

    await press(edit, at)
    expect(await copySel(edit)).toBe(lineText)

    await press(edit, at)
    expect(wrapper.find('[data-op-text-sel]').exists()).toBe(false)
    expect(await copySel(edit)).toBe('')

    wrapper.unmount()
  })

  it('selects the full first layout line (not only a 1px stub) on the third press', async () => {
    const doc = createDocument({ title: 'FirstLineSelect' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 120,
      height: 100,
      content: 'Hello World Again Please',
    })
    section.fontSize = 16
    section.lineHeight = 1.25
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()

    const sectionEl = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    stubRect(sectionEl, { left: 0, top: 0, width: 120, height: 100 })
    const lineEls = wrapper.findAll('[data-op-line]')
    expect(lineEls.length).toBeGreaterThan(1)
    for (const line of lineEls) {
      const el = line.element as HTMLElement
      stubRect(el, {
        left: Number.parseFloat(el.style.left) || 0,
        top: Number.parseFloat(el.style.top) || 0,
        width: Number.parseFloat(el.style.width) || 120,
        height: Number.parseFloat(el.style.height) || 20,
      })
    }

    const first = lineEls[0]!.element as HTMLElement
    const second = lineEls[1]!.element as HTMLElement
    const firstText = first.textContent ?? ''
    const secondText = second.textContent ?? ''
    const firstRect = first.getBoundingClientRect()
    const secondRect = second.getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')

    const atFirst = { clientX: firstRect.left + 8, clientY: firstRect.top + 4 }
    await press(edit, atFirst)
    await press(edit, atFirst)
    await press(edit, atFirst)
    expect(await copySel(edit)).toBe(firstText)
    const firstSels = wrapper.findAll('[data-op-text-sel]')
    expect(firstSels.length).toBeGreaterThan(0)
    const firstSelW = firstSels.reduce(
      (w, s) => w + Number.parseFloat((s.element as HTMLElement).style.width || '0'),
      0,
    )
    // Must cover the line, not collapse to a 1px caret-edge stub at a soft-wrap boundary.
    expect(firstSelW).toBeGreaterThan(Math.max(24, firstText.length * 4))

    // Control: the last layout line already worked; keep it green while fixing the first.
    const atSecond = { clientX: secondRect.left + 8, clientY: secondRect.top + 4 }
    await vi.advanceTimersByTimeAsync(900)
    await press(edit, atSecond)
    await press(edit, atSecond)
    await press(edit, atSecond)
    expect(await copySel(edit)).toBe(secondText)
    const secondSels = wrapper.findAll('[data-op-text-sel]')
    const secondSelW = secondSels.reduce(
      (w, s) => w + Number.parseFloat((s.element as HTMLElement).style.width || '0'),
      0,
    )
    expect(secondSelW).toBeGreaterThan(Math.max(24, secondText.length * 4))

    wrapper.unmount()
  })

  it('starts a new gesture (caret) if too much time passes after the word selection', async () => {
    const doc = createDocument({ title: 'ClickTimeout' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 60,
      content: 'Hello World',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()

    const sectionEl = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    stubRect(sectionEl, { left: 0, top: 0, width: 200, height: 60 })
    for (const line of wrapper.findAll('[data-op-line]')) {
      const el = line.element as HTMLElement
      stubRect(el, {
        left: Number.parseFloat(el.style.left) || 0,
        top: Number.parseFloat(el.style.top) || 0,
        width: Number.parseFloat(el.style.width) || 180,
        height: Number.parseFloat(el.style.height) || 20,
      })
    }

    const line = wrapper.get('[data-op-line]')
    const rect = (line.element as HTMLElement).getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    const at = { clientX: rect.left + 8, clientY: rect.top + 4 }

    await press(edit, at)
    await press(edit, at)
    expect(await copySel(edit)).toBe('Hello')

    await vi.advanceTimersByTimeAsync(900)
    await press(edit, at)
    expect(wrapper.find('[data-op-text-sel]').exists()).toBe(false)
    expect(await copySel(edit)).toBe('')

    wrapper.unmount()
  })
})
