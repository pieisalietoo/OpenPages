import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OpenPagesRenderer from '../src/components/OpenPagesRenderer.vue'
import { createDocument, parseDocument, serializeDocument } from '../src/model/document'
import {
  addBalloonSection,
  addBylineSection,
  addFolioSection,
  addPullQuoteSection,
  addRuleSection,
} from '../src/model/section'

function firstPage(doc: ReturnType<typeof createDocument>) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')
  return page
}

describe('B4 section types batch 2', () => {
  it('adds balloon, pull-quote, byline, rule, and folio sections', () => {
    const page = firstPage(createDocument({ title: 'B4' }))
    const balloon = addBalloonSection(page, {
      x: 40,
      y: 40,
      width: 160,
      height: 80,
      content: 'Hello!',
      balloonStyle: 'speech',
      tailX: 40,
      tailY: 90,
    })
    const quote = addPullQuoteSection(page, {
      x: 40,
      y: 140,
      width: 200,
      height: 60,
      content: 'A notable line',
    })
    const byline = addBylineSection(page, {
      x: 40,
      y: 220,
      width: 180,
      height: 24,
      content: 'By Ada',
    })
    const rule = addRuleSection(page, {
      x: 40,
      y: 260,
      width: 240,
      height: 4,
    })
    const folio = addFolioSection(page, {
      x: 40,
      y: 280,
      width: 40,
      height: 20,
      content: '1',
    })

    expect(balloon).toMatchObject({
      type: 'balloon',
      content: 'Hello!',
      balloonStyle: 'speech',
      tailX: 40,
      tailY: 90,
    })
    expect(quote.type).toBe('pull-quote')
    expect(byline.type).toBe('byline')
    expect(rule.type).toBe('rule')
    expect(folio).toMatchObject({ type: 'folio', content: '1' })
    expect(page.sections).toHaveLength(5)
  })

  it('round-trips B4 section types', () => {
    const doc = createDocument({ title: 'B4 mix' })
    const page = firstPage(doc)
    addBalloonSection(page, {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      content: 'hi',
      balloonStyle: 'thought',
      tailX: 5,
      tailY: 12,
    })
    addPullQuoteSection(page, { x: 0, y: 20, width: 10, height: 10, content: 'q' })
    addBylineSection(page, { x: 0, y: 40, width: 10, height: 10, content: 'b' })
    addRuleSection(page, { x: 0, y: 60, width: 10, height: 2 })
    addFolioSection(page, { x: 0, y: 70, width: 10, height: 10, content: '2' })

    const parsed = parseDocument(serializeDocument(doc))
    expect(firstPage(parsed).sections.map((s) => s.type)).toEqual([
      'balloon',
      'pull-quote',
      'byline',
      'rule',
      'folio',
    ])
    const balloon = firstPage(parsed).sections[0]
    expect(balloon).toMatchObject({
      type: 'balloon',
      balloonStyle: 'thought',
      tailX: 5,
      tailY: 12,
    })
  })

  it('renderer paints balloon chrome and other B4 types', () => {
    const doc = createDocument({ title: 'B4 render' })
    const page = firstPage(doc)
    const balloon = addBalloonSection(page, {
      x: 10,
      y: 10,
      width: 120,
      height: 60,
      content: 'Pow',
      balloonStyle: 'speech',
      tailX: 30,
      tailY: 70,
    })
    const quote = addPullQuoteSection(page, {
      x: 10,
      y: 90,
      width: 120,
      height: 40,
      content: 'Quote',
    })
    const byline = addBylineSection(page, {
      x: 10,
      y: 140,
      width: 100,
      height: 20,
      content: 'Byline',
    })
    const rule = addRuleSection(page, { x: 10, y: 170, width: 100, height: 3 })
    const folio = addFolioSection(page, {
      x: 10,
      y: 180,
      width: 30,
      height: 16,
      content: '3',
    })

    const wrapper = mount(OpenPagesRenderer, {
      props: { document: doc, pageId: page.id },
    })

    expect(wrapper.get(`[data-op-section="${balloon.id}"]`).text()).toContain('Pow')
    expect(wrapper.get(`[data-op-section="${balloon.id}"]`).attributes('data-balloon-style')).toBe(
      'speech',
    )
    expect(wrapper.get(`[data-op-section="${quote.id}"]`).classes()).toContain(
      'op-section--pull-quote',
    )
    expect(wrapper.get(`[data-op-section="${byline.id}"]`).text()).toContain('Byline')
    expect(wrapper.get(`[data-op-section="${rule.id}"]`).classes()).toContain('op-section--rule')
    expect(wrapper.get(`[data-op-section="${folio.id}"]`).text()).toContain('3')
  })
})
