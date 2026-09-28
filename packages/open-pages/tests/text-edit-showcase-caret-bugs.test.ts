import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createHtmlShowcaseDocument } from '../src/model/html-showcase-demo'
import { plainTextOf } from '../src/model/text-edit/plain-offset'

/**
 * Repros for live-WYSIWYG caret bugs on the HTML Showcase demo.
 * Selection dual-highlight is treated as a symptom, not a separate fix target.
 */
describe('HTML Showcase WYSIWYG caret bugs (repro)', () => {
  function stubLayoutRects(wrapper: VueWrapper, sectionId: string) {
    const section = wrapper.get(`[data-op-section="${sectionId}"]`).element as HTMLElement
    // Section origin at (0,0); line boxes use section-local left/top from layout styles.
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

  it('1) click on a heading line places the caret so typing edits that heading', async () => {
    const { body, wrapper } = await mountShowcase()
    const heading = lineByText(wrapper, 'Heading three')
    const rect = (heading.element as HTMLElement).getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + 8,
      clientY: rect.top + rect.height / 2,
    })
    await nextTick()
    await edit.trigger('keydown', { key: 'Q' })
    await nextTick()

    expect(body.content).toMatch(/<h3[^>]*>[^<]*Q/i)
    expect(body.content).not.toMatch(/^Q|<h1[^>]*>Q/i)

    wrapper.unmount()
  })

  it('2) arrow keys can move from the paragraph under Heading three into the heading', async () => {
    const { body, wrapper } = await mountShowcase()
    const para = lineByText(wrapper, 'Subheads stay')
    const rect = (para.element as HTMLElement).getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: rect.left + 4,
      clientY: rect.top + 4,
    })
    await nextTick()

    await edit.trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    await edit.trigger('keydown', { key: 'X' })
    await nextTick()

    expect(body.content).toMatch(/<h3[^>]*>[^<]*X/i)
    expect(body.content).not.toMatch(/<p>[^<]*X[^<]*Subheads|<p>XSubheads/i)
    expect(body.content).toMatch(/<p>Subheads stay/i)

    wrapper.unmount()
  })

  it('3) typing several characters keeps the caret — does not jump to the start after the first key', async () => {
    const { body, wrapper } = await mountShowcase()
    const line = lineByText(wrapper, 'next lines')
    const el = line.element as HTMLElement
    const rect = el.getBoundingClientRect()
    const edit = wrapper.get('[data-op-text-edit]')
    const midX = rect.left + el.offsetWidth * 0.35
    await edit.trigger('pointerdown', {
      button: 0,
      clientX: midX,
      clientY: rect.top + rect.height / 2,
    })
    await nextTick()

    await edit.trigger('keydown', { key: 'z' })
    await edit.trigger('keydown', { key: 'z' })
    await edit.trigger('keydown', { key: 'z' })
    await nextTick()

    const plain = plainTextOf(body.content)
    expect(plain).toMatch(/nezzzt|nzzz|zzz.*next|next.*zzz/i)
    expect(plain.startsWith('zzz')).toBe(false)
    expect(plain).not.toMatch(/^z+Heading one/i)

    wrapper.unmount()
  })
})
