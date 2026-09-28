import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument } from '../src/model/document'
import { createHtmlShowcaseDocument } from '../src/model/html-showcase-demo'
import { addTextSection, updateTextStyle } from '../src/model/section'

/**
 * Line-box paint must show panel + inline marks (b/i/u/s/color) and list markers.
 * The hidden contenteditable must not leak visible styled glyphs.
 */

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

async function mountSection(content: string, patch?: Parameters<typeof updateTextStyle>[2]) {
  const doc = createDocument({ title: 'RichPaint' })
  const page = firstPage(doc)
  const section = addTextSection(page, {
    x: 0,
    y: 0,
    width: 320,
    height: 160,
    content,
  })
  section.textFit = 'none'
  if (patch) updateTextStyle(page, section.id, patch)
  const wrapper = mount(OpenPagesRenderer, {
    props: { document: doc, pageId: page.id, selectedSectionIds: [section.id] },
    attachTo: document.body,
  })
  await nextTick()
  return { doc, page, section, wrapper }
}

function lineEls(wrapper: ReturnType<typeof mount>, sectionId: string) {
  return wrapper
    .get(`[data-op-section="${sectionId}"]`)
    .findAll('[data-op-line]')
    .map((l) => l.element as HTMLElement)
}

function decorationOf(el: HTMLElement) {
  return `${el.style.textDecoration} ${el.style.textDecorationLine}`.toLowerCase()
}

