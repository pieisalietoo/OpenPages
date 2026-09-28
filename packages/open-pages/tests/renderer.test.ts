import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import {
  createDocument,
  type OpenPagesDocument,
  type Page,
  parseDocument,
  serializeDocument,
} from '../src/model/document'
import { applyPagePreset, PAGE_PRESETS } from '../src/model/page'

function firstPage(doc: OpenPagesDocument): Page {
  const page = doc.pages[0]
  if (!page) {
    throw new Error('expected a page')
  }
  return page
}

describe('A2 page size, margins, guides', () => {
  it('createDocument pages include default margins and empty guides', () => {
    const page = firstPage(createDocument({ title: 'Margins' }))

    expect(page.margins).toEqual({ top: 48, right: 48, bottom: 48, left: 48 })
    expect(page.guides).toEqual([])
    expect(page.orientation).toBe('portrait')
    expect(page.preset).toBe('a4')
  })

  it('PAGE_PRESETS expose A4, Letter, and Tabloid sizes', () => {
    expect(PAGE_PRESETS.a4).toMatchObject({ width: 794, height: 1123 })
    expect(PAGE_PRESETS.letter).toMatchObject({ width: 816, height: 1056 })
    expect(PAGE_PRESETS.tabloid).toMatchObject({ width: 1056, height: 1632 })
  })

  it('applyPagePreset updates page geometry and round-trips', () => {
    const doc = createDocument({ title: 'Letter' })
    applyPagePreset(firstPage(doc), 'letter')
    expect(firstPage(doc)).toMatchObject({
      preset: 'letter',
      width: 816,
      height: 1056,
      orientation: 'portrait',
    })

    const parsed = parseDocument(serializeDocument(doc))
    expect(firstPage(parsed)).toMatchObject({
      preset: 'letter',
      width: 816,
      height: 1056,
      margins: { top: 48, right: 48, bottom: 48, left: 48 },
    })
  })

  it('OpenPagesRenderer renders page box and margin guides', () => {
    const doc = createDocument({ title: 'Render' })
    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: firstPage(doc).id },
    })

    const pageEl = wrapper.get('[data-op-page]')
    expect(pageEl.attributes('style')).toContain('width: 794px')
    expect(pageEl.attributes('style')).toContain('height: 1123px')

    const margin = wrapper.get('[data-op-margin-guide]')
    expect(margin.attributes('style')).toContain('top: 48px')
    expect(margin.attributes('style')).toContain('right: 48px')
    expect(margin.attributes('style')).toContain('bottom: 48px')
    expect(margin.attributes('style')).toContain('left: 48px')
  })

  it('OpenPagesRenderer draws custom guides', () => {
    const doc = createDocument({ title: 'Guides' })
    firstPage(doc).guides = [
      { id: 'g1', orientation: 'vertical', offset: 120 },
      { id: 'g2', orientation: 'horizontal', offset: 200 },
    ]

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: firstPage(doc).id },
    })

    const guides = wrapper.findAll('[data-op-guide]')
    expect(guides).toHaveLength(2)
    expect(guides[0]?.attributes('data-orientation')).toBe('vertical')
    expect(guides[1]?.attributes('data-orientation')).toBe('horizontal')
  })
})
