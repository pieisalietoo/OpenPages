import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { sanitizeTextHtml } from '../src/model/sanitize-html'
import { addTextSection, setSectionHidden } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('chrome form controls stay usable while editing', () => {
  it('chrome size input accepts decimal steps and persists 7.5px on the section', async () => {
    const doc = createDocument({ title: 'ChromeDecimalSize' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 200,
      height: 50,
      content: 'Decimal size body',
    })
    section.fontSize = 14
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()

    const sizeInput = wrapper.get('[data-op-text-chrome-size]')
    const el = sizeInput.element as HTMLInputElement
    expect(Number.parseFloat(el.step)).toBeLessThan(1)
    expect(Number.parseFloat(el.step)).toBeGreaterThan(0)

    await sizeInput.trigger('mousedown')
    el.value = '7.5'
    await sizeInput.trigger('change')
    await nextTick()

    expect(section.fontSize).toBe(7.5)
    wrapper.unmount()
  })

  it('does not preventDefault on select/number inputs so they can be used', async () => {
    const doc = createDocument({ title: 'ChromeInputs' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 200,
      height: 50,
      content: 'Edit me',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')

    const size = wrapper.get('[data-op-text-chrome-size]').element
    const sizeEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    size.dispatchEvent(sizeEvent)
    expect(sizeEvent.defaultPrevented).toBe(false)

    const select = wrapper.get('[data-op-text-chrome] select').element
    const selectEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    select.dispatchEvent(selectEvent)
    expect(selectEvent.defaultPrevented).toBe(false)

    const lh = wrapper.get('[data-op-text-chrome-lineheight]').element
    const lhEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    lh.dispatchEvent(lhEvent)
    expect(lhEvent.defaultPrevented).toBe(false)

    const bold = wrapper.get('[data-op-chrome-bold]').element
    const boldEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    bold.dispatchEvent(boldEvent)
    expect(boldEvent.defaultPrevented).toBe(true)

    wrapper.unmount()
  })

  it('applies font size from chrome after focusing the size input (saved selection)', async () => {
    const doc = createDocument({ title: 'ChromeSize' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 200,
      height: 50,
      content: 'Hello World',
    })
    section.fontSize = 14
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    const edit = wrapper.get('[data-op-text-edit]').element as HTMLElement
    const text = edit.firstChild
    if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error('expected text')
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 5)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    await wrapper.get('[data-op-text-chrome-size]').trigger('mousedown')
    const sizeInput = wrapper.get('[data-op-text-chrome-size]')
    ;(sizeInput.element as HTMLInputElement).value = '22'
    await sizeInput.trigger('change')

    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*22px/i)
    wrapper.unmount()
  })

  it('keeps saved selection when mousedown on size happens after live selection is gone', async () => {
    const doc = createDocument({ title: 'ChromeSizeLost' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 200,
      height: 50,
      content: 'Hello World',
    })
    section.fontSize = 14
    section.lineHeight = 1.4
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    const edit = wrapper.get('[data-op-text-edit]').element as HTMLElement
    const text = edit.firstChild
    if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error('expected text')
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 5)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    // Simulate browser clearing the live selection when the number input takes focus.
    document.getSelection()?.removeAllRanges()
    document.dispatchEvent(new Event('selectionchange'))

    await wrapper.get('[data-op-text-chrome-size]').trigger('mousedown')
    const sizeInput = wrapper.get('[data-op-text-chrome-size]')
    ;(sizeInput.element as HTMLInputElement).value = '22'
    await sizeInput.trigger('change')
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*22px/i)
    expect(section.content).toContain('World')

    const sized = edit.querySelector('span')
    if (!sized) throw new Error('expected sized span')
    const sizedRange = document.createRange()
    sizedRange.selectNodeContents(sized)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(sizedRange)
    document.dispatchEvent(new Event('selectionchange'))
    document.getSelection()?.removeAllRanges()
    document.dispatchEvent(new Event('selectionchange'))

    await wrapper.get('[data-op-text-chrome-lineheight]').trigger('mousedown')
    const lhInput = wrapper.get('[data-op-text-chrome-lineheight]')
    ;(lhInput.element as HTMLInputElement).value = '2'
    await lhInput.trigger('change')
    expect(section.lineHeight).toBe(1.4)
    expect(section.content).toMatch(/line-height:\s*2/i)

    wrapper.unmount()
  })

  it('keeps the same text selected across repeated chrome size changes', async () => {
    const doc = createDocument({ title: 'ChromeKeepSel' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 200,
      height: 50,
      content: 'Hello World',
    })
    section.fontSize = 14
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    const edit = wrapper.get('[data-op-text-edit]').element as HTMLElement
    const text = edit.firstChild
    if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error('expected text')
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 5)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    document.getSelection()?.removeAllRanges()
    document.dispatchEvent(new Event('selectionchange'))

    const sizeInput = wrapper.get('[data-op-text-chrome-size]')
    await sizeInput.trigger('mousedown')
    ;(sizeInput.element as HTMLInputElement).value = '18'
    await sizeInput.trigger('change')
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*18px/i)

    // No re-selection: second spinner change must still target only "Hello".
    document.getSelection()?.removeAllRanges()
    document.dispatchEvent(new Event('selectionchange'))
    await sizeInput.trigger('mousedown')
    ;(sizeInput.element as HTMLInputElement).value = '24'
    await sizeInput.trigger('change')
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*24px/i)
    expect(section.content).toContain('World')
    // Unselected suffix must not have picked up the second size as section default.
    expect(section.content.replace(/<span[^>]*>Hello<\/span>/i, '')).not.toMatch(
      /font-size:\s*24px/i,
    )

    wrapper.unmount()
  })

  it('shows a selection stand-in and keeps focus on the size input while adjusting', async () => {
    const doc = createDocument({ title: 'ChromeFocus' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 200,
      height: 50,
      content: 'Hello World',
    })
    section.fontSize = 14
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    const edit = wrapper.get('[data-op-text-edit]').element as HTMLElement
    const text = edit.firstChild
    if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error('expected text')
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 5)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))

    const sizeInput = wrapper.get('[data-op-text-chrome-size]')
    ;(sizeInput.element as HTMLInputElement).focus()
    await sizeInput.trigger('mousedown')
    expect(edit.querySelector('[data-op-chrome-sel]')).toBeTruthy()

    ;(sizeInput.element as HTMLInputElement).value = '18'
    await sizeInput.trigger('input')
    expect(document.activeElement).toBe(sizeInput.element)
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*18px/i)
    expect(edit.querySelector('[data-op-chrome-sel]')).toBeTruthy()

    ;(sizeInput.element as HTMLInputElement).value = '20'
    await sizeInput.trigger('input')
    expect(document.activeElement).toBe(sizeInput.element)
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/font-size:\s*20px/i)

    wrapper.unmount()
  })

  it('clears the chrome selection mark when the user selects different text', async () => {
    const doc = createDocument({ title: 'ChromeReselect' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 220,
      height: 50,
      content: 'Hello World',
    })
    section.fontSize = 14
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()
    const edit = wrapper.get('[data-op-text-edit]').element as HTMLElement
    const text = edit.firstChild
    if (!text || text.nodeType !== Node.TEXT_NODE) throw new Error('expected text')

    const first = document.createRange()
    first.setStart(text, 0)
    first.setEnd(text, 5)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(first)
    document.dispatchEvent(new Event('selectionchange'))

    const sizeInput = wrapper.get('[data-op-text-chrome-size]')
    ;(sizeInput.element as HTMLInputElement).focus()
    await sizeInput.trigger('mousedown')
    ;(sizeInput.element as HTMLInputElement).value = '18'
    await sizeInput.trigger('input')
    expect(edit.querySelector('[data-op-chrome-sel]')?.textContent).toBe('Hello')

    // User clicks back into the text and selects "World".
    edit.focus()
    await nextTick()
    const helloSpan = edit.querySelector('[data-op-chrome-sel]')
    const worldText = Array.from(edit.childNodes).find(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').includes('World'),
    )
    if (!worldText) throw new Error('expected World text node')
    const second = document.createRange()
    const worldOffset = (worldText.textContent ?? '').indexOf('World')
    second.setStart(worldText, Math.max(0, worldOffset))
    second.setEnd(worldText, Math.max(0, worldOffset) + 5)
    document.getSelection()?.removeAllRanges()
    document.getSelection()?.addRange(second)
    document.dispatchEvent(new Event('selectionchange'))
    await nextTick()

    expect(helloSpan?.hasAttribute('data-op-chrome-sel') ?? false).toBe(false)
    expect(edit.querySelector('[data-op-chrome-sel]')).toBeNull()

    await sizeInput.trigger('mousedown')
    ;(sizeInput.element as HTMLInputElement).value = '22'
    await sizeInput.trigger('input')
    expect(section.fontSize).toBe(14)
    expect(section.content).toMatch(/World/i)
    const marked = edit.querySelector('[data-op-chrome-sel]')
    expect(marked?.textContent).toContain('World')
    expect(marked?.textContent).not.toContain('Hello')

    wrapper.unmount()
  })
})

