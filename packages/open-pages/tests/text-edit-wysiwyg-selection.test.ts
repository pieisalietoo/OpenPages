import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

function stubSectionAndLines(wrapper: ReturnType<typeof mount>, sectionId: string) {
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
    const width = Number.parseFloat(el.style.width) || 200
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

describe('WYSIWYG mouse selection + no native CE highlight', () => {
  it('selects a range by pointer drag across a line', async () => {
    const doc = createDocument({ title: 'MouseSel' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 280,
      height: 60,
      content: 'Hello World',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    stubSectionAndLines(wrapper, section.id)

    const line = wrapper.get('[data-op-line]')
    const rect = (line.element as HTMLElement).getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')

    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + 2,
      clientY: rect.top + 4,
      pointerId: 1,
    })
    await edit.trigger('pointermove', {
      buttons: 1,
      clientX: rect.left + Math.max(40, rect.width * 0.55),
      clientY: rect.top + 4,
      pointerId: 1,
    })
    await edit.trigger('pointerup', { button: 0, pointerId: 1 })
    await nextTick()

    expect(wrapper.find('[data-op-text-sel]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('keeps the native CE selection collapsed while the model selection is active', async () => {
    const doc = createDocument({ title: 'NoNativeSel' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 50,
      content: 'Hello World',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('keydown', { key: 'a', ctrlKey: true })
    await nextTick()

    expect(wrapper.find('[data-op-text-sel]').exists()).toBe(true)

    const sel = (edit.element as HTMLElement).ownerDocument.getSelection()
    expect(sel?.isCollapsed).toBe(true)

    wrapper.unmount()
  })

  it('copies the model selection plain text on the copy event', async () => {
    const doc = createDocument({ title: 'CopySel' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 50,
      content: 'Hello World',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('keydown', { key: 'a', ctrlKey: true })
    await nextTick()

    let written = ''
    const clipboardData = {
      setData(type: string, data: string) {
        if (type === 'text/plain') written = data
      },
      getData() {
        return written
      },
    }
    await edit.trigger('copy', { clipboardData })
    expect(written).toBe('Hello World')

    wrapper.unmount()
  })

  it('selects the word under the caret on double-click', async () => {
    const doc = createDocument({ title: 'DblWord' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 280,
      height: 60,
      content: 'Hello World',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    // Enter edit (first double-click on the section).
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    stubSectionAndLines(wrapper, section.id)

    const line = wrapper.get('[data-op-line]')
    const rect = (line.element as HTMLElement).getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    const atWord = { clientX: rect.left + 8, clientY: rect.top + 4 }

    // Real browsers fire click(detail=2) + dblclick after the second press.
    // Do not inject detail on pointerdown — that masked the broken path.
    await edit.trigger('pointerdown', { button: 0, ...atWord, pointerId: 1 })
    await edit.trigger('pointerup', { button: 0, pointerId: 1 })
    await edit.trigger('click', { button: 0, detail: 1, ...atWord })
    await edit.trigger('pointerdown', { button: 0, ...atWord, pointerId: 1 })
    await edit.trigger('pointerup', { button: 0, pointerId: 1 })
    await edit.trigger('click', { button: 0, detail: 2, ...atWord })
    await edit.trigger('dblclick', { button: 0, detail: 2, ...atWord })
    await nextTick()

    expect(wrapper.find('[data-op-text-sel]').exists()).toBe(true)
    let written = ''
    await edit.trigger('copy', {
      clipboardData: {
        setData(type: string, data: string) {
          if (type === 'text/plain') written = data
        },
      },
    })
    expect(written).toBe('Hello')

    wrapper.unmount()
  })

  it('selects the whole layout line on triple-click', async () => {
    const doc = createDocument({ title: 'TripleLine' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 120,
      height: 80,
      content: 'Hello World Again',
    })
    section.fontSize = 16
    section.lineHeight = 1.25
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    stubSectionAndLines(wrapper, section.id)

    const line = wrapper.get('[data-op-line]')
    const rect = (line.element as HTMLElement).getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    const lineText = (line.element as HTMLElement).textContent ?? ''
    const atLine = { clientX: rect.left + 8, clientY: rect.top + 4 }

    // Triple-click: browsers expose detail=3 on the third click (no tripleclick event).
    await edit.trigger('pointerdown', { button: 0, ...atLine, pointerId: 1 })
    await edit.trigger('pointerup', { button: 0, pointerId: 1 })
    await edit.trigger('click', { button: 0, detail: 1, ...atLine })
    await edit.trigger('pointerdown', { button: 0, ...atLine, pointerId: 1 })
    await edit.trigger('pointerup', { button: 0, pointerId: 1 })
    await edit.trigger('click', { button: 0, detail: 2, ...atLine })
    await edit.trigger('dblclick', { button: 0, detail: 2, ...atLine })
    await edit.trigger('pointerdown', { button: 0, ...atLine, pointerId: 1 })
    await edit.trigger('pointerup', { button: 0, pointerId: 1 })
    await edit.trigger('click', { button: 0, detail: 3, ...atLine })
    await nextTick()

    expect(wrapper.find('[data-op-text-sel]').exists()).toBe(true)
    let written = ''
    await edit.trigger('copy', {
      clipboardData: {
        setData(type: string, data: string) {
          if (type === 'text/plain') written = data
        },
      },
    })
    expect(written).toBe(lineText)

    wrapper.unmount()
  })

  it('disables native spellcheck on the live CE so marks are not painted on flat geometry', async () => {
    const doc = createDocument({ title: 'NoSpell' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 200,
      height: 50,
      content: 'Hello',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    const edit = wrapper.get('[data-op-text-edit]')
    expect(edit.element.getAttribute('spellcheck')).toBe('false')
    wrapper.unmount()
  })
})