describe('line-box rich paint (panel + inline + lists)', () => {
  it('paints section underline on line boxes', async () => {
    const { section, wrapper } = await mountSection('Under me', {
      fontUnderline: true,
    })
    const lines = lineEls(wrapper, section.id)
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.some((el) => decorationOf(el).includes('underline'))).toBe(true)
    wrapper.unmount()
  })

  it('paints section strike-through on line boxes', async () => {
    const { section, wrapper } = await mountSection('Strike me', {
      fontStrike: true,
    })
    const lines = lineEls(wrapper, section.id)
    expect(lines.length).toBeGreaterThan(0)
    expect(
      lines.some(
        (el) =>
          decorationOf(el).includes('line-through') || decorationOf(el).includes('linethrough'),
      ),
    ).toBe(true)
    wrapper.unmount()
  })

  it('paints inline bold from <b> inside line boxes', async () => {
    const { section, wrapper } = await mountSection('say <b>Bold</b> now')
    const root = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    const bold = root.querySelector(
      '[data-op-lines] b, [data-op-lines] strong, [data-op-run][data-op-bold]',
    )
    expect(bold).toBeTruthy()
    expect((bold as HTMLElement).textContent).toMatch(/Bold/)
    wrapper.unmount()
  })

  it('paints inline italic from <i> inside line boxes', async () => {
    const { section, wrapper } = await mountSection('say <i>Italic</i> now')
    const root = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    const hit = root.querySelector(
      '[data-op-lines] i, [data-op-lines] em, [data-op-run][data-op-italic]',
    )
    expect(hit).toBeTruthy()
    expect((hit as HTMLElement).textContent).toMatch(/Italic/)
    wrapper.unmount()
  })

  it('paints inline underline from <u> inside line boxes', async () => {
    const { section, wrapper } = await mountSection('say <u>Under</u> now')
    const root = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    const hit = root.querySelector(
      '[data-op-lines] u, [data-op-run][data-op-underline]',
    ) as HTMLElement | null
    expect(hit).toBeTruthy()
    expect(hit!.textContent).toMatch(/Under/)
    const deco = decorationOf(hit!)
    const tag = hit!.tagName.toLowerCase()
    expect(tag === 'u' || deco.includes('underline')).toBe(true)
    wrapper.unmount()
  })

  it('paints inline strike from <s> inside line boxes', async () => {
    const { section, wrapper } = await mountSection('say <s>Strike</s> now')
    const root = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    const hit = root.querySelector(
      '[data-op-lines] s, [data-op-lines] strike, [data-op-run][data-op-strike]',
    ) as HTMLElement | null
    expect(hit).toBeTruthy()
    expect(hit!.textContent).toMatch(/Strike/)
    const deco = decorationOf(hit!)
    const tag = hit!.tagName.toLowerCase()
    expect(tag === 's' || tag === 'strike' || deco.includes('line-through')).toBe(true)
    wrapper.unmount()
  })

  it('paints overlapping bold+italic+underline on the same selection', async () => {
    const { section, wrapper } = await mountSection('xx <b><i><u>Mix</u></i></b> yy')
    const root = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    const mix = Array.from(root.querySelectorAll('[data-op-run]')).find((n) =>
      (n.textContent ?? '').includes('Mix'),
    ) as HTMLElement | undefined
    expect(mix).toBeTruthy()
    expect(mix!.getAttribute('data-op-bold') != null || mix!.style.fontWeight === '700').toBe(true)
    expect(mix!.getAttribute('data-op-italic') != null || mix!.style.fontStyle === 'italic').toBe(
      true,
    )
    expect(
      mix!.getAttribute('data-op-underline') != null || decorationOf(mix!).includes('underline'),
    ).toBe(true)
    wrapper.unmount()
  })

  it('paints inline color on line boxes, not as visible CE glyphs', async () => {
    const { section, wrapper } = await mountSection(
      'paint <span style="color: #ff0000">Red</span> here',
    )
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('dblclick')
    await nextTick()

    const root = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    const painted = root.querySelector(
      '[data-op-lines] [data-op-run][data-op-color], [data-op-lines] [style*="color"]',
    ) as HTMLElement | null
    expect(painted).toBeTruthy()
    expect(painted!.textContent).toMatch(/Red/)
    expect(painted!.style.color || painted!.getAttribute('data-op-color') != null).toBeTruthy()

    // Flat CE stays a transparent hit target — colored spans must not be the visible paint.
    const edit = wrapper.get('[data-op-text-edit]').element as HTMLElement
    expect(edit.classList.contains('op-section-text-edit')).toBe(true)
    wrapper.unmount()
  })

  it('shows list markers for ul/ol on line boxes inside the section', async () => {
    const { section, wrapper } = await mountSection(
      '<ul><li>Alpha</li><li>Beta</li></ul><ol><li>One</li></ol>',
    )
    const root = wrapper.get(`[data-op-section="${section.id}"]`).element as HTMLElement
    const marked = root.querySelectorAll('[data-op-line][data-op-marker]')
    expect(marked.length).toBeGreaterThanOrEqual(3)
    const sectionRect = root.getBoundingClientRect()
    for (const line of Array.from(marked)) {
      const el = line as HTMLElement
      expect(el.getAttribute('data-op-marker')?.length).toBeGreaterThan(0)
      // Marker gutter keeps the glyph inside the section (not clipped outside).
      const pad = Number.parseFloat(el.style.paddingLeft) || 0
      const csPad = Number.parseFloat(getComputedStyle(el).paddingLeft) || 0
      expect(pad > 0 || csPad > 0).toBe(true)
      const r = el.getBoundingClientRect()
      expect(r.left).toBeGreaterThanOrEqual(sectionRect.left - 1)
    }
    wrapper.unmount()
  })

  it('HTML Showcase paints inline bold and list markers', async () => {
    const doc = createHtmlShowcaseDocument()
    const page = doc.pages[0]!
    const body = page.sections.find((s) => s.type === 'text')!
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id, selectedSectionIds: [body.id] },
      attachTo: document.body,
    })
    await nextTick()
    const root = wrapper.get(`[data-op-section="${body.id}"]`).element as HTMLElement
    expect(
      root.querySelector('[data-op-lines] b, [data-op-lines] strong, [data-op-run][data-op-bold]'),
    ).toBeTruthy()
    expect(root.querySelectorAll('[data-op-line][data-op-marker]').length).toBeGreaterThanOrEqual(4)
    wrapper.unmount()
  })
})