describe('lock/hide toggle icons and active outline', () => {
  it('shows unlock icon and active outline when all selected sections are locked', async () => {
    const doc = createDocument({ title: 'LockUI' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      content: 'x',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 10,
      ctrlKey: false,
    })
    const lockBtn = wrapper.get('[data-op-tool="section.lock"]')
    expect(lockBtn.classes()).not.toContain('is-active')
    expect(lockBtn.attributes('data-op-tool-icon')).toBe('lock')

    await lockBtn.trigger('click')
    expect(section.locked).toBe(true)
    expect(lockBtn.classes()).toContain('is-active')
    expect(lockBtn.attributes('data-op-tool-icon')).toBe('lock-open')
    expect(lockBtn.attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })

  it('toggles hide/unhide with eye icons, active outline, and authoring visibility', async () => {
    const doc = createDocument({ title: 'HideUI' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 80,
      height: 40,
      content: 'x',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', {
      button: 0,
      clientX: 10,
      clientY: 10,
      ctrlKey: false,
    })
    const hideBtn = wrapper.get('[data-op-tool="section.hide"]')
    expect(hideBtn.attributes('data-op-tool-icon')).toBe('eye-off')

    await hideBtn.trigger('click')
    expect(section.hidden).toBe(true)
    expect(wrapper.find(`[data-op-section="${section.id}"]`).exists()).toBe(true)
    expect(wrapper.get(`[data-op-section="${section.id}"]`).classes()).toContain('is-hidden')
    expect(hideBtn.classes()).toContain('is-active')
    expect(hideBtn.attributes('data-op-tool-icon')).toBe('eye')
    expect(hideBtn.attributes('aria-pressed')).toBe('true')

    await hideBtn.trigger('click')
    expect(section.hidden).toBe(false)
    expect(wrapper.get(`[data-op-section="${section.id}"]`).classes()).not.toContain('is-hidden')
    wrapper.unmount()
  })
})

describe('sanitizeTextHtml', () => {
  it('strips scripts, iframes, images, embeds and event handlers', () => {
    expect(sanitizeTextHtml('<script>alert(1)</script>Hi')).toBe('Hi')
    expect(sanitizeTextHtml('A<img src=x onerror=alert(1)>B')).toBe('AB')
    expect(sanitizeTextHtml('<iframe src="about:blank"></iframe>Ok')).toBe('Ok')
    expect(sanitizeTextHtml('<object data="x"></object><embed src="y">Z')).toBe('Z')
    const styled = sanitizeTextHtml(
      '<span style="font-size: 20px; color: red" onclick="evil()">X</span>',
    )
    expect(styled).toContain('font-size')
    expect(styled).toContain('X')
    expect(styled.toLowerCase()).not.toContain('onclick')
    expect(styled.toLowerCase()).not.toContain('evil')
  })

  it('keeps safe formatting tags used by the text chrome', () => {
    const html = sanitizeTextHtml(
      '<b>B</b><i>I</i><u>U</u><s>S</s><span style="font-family: Arial; line-height: 1.5">T</span>',
    )
    expect(html).toContain('<b>')
    expect(html).toContain('<i>')
    expect(html).toContain('<u>')
    expect(html).toMatch(/line-height/i)
    expect(html).toContain('T')
  })

  it('sanitizes content when syncing in-place edits', async () => {
    const doc = createDocument({ title: 'SanitizeEdit' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 10,
      y: 40,
      width: 180,
      height: 50,
      content: 'Safe',
    })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
      attachTo: document.body,
    })
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    const edit = wrapper.get('[data-op-text-edit]').element as HTMLElement
    edit.innerHTML = 'Hi<script>alert(1)</script><img src=x><iframe></iframe>'
    await wrapper.get('[data-op-text-edit]').trigger('input')
    expect(section.content.toLowerCase()).not.toContain('script')
    expect(section.content.toLowerCase()).not.toContain('img')
    expect(section.content.toLowerCase()).not.toContain('iframe')
    expect(section.content).toContain('Hi')
    wrapper.unmount()
  })
})

describe('renderer showHidden', () => {
  it('omits hidden sections by default but shows them when showHidden is set', () => {
    const doc = createDocument({ title: 'ShowHidden' })
    const page = firstPage(doc)
    const section = addTextSection(page, {
      x: 0,
      y: 0,
      width: 40,
      height: 20,
      content: 'gone',
    })
    setSectionHidden(page, section.id, true)
    const hidden = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id },
    })
    expect(hidden.find(`[data-op-section="${section.id}"]`).exists()).toBe(false)
    hidden.unmount()

    const shown = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, showHidden: true },
    })
    expect(shown.find(`[data-op-section="${section.id}"]`).exists()).toBe(true)
    expect(shown.get(`[data-op-section="${section.id}"]`).classes()).toContain('is-hidden')
    shown.unmount()
  })
})
