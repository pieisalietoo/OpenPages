import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OpenPagesEditor from '../src/components/OpenPagesEditor.vue'
import { createDocument } from '../src/model/document'
import {
  addImageSection,
  addTextSection,
  type Section,
  updateImageSection,
} from '../src/model/section'
import { visibleSelectionTools } from '../src/tooling/selection-tools'
import { DEFAULT_SELECTION_TOOLBAR } from '../src/tooling/toolbar-order'
import { createToolController } from '../src/tooling/tools'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  return page
}

function imageStub(id: string): Section {
  return {
    id,
    type: 'image',
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    src: 'https://example.com/old.png',
    alt: 'Old',
    fit: 'cover',
    contentOffsetX: 0,
    contentOffsetY: 0,
    contentScale: 1,
    locked: false,
    hidden: false,
    runaround: false,
    runaroundMargins: { left: 0, right: 0, top: 0, bottom: 0 },
    groupId: null,
    backgroundColor: 'transparent',
    color: '#1a1a1a',
    borderColor: 'transparent',
    borderWidth: 0,
  }
}

describe('image settings tool + updateImageSection', () => {
  it('updateImageSection patches src, alt, and fit on image sections only', () => {
    const page = firstPage(createDocument({ title: 'Img' }))
    const image = addImageSection(page, {
      x: 0,
      y: 0,
      width: 120,
      height: 90,
      src: 'https://example.com/a.png',
      alt: 'A',
      fit: 'cover',
    })
    const text = addTextSection(page, {
      x: 0,
      y: 100,
      width: 80,
      height: 40,
      content: 't',
    })

    expect(
      updateImageSection(page, image.id, {
        src: 'https://example.com/b.png',
        alt: 'B',
        fit: 'contain',
      }),
    ).toBe(true)
    expect(image).toMatchObject({
      src: 'https://example.com/b.png',
      alt: 'B',
      fit: 'contain',
    })
    expect(updateImageSection(page, text.id, { src: 'https://nope' })).toBe(false)
  })

  it('shows section.image only for a single selected image', () => {
    const tools = createToolController()
    const forImage = visibleSelectionTools(tools.list('selection'), [imageStub('i')]).map(
      (t) => t.id,
    )
    expect(forImage).toContain('section.image')

    const forText = visibleSelectionTools(tools.list('selection'), [
      {
        ...imageStub('t'),
        id: 't',
        type: 'text',
        content: 'x',
        htmlMode: false,
        fontFamily: 'Georgia, serif',
        fontSize: 16,
        fontBold: false,
        fontItalic: false,
        fontUnderline: false,
        fontStrike: false,
        columnCount: 1,
        lineHeight: 1.4,
        textFit: 'none' as const,
        textAlign: 'left' as const,
        verticalAlign: 'top' as const,
      },
    ]).map((t) => t.id)
    expect(forText).not.toContain('section.image')

    const multi = visibleSelectionTools(tools.list('selection'), [
      imageStub('a'),
      imageStub('b'),
    ]).map((t) => t.id)
    expect(multi).not.toContain('section.image')
  })

  it('lists section.image in the default selection toolbar order', () => {
    expect(DEFAULT_SELECTION_TOOLBAR).toContain('section.image')
  })

  it('opens image settings popover and applies a URL', async () => {
    const doc = createDocument({ title: 'ImgUi' })
    const page = firstPage(doc)
    const image = addImageSection(page, {
      x: 20,
      y: 20,
      width: 160,
      height: 120,
      src: 'https://example.com/old.png',
      alt: 'Old',
      fit: 'cover',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${image.id}"]`).trigger('pointerdown', { button: 0 })
    expect(wrapper.find('[data-op-tool="section.image"]').exists()).toBe(true)

    await wrapper.get('[data-op-tool="section.image"]').trigger('click')
    expect(wrapper.find('[data-op-popover="section.image"]').exists()).toBe(true)

    const urlInput = wrapper.get('[data-op-image-src]')
    await urlInput.setValue('https://example.com/new.png')
    await wrapper.get('[data-op-image-apply-url]').trigger('click')
    expect(image.src).toBe('https://example.com/new.png')

    wrapper.unmount()
  })

  it('uploads a local image file from the settings popover', async () => {
    const doc = createDocument({ title: 'ImgUpload' })
    const page = firstPage(doc)
    const image = addImageSection(page, {
      x: 20,
      y: 20,
      width: 160,
      height: 120,
      src: '',
      alt: 'Empty',
      fit: 'cover',
    })
    const wrapper = mount(OpenPagesEditor, {
      props: { modelValue: doc },
      attachTo: document.body,
    })

    await wrapper.get(`[data-op-section="${image.id}"]`).trigger('pointerdown', { button: 0 })
    await wrapper.get('[data-op-tool="section.image"]').trigger('click')

    const file = new File([Uint8Array.from([137, 80, 78, 71])], 'local.png', {
      type: 'image/png',
    })
    const input = wrapper.get('[data-op-image-file]').element as HTMLInputElement
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: {
        0: file,
        length: 1,
        item: (i: number) => (i === 0 ? file : null),
      },
    })
    await wrapper.get('[data-op-image-file]').trigger('change')
    await flushPromises()
    await vi.waitFor(() => {
      expect(image.src.startsWith('data:image/png')).toBe(true)
    })
    expect(image.alt).toBe('local.png')
    expect(doc.assets.some((a) => a.src === image.src)).toBe(true)

    wrapper.unmount()
  })
})
