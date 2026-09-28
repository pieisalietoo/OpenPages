import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'
import { inlineRunsFromHtml } from '../src/model/text-layout/inline-runs'

/**
 * After line-box rich paint, CE is invisible — selection font/size/line-height
 * must persist in the model AND paint on run spans. Chrome drafts must not
 * snap back to section defaults while a model selection is active.
 */

function stubRects(wrapper: VueWrapper, sectionId: string) {
  const section = wrapper.get(`[data-op-section="${sectionId}"]`).element as HTMLElement
  section.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 200,
      width: 400,
      height: 200,
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

async function mountEditing(content = 'Hello World') {
  const doc = createDocument({ title: 'SelChrome' })
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  const section = addTextSection(page, {
    x: 0,
    y: 0,
    width: 280,
    height: 80,
    content,
  })
  section.fontSize = 14
  section.lineHeight = 1.4
  section.fontFamily = 'Georgia, serif'
  section.textFit = 'none'
  const wrapper = mount(OpenPagesRenderer, {
    props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
    attachTo: document.body,
  })
  await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
  await nextTick()
  stubRects(wrapper, section.id)
  return { doc, page, section, wrapper }
}

async function selectFirstWord(wrapper: VueWrapper) {
  const line = wrapper.get('[data-op-line]')
  const el = line.element as HTMLElement
  const rect = el.getBoundingClientRect()
  const edit = wrapper.get('[data-op-text-edit]')
  await edit.trigger('pointerdown', {
    button: 0,
    clientX: rect.left + 1,
    clientY: rect.top + 4,
    pointerId: 1,
  })
  await nextTick()
  for (let i = 0; i < 5; i++) {
    await edit.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
  }
  await nextTick()
  return edit
}

describe('inlineRunsFromHtml carries chrome font metrics', () => {
  it('reads font-size, font-family, and line-height from span styles', () => {
    const runs = inlineRunsFromHtml(
      'say <span style="font-size: 20px; font-family: Arial; line-height: 1.8">Hi</span> now',
    )
    const hi = runs.find((r) => r.text === 'Hi')
    expect(hi).toBeTruthy()
    expect(hi?.fontSize).toBe(20)
    expect(hi?.fontFamily?.toLowerCase()).toContain('arial')
    expect(hi?.lineHeight).toBe(1.8)
  })
})

describe('model-selection chrome styles persist and paint', () => {
  it('font size on a shift-selected word sticks in chrome and paints on the line run', async () => {
    const { section, wrapper } = await mountEditing()
    await selectFirstWord(wrapper)

    await wrapper.get('[data-op-text-chrome-size]').trigger('mousedown')
    const sizeInput = wrapper.get('[data-op-text-chrome-size]')
    ;(sizeInput.element as HTMLInputElement).value = '20'
    await sizeInput.trigger('change')
    await nextTick()
    await nextTick()

    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*20px/i)

    // Chrome must keep showing the selection size — not snap back to 14.
    expect((sizeInput.element as HTMLInputElement).value).toBe('20')

    const root = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    const painted = Array.from(root.querySelectorAll('[data-op-line] *')).find((n) =>
      (n.textContent ?? '').includes('Hello'),
    ) as HTMLElement | undefined
    expect(painted).toBeTruthy()
    expect(painted?.style.fontSize).toMatch(/20px/)

    wrapper.unmount()
  })

  it('A+ and line-height on a model selection stick without reverting the chrome', async () => {
    const { section, wrapper } = await mountEditing()
    await selectFirstWord(wrapper)

    await wrapper.get('[data-op-chrome-font-up]').trigger('mousedown')
    await wrapper.get('[data-op-chrome-font-up]').trigger('click')
    await nextTick()
    await nextTick()
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*16px/i)
    const sizeInput = wrapper.get('[data-op-text-chrome-size]')
    expect((sizeInput.element as HTMLInputElement).value).toBe('16')

    await wrapper.get('[data-op-text-chrome-lineheight]').trigger('mousedown')
    const lh = wrapper.get('[data-op-text-chrome-lineheight]')
    ;(lh.element as HTMLInputElement).value = '2'
    await lh.trigger('change')
    await nextTick()
    await nextTick()
    expect(section.lineHeight).toBe(1.4)
    expect(section.content).toMatch(/line-height:\s*2/i)
    expect((lh.element as HTMLInputElement).value).toBe('2')

    wrapper.unmount()
  })

  it('font family on a model selection paints and keeps the select value', async () => {
    const { section, wrapper } = await mountEditing()
    await selectFirstWord(wrapper)

    await wrapper.get('[data-op-text-chrome] select').trigger('mousedown')
    const family = wrapper.get('[data-op-text-chrome] select')
    const options = Array.from((family.element as HTMLSelectElement).options)
    const arial = options.find((o) => /arial/i.test(o.text) || /arial/i.test(o.value))
    expect(arial).toBeTruthy()
    ;(family.element as HTMLSelectElement).value = arial!.value
    await family.trigger('change')
    await nextTick()
    await nextTick()

    expect(section.fontFamily).toBe('Georgia, serif')
    expect(section.content.toLowerCase()).toMatch(/arial/)
    expect((family.element as HTMLSelectElement).value).toBe(arial!.value)

    const root = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    const painted = Array.from(root.querySelectorAll('[data-op-line] *')).find((n) =>
      (n.textContent ?? '').includes('Hello'),
    ) as HTMLElement | undefined
    expect(painted?.style.fontFamily?.toLowerCase()).toMatch(/arial/)

    wrapper.unmount()
  })
})
