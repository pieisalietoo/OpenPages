import { afterEach, describe, expect, it } from 'vitest'
import { createDocument, type OpenPagesDocument } from '../src/model/document'
import { createFeatureDemoDocument } from '../src/model/feature-demo'
import { createHtmlShowcaseDocument } from '../src/model/html-showcase-demo'
import { addTextSection, type HeadlineSection, type TextSection } from '../src/model/section'
import { plainTextOf } from '../src/model/text-edit/plain-offset'
import {
  clickType,
  expectedInsertSlot,
  type MountedEdit,
  mountEditing,
} from './helpers/wysiwyg-harness'

/**
 * Regression net: click-to-caret + type inserts at the glyph under the pointer.
 * Clicks use visual glyph coords (list-marker em gutter + measure). Assertions
 * require the exact insert slot (word[:into]+key+word[into:]) — never match the
 * pristine word.
 */

function bodyText(doc: OpenPagesDocument) {
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  const section = page.sections.find((s) => s.type === 'text')
  if (!section) throw new Error('expected text section')
  return { page, section }
}

function plainDoc(
  title: string,
  content: string,
  opts?: { columns?: number; width?: number; height?: number; fontSize?: number },
) {
  const doc = createDocument({ title })
  const page = doc.pages[0]
  if (!page) throw new Error('expected page')
  const section = addTextSection(page, {
    x: 0,
    y: 0,
    width: opts?.width ?? 420,
    height: opts?.height ?? 280,
    content,
  })
  section.columnCount = opts?.columns ?? 1
  section.fontSize = opts?.fontSize ?? 14
  section.lineHeight = 1.35
  section.textFit = 'none'
  section.fontFamily = 'Georgia, serif'
  return { doc, page, section }
}

function sectionOf(doc: OpenPagesDocument, sectionId: string): TextSection | HeadlineSection {
  for (const page of doc.pages) {
    const s = page.sections.find((x) => x.id === sectionId)
    if (s && (s.type === 'text' || s.type === 'headline')) return s
  }
  throw new Error(`text section ${sectionId} not found`)
}

const cases: Array<{
  name: string
  build: () => { doc: OpenPagesDocument; pageId: string; sectionId: string }
  needle: string
  word: string
  key: string
  notPlain?: RegExp
}> = [
  {
    name: 'showcase insert in Lead',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Lead paragraph',
    word: 'Lead',
    key: 'Q',
    notPlain: /^Q|Heading oneQ/,
  },
  {
    name: 'showcase insert in bold',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'bold',
    word: 'bold',
    key: 'Z',
  },
  {
    name: 'showcase insert in Subheads',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Subheads stay',
    word: 'Subheads',
    key: 'Y',
  },
  {
    name: 'showcase insert in language',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'language',
    word: 'language',
    key: 'K',
  },
  {
    name: 'showcase insert in Unordered item two',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Unordered item two',
    word: 'two',
    key: 'J',
  },
  {
    name: 'showcase insert in Ordered item two',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Ordered item two',
    word: 'two',
    key: 'H',
  },
  {
    name: 'showcase insert in Closing',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Closing paragraph',
    word: 'Closing',
    key: 'G',
  },
  {
    name: 'showcase insert in flow',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'body flow',
    word: 'flow',
    key: 'F',
    notPlain: /showF|Fflow/,
  },
  {
    name: 'showcase insert in Heading three',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Heading three',
    word: 'three',
    key: 'T',
  },
  {
    name: 'showcase insert in epigraphs',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'epigraphs',
    word: 'epigraphs',
    key: 'E',
  },
  {
    name: 'feature insert in Click',
    build: () => {
      const doc = createFeatureDemoDocument()
      const page = doc.pages[0]!
      const section = page.sections.find(
        (s) => s.type === 'text' && s.content.includes('Click to select'),
      )!
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Click to select',
    word: 'Click',
    key: 'W',
  },
  {
    name: 'feature insert in nudge',
    build: () => {
      const doc = createFeatureDemoDocument()
      const page = doc.pages[0]!
      const section = page.sections.find((s) => s.type === 'text' && s.content.includes('nudge'))!
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'nudge',
    word: 'nudge',
    key: 'V',
  },
  {
    name: 'feature headline insert in Feature',
    build: () => {
      const doc = createFeatureDemoDocument()
      const page = doc.pages[0]!
      const section = page.sections.find(
        (s) => s.type === 'headline' && s.content.includes('Feature'),
      )!
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Feature',
    word: 'Feature',
    key: 'U',
  },
  {
    name: '1-col insert in bravo',
    build: () => {
      const { doc, page, section } = plainDoc('Ins1', 'alpha bravo charlie delta')
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'bravo',
    word: 'bravo',
    key: 'X',
    notPlain: /aXnd|Xbravo|alphaX/,
  },
  {
    name: '2-col insert in echo',
    build: () => {
      const { doc, page, section } = plainDoc(
        'Ins2',
        'alpha bravo charlie delta echo foxtrot golf hotel india',
        { columns: 2, width: 280, height: 160 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'echo',
    word: 'echo',
    key: 'X',
  },
  {
    name: '3-col insert in golf',
    build: () => {
      const { doc, page, section } = plainDoc(
        'Ins3',
        'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo',
        { columns: 3, width: 360, height: 180 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'golf',
    word: 'golf',
    key: 'X',
  },
  {
    name: '4-col insert in india',
    build: () => {
      const { doc, page, section } = plainDoc(
        'Ins4',
        'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike',
        { columns: 4, width: 480, height: 200 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'india',
    word: 'india',
    key: 'X',
  },
  {
    name: 'newspaper-like insert in printers',
    build: () => {
      const { doc, page, section } = plainDoc(
        'NewsIns',
        '<h3>Late edition</h3><p>City hall convened as printers inked the morning edition for press.</p><p>Merchants on Market Street reported brisk trade.</p>',
        { columns: 4, width: 520, height: 240, fontSize: 13 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'printers',
    word: 'printers',
    key: 'X',
    notPlain: /CityX|Xprinters/,
  },
  {
    name: 'newspaper-like insert in Merchants',
    build: () => {
      const { doc, page, section } = plainDoc(
        'NewsIns2',
        '<h3>Market pulse</h3><p>Merchants on Market Street reported brisk trade despite drizzle on awnings.</p>',
        { columns: 3, width: 420, height: 200, fontSize: 13 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Merchants',
    word: 'Merchants',
    key: 'X',
  },
  {
    name: '2-col heading insert in Evening',
    build: () => {
      const { doc, page, section } = plainDoc(
        'EveIns',
        '<h3 data-op-keep-with-next="2">Evening press</h3><p>At the corner cafe the room grew quiet.</p>',
        { columns: 2, width: 360, height: 180 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Evening press',
    word: 'Evening',
    key: 'X',
    notPlain: /XEvening|pressX cafe/,
  },
]

describe('WYSIWYG insert-position regression (20 cases across layouts)', () => {
  let mounted: MountedEdit | null = null

  afterEach(() => {
    mounted?.wrapper.unmount()
    mounted = null
  })

  it.each(cases)('$name', async (c) => {
    const { doc, pageId, sectionId } = c.build()
    mounted = await mountEditing(doc, pageId, sectionId)
    await clickType(mounted, c.needle, c.word, c.key)
    const plain = plainTextOf(sectionOf(doc, sectionId).content)
    const slot = expectedInsertSlot(c.word, c.key)
    expect(plain, `expected exact slot ${JSON.stringify(slot)}`).toContain(slot)
    if (c.notPlain) expect(plain).not.toMatch(c.notPlain)
  })
})
