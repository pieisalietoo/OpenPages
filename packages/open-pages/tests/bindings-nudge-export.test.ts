import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDataBoundDocument, resolveTemplate } from '../src/model/bindings'
import { createDocument } from '../src/model/document'
import { addTextSection } from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

describe('ctrl nudge + toolbar spacer + bindings', () => {
  it('resolves {{tokens}} against document data', () => {
    expect(resolveTemplate('Hi {{name}}!', { name: 'Ada' })).toBe('Hi Ada!')
    expect(resolveTemplate('{{a}}/{{b}}', { a: '1' })).toBe('1/')
  })

  it('data-bound document exposes image/text/snippet variables', () => {
    const doc = createDataBoundDocument({
      imageUrl: 'https://example.com/a.png',
      bodyText: 'Full body',
      snippet: 'part',
    })
    expect(doc.data).toMatchObject({
      imageUrl: 'https://example.com/a.png',
      bodyText: 'Full body',
      snippet: 'part',
    })
    const page = firstPage(doc)
    const image = page.sections.find((s) => s.type === 'image')
    const texts = page.sections.filter((s) => s.type === 'text')
    expect(image).toMatchObject({ src: '{{imageUrl}}' })
    expect(texts.some((s) => s.content.includes('{{bodyText}}'))).toBe(true)
    expect(texts.some((s) => s.content.includes('{{snippet}}'))).toBe(true)
  })

  it('nudges only when Ctrl is held; Ctrl+Shift uses 10px', async () => {
    const doc = createDocument({ title: 'N' })
    const page = firstPage(doc)
    const a = addTextSection(page, { x: 10, y: 10, width: 40, height: 20, content: 'a' })
    const b = addTextSection(page, { x: 20, y: 20, width: 40, height: 20, content: 'b' })

    const wrapper = mount(OpenPagesRenderer, {
      props: {
        document: doc,
        pageId: page.id,
        selectedSectionIds: [a.id, b.id],
      },
      attachTo: document.body,
    })

    await wrapper.get('[data-op-renderer]').trigger('keydown', {
      key: 'ArrowRight',
      ctrlKey: false,
    })
    expect(a.x).toBe(10)

    await wrapper.get('[data-op-renderer]').trigger('keydown', {
      key: 'ArrowRight',
      ctrlKey: true,
      shiftKey: false,
    })
    expect(a.x).toBe(11)
    expect(b.x).toBe(21)

    await wrapper.get('[data-op-renderer]').trigger('keydown', {
      key: 'ArrowDown',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(a.y).toBe(20)
    expect(b.y).toBe(30)

    wrapper.unmount()
  })

  it('selection toolbar appears floating after a section is selected', async () => {
    const doc = createDocument({ title: 'T' })
    const page = doc.pages[0]
    if (!page) throw new Error('expected page')
    const section = addTextSection(page, {
      x: 10,
      y: 60,
      width: 120,
      height: 40,
      content: 'x',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })
    expect(wrapper.find('[data-op-toolbar="selection"] [data-op-toolbar-spacer]').exists()).toBe(
      false,
    )
    await wrapper.get(`[data-op-section="${section.id}"]`).trigger('pointerdown', { button: 0 })
    expect(wrapper.find('[data-op-selection-chrome] [data-op-toolbar-spacer]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('browser adapters call capturePng for real raster export', async () => {
    const capture = vi.fn().mockResolvedValue('data:image/png;base64,aaa')
    vi.resetModules()
    // exercised via createBrowserExportAdapters with injected capture
    const { createBrowserExportAdapters } = await import('../src/export/exporters')
    const adapters = createBrowserExportAdapters({ capturePng: capture })
    const el = document.createElement('div')
    const png = await adapters.toPng?.(el)
    expect(capture).toHaveBeenCalledWith(el)
    expect(png).toBe('data:image/png;base64,aaa')
  })
})
