import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument, parseDocument, serializeDocument } from '../src/model/document'
import {
  DEFAULT_WRAP_OFFSET,
  relativeExclusionsForHost,
  runaroundZonesForHost,
} from '../src/model/runaround'
import {
  addPanelSection,
  addRunaroundSection,
  addTextSection,
  duplicateSection,
} from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

describe('runaround sections', () => {
  it('adds, duplicates, and round-trips runaround with wrapOffset', () => {
    const doc = createDocument({ title: 'Runaround' })
    const page = firstPage(doc)
    const zone = addRunaroundSection(page, {
      x: 40,
      y: 80,
      width: 120,
      height: 90,
    })

    expect(zone).toMatchObject({
      type: 'runaround',
      wrapOffset: DEFAULT_WRAP_OFFSET,
    })

    const copy = duplicateSection(page, zone.id)
    expect(copy?.type).toBe('runaround')
    if (copy?.type === 'runaround') {
      expect(copy.wrapOffset).toBe(DEFAULT_WRAP_OFFSET)
    }

    const parsed = parseDocument(serializeDocument(doc))
    expect(firstPage(parsed).sections.map((s) => s.type)).toEqual(['runaround', 'runaround'])
    expect(firstPage(parsed).sections[0]).toMatchObject({
      type: 'runaround',
      wrapOffset: DEFAULT_WRAP_OFFSET,
    })
  })

  it('computes host-relative exclusion rects with wrap offset and skips hidden', () => {
    const host = { x: 0, y: 0, width: 400, height: 400 }
    const exclusions = relativeExclusionsForHost(host, [
      { id: 'a', x: 100, y: 50, width: 80, height: 60, wrapOffset: 10 },
      { id: 'hidden', x: 10, y: 10, width: 40, height: 40, hidden: true },
      { id: 'outside', x: 500, y: 0, width: 40, height: 40 },
    ])

    expect(exclusions).toHaveLength(1)
    expect(exclusions[0]).toEqual({
      id: 'a',
      x: 90,
      y: 40,
      width: 100,
      height: 80,
    })
  })

  it('renderer lays out text lines that avoid a centered runaround', () => {
    const doc = createDocument({ title: 'Wrap' })
    const page = firstPage(doc)
    const text = addTextSection(page, {
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      content:
        'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho.',
    })
    const zone = addRunaroundSection(page, {
      x: 100,
      y: 40,
      width: 100,
      height: 80,
    })
    zone.wrapOffset = 0

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id },
    })

    expect(wrapper.get(`[data-op-section="${text.id}"]`).classes()).toContain('op-section--text')
    expect(wrapper.get(`[data-op-section="${zone.id}"]`).classes()).toContain(
      'op-section--runaround',
    )
    expect(wrapper.find('[data-op-lines]').exists()).toBe(true)

    const hole = { x: 100, y: 40, width: 100, height: 80 }
    const lines = wrapper.findAll('[data-op-line]')
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      const style = line.attributes('style') ?? ''
      const left = Number(/left:\s*([\d.]+)px/.exec(style)?.[1] ?? NaN)
      const top = Number(/top:\s*([\d.]+)px/.exec(style)?.[1] ?? NaN)
      const width = Number(/width:\s*([\d.]+)px/.exec(style)?.[1] ?? NaN)
      const height = Number(/height:\s*([\d.]+)px/.exec(style)?.[1] ?? NaN)
      expect(Number.isFinite(left) && Number.isFinite(top)).toBe(true)
      expect(overlaps({ x: left, y: top, width, height }, hole)).toBe(false)
    }
  })

  it('section.add popover can insert a runaround', async () => {
    const doc = createDocument({ title: 'AddRunaround' })
    const page = firstPage(doc)
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
    })
    await wrapper.get('[data-op-tool="section.add"]').trigger('click')
    await wrapper.get('[data-op-add-type="runaround"]').trigger('click')
    expect(page.sections.map((s) => s.type)).toEqual(['runaround'])
  })

  it('toggles runaround on a panel so neighboring text wraps around it, not around itself', async () => {
    const doc = createDocument({ title: 'Toggle wrap' })
    const page = firstPage(doc)
    const text = addTextSection(page, {
      x: 0,
      y: 0,
      width: 300,
      height: 300,
      content:
        'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho.',
    })
    const panel = addPanelSection(page, {
      x: 100,
      y: 40,
      width: 100,
      height: 80,
      borderStyle: 'ink',
    })
    expect(panel.runaround).toBe(false)

    const editor = mount(OpenPagesEditor, { props: { modelValue: doc } })
    await editor.get(`[data-op-section="${panel.id}"]`).trigger('pointerdown', {
      button: 0,
      clientX: 110,
      clientY: 50,
    })
    expect(editor.find('[data-op-tool="section.runaround"]').exists()).toBe(true)
    expect(editor.get('[data-op-tool="section.runaround"]').attributes('aria-pressed')).toBe(
      'false',
    )
    await editor.get('[data-op-tool="section.runaround"]').trigger('click')
    expect(panel.runaround).toBe(true)
    expect(editor.get('[data-op-tool="section.runaround"]').attributes('aria-pressed')).toBe('true')
    editor.unmount()

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id },
    })
    const hole = { x: 100, y: 40, width: 100, height: 80 }
    const lines = wrapper.findAll('[data-op-line]')
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      const style = line.attributes('style') ?? ''
      const left = Number(/left:\s*([\d.]+)px/.exec(style)?.[1] ?? NaN)
      const top = Number(/top:\s*([\d.]+)px/.exec(style)?.[1] ?? NaN)
      const width = Number(/width:\s*([\d.]+)px/.exec(style)?.[1] ?? NaN)
      const height = Number(/height:\s*([\d.]+)px/.exec(style)?.[1] ?? NaN)
      expect(overlaps({ x: left, y: top, width, height }, hole)).toBe(false)
    }
    expect(wrapper.find(`[data-op-section="${text.id}"]`).exists()).toBe(true)
  })

  it('does not treat a text frame itself as its own runaround exclusion', () => {
    const zones = runaroundZonesForHost(
      [
        {
          id: 'self',
          type: 'text',
          x: 0,
          y: 0,
          width: 200,
          height: 200,
          runaround: true,
          hidden: false,
        },
        {
          id: 'other',
          type: 'panel',
          x: 40,
          y: 40,
          width: 60,
          height: 60,
          runaround: true,
          hidden: false,
        },
      ],
      'self',
    )
    expect(zones.map((z) => z.id)).toEqual(['other'])
  })

  it('keeps the inline text editor above later runaround sections in source mode', async () => {
    const doc = createDocument({ title: 'EditZ' })
    const page = firstPage(doc)
    const text = addTextSection(page, {
      x: 10,
      y: 10,
      width: 200,
      height: 120,
      content: '<p>Covered?</p>',
    })
    addRunaroundSection(page, {
      x: 40,
      y: 40,
      width: 140,
      height: 80,
    })

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [text.id] },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${text.id}"]`).trigger('dblclick')
    await nextTick()
    await wrapper.get('[data-op-chrome-source-toggle]').trigger('click')
    await nextTick()

    const editing = wrapper.get(`[data-op-section="${text.id}"]`)
    expect(editing.classes()).toContain('is-editing')
    expect(wrapper.find('[data-op-text-source]').exists()).toBe(true)

    const editingZ = Number.parseInt(getComputedStyle(editing.element as HTMLElement).zIndex, 10)
    const runaround = wrapper.get('.op-section--runaround').element as HTMLElement
    const runaroundRaw = getComputedStyle(runaround).zIndex
    const runaroundZ = Number.parseInt(runaroundRaw, 10)
    expect(Number.isFinite(editingZ)).toBe(true)
    expect(editingZ).toBeGreaterThan(Number.isFinite(runaroundZ) ? runaroundZ : 0)

    const chrome = wrapper.get('[data-op-text-chrome]').element as HTMLElement
    const chromeZ = Number.parseInt(getComputedStyle(chrome).zIndex, 10)
    expect(chromeZ).toBeGreaterThan(editingZ)

    const source = wrapper.get('[data-op-text-source]').element as HTMLElement
    expect(getComputedStyle(source).backgroundColor).toMatch(
      /^(#fff|#ffffff|rgb\(\s*255,\s*255,\s*255\s*\))$/i,
    )

    wrapper.unmount()
  })
})
