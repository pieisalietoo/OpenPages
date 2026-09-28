import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument, parseDocument, serializeDocument } from '../src/model/document'
import {
  addHeadlineSection,
  addImageSection,
  addPanelSection,
  addTextSection,
} from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

describe('B3 section types batch 1', () => {
  it('adds headline, image, and panel sections', () => {
    const page = firstPage(createDocument({ title: 'Types' }))
    const headline = addHeadlineSection(page, {
      x: 40,
      y: 40,
      width: 400,
      height: 64,
      content: 'Front Page',
    })
    const image = addImageSection(page, {
      x: 40,
      y: 120,
      width: 200,
      height: 160,
      src: 'https://example.com/art.png',
      alt: 'Cover art',
      fit: 'cover',
    })
    const panel = addPanelSection(page, {
      x: 260,
      y: 120,
      width: 180,
      height: 160,
      borderStyle: 'ink',
    })

    expect(headline.type).toBe('headline')
    expect(image).toMatchObject({ type: 'image', src: 'https://example.com/art.png', fit: 'cover' })
    expect(panel).toMatchObject({ type: 'panel', borderStyle: 'ink' })
    expect(page.sections).toHaveLength(3)
  })

  it('round-trips mixed section types', () => {
    const doc = createDocument({ title: 'Mix' })
    const page = firstPage(doc)
    addTextSection(page, { x: 0, y: 0, width: 10, height: 10, content: 'body' })
    addHeadlineSection(page, { x: 0, y: 20, width: 10, height: 10, content: 'hed' })
    addImageSection(page, {
      x: 0,
      y: 40,
      width: 10,
      height: 10,
      src: 'blob:1',
      alt: 'a',
      fit: 'contain',
    })
    addPanelSection(page, { x: 0, y: 60, width: 10, height: 10, borderStyle: 'double' })

    const parsed = parseDocument(serializeDocument(doc))
    expect(firstPage(parsed).sections.map((s) => s.type)).toEqual([
      'text',
      'headline',
      'image',
      'panel',
    ])
  })

  it('renderer paints headline text, image, and panel chrome', () => {
    const doc = createDocument({ title: 'Render' })
    const page = firstPage(doc)
    const headline = addHeadlineSection(page, {
      x: 20,
      y: 20,
      width: 300,
      height: 48,
      content: 'Extra',
    })
    const image = addImageSection(page, {
      x: 20,
      y: 80,
      width: 120,
      height: 90,
      src: 'https://example.com/p.png',
      alt: 'Photo',
      fit: 'cover',
    })
    const panel = addPanelSection(page, {
      x: 160,
      y: 80,
      width: 100,
      height: 90,
      borderStyle: 'rounded',
    })

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id },
    })

    expect(wrapper.get(`[data-op-section="${headline.id}"]`).text()).toContain('Extra')
    expect(wrapper.get(`[data-op-section="${headline.id}"]`).classes()).toContain(
      'op-section--headline',
    )
    const img = wrapper.get(`[data-op-section="${image.id}"] img`)
    expect(img.attributes('src')).toBe('https://example.com/p.png')
    expect(img.attributes('alt')).toBe('Photo')
    expect(wrapper.get(`[data-op-section="${panel.id}"]`).attributes('data-border-style')).toBe(
      'rounded',
    )
  })
})
