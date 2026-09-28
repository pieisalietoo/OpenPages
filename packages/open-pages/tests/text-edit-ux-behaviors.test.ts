import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'
import { plainTextOf } from '../src/model/text-edit/plain-offset'
import { listGutterPx } from './helpers/wysiwyg-harness'

function stubRects(wrapper: VueWrapper, sectionId: string) {
  const section = wrapper.get(`[data-op-section="${sectionId}"]`).element as HTMLElement
  section.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
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

async function mountEdit(content: string, opts?: { width?: number; height?: number }) {
  const doc = createDocument({ title: 'UxBehaviors' })
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  const section = addTextSection(page, {
    x: 0,
    y: 0,
    width: opts?.width ?? 280,
    height: opts?.height ?? 200,
    content,
  })
  section.fontSize = 14
  section.lineHeight = 1.35
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

function lineEl(wrapper: VueWrapper, needle: string) {
  const hit = wrapper.findAll('[data-op-line]').find((l) => l.text().includes(needle))
  if (!hit) throw new Error(`no line ${needle}`)
  return hit.element as HTMLElement
}

async function clickLineStart(wrapper: VueWrapper, needle: string) {
  const el = lineEl(wrapper, needle)
  const rect = el.getBoundingClientRect()
  const gutter = listGutterPx(el)
  const edit = wrapper.get('[data-op-text-edit]')
  await edit.trigger('pointerdown', {
    button: 0,
    clientX: rect.left + gutter + 1,
    clientY: rect.top + Math.min(4, rect.height / 2),
    pointerId: 1,
  })
  await nextTick()
  return { el, edit, rect }
}

function cssZ(selector: string): number {
  const css = readFileSync(resolve(__dirname, '../src/style.css'), 'utf8')
  // Match `.selector { ... z-index: N; }` in the stylesheet (first hit).
  const re = new RegExp(
    `${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*z-index:\\s*(\\d+)`,
    'm',
  )
  const m = css.match(re)
  if (!m?.[1]) throw new Error(`no z-index for ${selector}`)
  return Number(m[1])
}

describe('Home / End caret navigation', () => {
  it('Home goes to start of the current line; End to end of the current line', async () => {
    const { section, wrapper } = await mountEdit('<p>alpha bravo</p><p>charlie delta</p>')
    const { edit, rect } = await clickLineStart(wrapper, 'charlie')
    await edit.trigger('keydown', { key: 'ArrowRight' })
    await edit.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()

    await edit.trigger('keydown', { key: 'Home' })
    await nextTick()
    await edit.trigger('keydown', { key: 'X' })
    await nextTick()
    expect(plainTextOf(section.content)).toMatch(/Xcharlie/)

    await edit.trigger('keydown', { key: 'Home' })
    await edit.trigger('keydown', { key: 'ArrowRight' })
    await edit.trigger('keydown', { key: 'End' })
    await nextTick()
    await edit.trigger('keydown', { key: 'Y' })
    await nextTick()
    expect(plainTextOf(section.content)).toMatch(/deltaY/)
    expect(plainTextOf(section.content)).not.toMatch(/Ycharlie/)

    const caret = wrapper.get('[data-op-text-caret]').element as HTMLElement
    expect(Math.abs((Number.parseFloat(caret.style.top) || 0) - rect.top)).toBeLessThan(2)

    wrapper.unmount()
  })

  it('Ctrl+Home / Ctrl+End jump to start / end of the text panel', async () => {
    const { section, wrapper } = await mountEdit('<p>one</p><p>two</p><p>three</p>')
    const { edit } = await clickLineStart(wrapper, 'two')

    await edit.trigger('keydown', { key: 'Home', ctrlKey: true })
    await nextTick()
    await edit.trigger('keydown', { key: 'Z' })
    await nextTick()
    expect(plainTextOf(section.content).startsWith('Zone')).toBe(true)

    await edit.trigger('keydown', { key: 'End', ctrlKey: true })
    await nextTick()
    await edit.trigger('keydown', { key: 'Q' })
    await nextTick()
    expect(plainTextOf(section.content).endsWith('Q')).toBe(true)

    wrapper.unmount()
  })
})

describe('Delete selection at line start keeps caret on that line', () => {
  it('Backspace of a selection starting at a soft-wrapped line start stays on that line', async () => {
    const { section, wrapper } = await mountEdit('<p>AAAA BBBB CCCC DDDD</p>', {
      width: 80,
      height: 200,
    })
    const line1 = lineEl(wrapper, 'AAAA')
    const rect1 = line1.getBoundingClientRect()

    const edit = wrapper.get('[data-op-text-edit]')
    await clickLineStart(wrapper, 'CCCC')
    for (let i = 0; i < 4; i++) {
      await edit.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    }
    await nextTick()
    await edit.trigger('keydown', { key: 'Backspace' })
    await nextTick()
    stubRects(wrapper, section.id)

    expect(plainTextOf(section.content)).not.toMatch(/CCCC/)

    const line2 = lineEl(wrapper, 'DDDD')
    const rect2 = line2.getBoundingClientRect()
    expect(rect2.top).toBeGreaterThan(rect1.top + 2)

    const caret = wrapper.get('[data-op-text-caret]').element as HTMLElement
    const caretTop = Number.parseFloat(caret.style.top) || 0
    expect(Math.abs(caretTop - rect2.top)).toBeLessThan(2)
    expect(Math.abs(caretTop - rect1.top)).toBeGreaterThan(2)

    await edit.trigger('keydown', { key: 'X' })
    await nextTick()
    expect(plainTextOf(section.content)).toMatch(/XDDDD/)

    wrapper.unmount()
  })
})

describe('Paste replaces selection and leaves caret after inserted text', () => {
  it('paste with an active selection replaces it', async () => {
    const { section, wrapper } = await mountEdit('<p>hello world</p>')
    const { edit } = await clickLineStart(wrapper, 'hello')
    for (let i = 0; i < 5; i++) {
      await edit.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    }
    await nextTick()

    await edit.trigger('paste', {
      clipboardData: {
        getData(type: string) {
          return type === 'text/plain' ? 'Ciao' : ''
        },
      },
    })
    await nextTick()

    expect(plainTextOf(section.content)).toBe('Ciao world')
    wrapper.unmount()
  })

  it('after paste the caret is at the end of the pasted text', async () => {
    const { section, wrapper } = await mountEdit('<p>hello world</p>')
    const { edit } = await clickLineStart(wrapper, 'hello')
    for (let i = 0; i < 5; i++) {
      await edit.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    }
    await nextTick()

    await edit.trigger('paste', {
      clipboardData: {
        getData(type: string) {
          return type === 'text/plain' ? 'Ciao' : ''
        },
      },
    })
    await nextTick()
    await edit.trigger('keydown', { key: '!' })
    await nextTick()

    expect(plainTextOf(section.content)).toBe('Ciao! world')
    wrapper.unmount()
  })

  it('paste shorter than the selection leaves caret at end of new text, not at old selection end', async () => {
    const { section, wrapper } = await mountEdit('<p>hello world</p>')
    const { edit } = await clickLineStart(wrapper, 'hello')
    for (let i = 0; i < 5; i++) {
      await edit.trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    }
    await nextTick()

    // Simulate CE input collapsing the model selection before paste (browser race).
    await edit.trigger('input')
    await nextTick()

    await edit.trigger('keydown', { key: 'v', ctrlKey: true })
    await edit.trigger('paste', {
      clipboardData: {
        getData(type: string) {
          return type === 'text/plain' ? 'Hi' : ''
        },
      },
    })
    await nextTick()
    await edit.trigger('keydown', { key: '!' })
    await nextTick()

    expect(plainTextOf(section.content)).toBe('Hi! world')
    expect(plainTextOf(section.content)).not.toMatch(/Hi w!orld|Hi !world/)
    wrapper.unmount()
  })
})

describe('Floating chrome z-index vs global toolbar menus', () => {
  it('document toolbar z-index is above selection and text chrome', () => {
    // Global toolbar menus must paint above floating section/edit chrome.
    const docToolbarZ = cssZ('.op-toolbar[data-op-toolbar="document"]')
    const selectionZ = cssZ('.op-selection-chrome')
    const textZ = cssZ('.op-text-chrome')
    expect(docToolbarZ).toBeGreaterThan(selectionZ)
    expect(docToolbarZ).toBeGreaterThan(textZ)
  })

  it('selection chrome appears when a section is selected (smoke)', async () => {
    const doc = createDocument({ title: 'Z' })
    const page = doc.pages[0]
    if (!page) throw new Error('expected page')
    const section = addTextSection(page, {
      x: 40,
      y: 80,
      width: 200,
      height: 80,
      content: 'Stack me',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })
    await nextTick()
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', { button: 0 })
    await nextTick()
    expect(wrapper.find('[data-op-selection-chrome]').exists()).toBe(true)
    expect(wrapper.find('[data-op-toolbar="document"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
