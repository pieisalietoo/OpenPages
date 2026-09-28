import { afterEach, describe, expect, it } from 'vitest'
import { createDocument, type OpenPagesDocument } from '../src/model/document'
import { createFeatureDemoDocument } from '../src/model/feature-demo'
import { createHtmlShowcaseDocument } from '../src/model/html-showcase-demo'
import { addTextSection } from '../src/model/section'
import {
  type MountedEdit,
  mountEditing,
  selectLineAt,
  selectWordAt,
} from './helpers/wysiwyg-harness'

/**
 * Regression net: word/line selection across showcase, feature, and multi-column
 * fixtures. Clicks use visual glyph coords (list-marker em gutter + measure).
 * Failures here mean caret/selection hit-testing drifted again.
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

const cases: Array<{
  name: string
  kind: 'word' | 'line'
  build: () => { doc: OpenPagesDocument; pageId: string; sectionId: string }
  needle: string
  word: string
  expectCopied: string | RegExp
}> = [
  // HTML Showcase (2-col)
  {
    name: 'showcase word: Lead',
    kind: 'word',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Lead paragraph',
    word: 'Lead',
    expectCopied: 'Lead',
  },
  {
    name: 'showcase word: bold',
    kind: 'word',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'bold',
    word: 'bold',
    expectCopied: 'bold',
  },
  {
    name: 'showcase word: Subheads',
    kind: 'word',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Subheads stay',
    word: 'Subheads',
    expectCopied: 'Subheads',
  },
  {
    name: 'showcase word: language (blockquote)',
    kind: 'word',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'language',
    word: 'language',
    expectCopied: 'language',
  },
  {
    name: 'showcase word: Unordered two',
    kind: 'word',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Unordered item two',
    word: 'two',
    expectCopied: 'two',
  },
  {
    name: 'showcase word: Ordered two',
    kind: 'word',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Ordered item two',
    word: 'two',
    expectCopied: 'two',
  },
  {
    name: 'showcase word: Closing',
    kind: 'word',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Closing paragraph',
    word: 'Closing',
    expectCopied: 'Closing',
  },
  {
    name: 'showcase word: flow',
    kind: 'word',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'body flow',
    word: 'flow',
    expectCopied: 'flow',
  },
  {
    name: 'showcase line: Heading three',
    kind: 'line',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Heading three',
    word: 'Heading',
    expectCopied: /Heading three/,
  },
  {
    name: 'showcase line: Closing paragraph start',
    kind: 'line',
    build: () => {
      const doc = createHtmlShowcaseDocument()
      const { page, section } = bodyText(doc)
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Closing paragraph',
    word: 'Closing',
    expectCopied: /Closing/,
  },
  // Feature lab
  {
    name: 'feature word: Click',
    kind: 'word',
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
    expectCopied: 'Click',
  },
  {
    name: 'feature word: resize',
    kind: 'word',
    build: () => {
      const doc = createFeatureDemoDocument()
      const page = doc.pages[0]!
      const section = page.sections.find(
        (s) => s.type === 'text' && s.content.includes('Click to select'),
      )!
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'resize',
    word: 'resize',
    expectCopied: 'resize',
  },
  {
    name: 'feature headline word: OpenPages',
    kind: 'word',
    build: () => {
      const doc = createFeatureDemoDocument()
      const page = doc.pages[0]!
      const section = page.sections.find(
        (s) => s.type === 'headline' && s.content.includes('OpenPages'),
      )!
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'OpenPages',
    word: 'OpenPages',
    expectCopied: 'OpenPages',
  },
  // Multi-column plain fixtures
  {
    name: '1-col word: alpha',
    kind: 'word',
    build: () => {
      const { doc, page, section } = plainDoc('Sel1', 'alpha bravo charlie delta echo foxtrot', {
        columns: 1,
        width: 360,
      })
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'alpha',
    word: 'alpha',
    expectCopied: 'alpha',
  },
  {
    name: '2-col word: foxtrot',
    kind: 'word',
    build: () => {
      const { doc, page, section } = plainDoc(
        'Sel2',
        'alpha bravo charlie delta echo foxtrot golf hotel india juliet',
        { columns: 2, width: 280, height: 160 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'foxtrot',
    word: 'foxtrot',
    expectCopied: 'foxtrot',
  },
  {
    name: '3-col word: hotel',
    kind: 'word',
    build: () => {
      const { doc, page, section } = plainDoc(
        'Sel3',
        'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima',
        { columns: 3, width: 360, height: 180 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'hotel',
    word: 'hotel',
    expectCopied: 'hotel',
  },
  {
    name: '4-col word: kilo',
    kind: 'word',
    build: () => {
      const { doc, page, section } = plainDoc(
        'Sel4',
        'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar',
        { columns: 4, width: 480, height: 200 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'kilo',
    word: 'kilo',
    expectCopied: 'kilo',
  },
  {
    name: 'newspaper-like 4-col word: printers',
    kind: 'word',
    build: () => {
      const { doc, page, section } = plainDoc(
        'NewsSel',
        '<h3>Late edition</h3><p>City hall convened as printers inked the morning edition for press.</p><p>Merchants on Market Street reported brisk trade despite drizzle.</p>',
        { columns: 4, width: 520, height: 240, fontSize: 13 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'printers',
    word: 'printers',
    expectCopied: 'printers',
  },
  {
    name: 'newspaper-like 4-col line: Late edition',
    kind: 'line',
    build: () => {
      const { doc, page, section } = plainDoc(
        'NewsLine',
        '<h3>Late edition</h3><p>City hall convened an extraordinary session.</p>',
        { columns: 4, width: 520, height: 200, fontSize: 13 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'Late edition',
    word: 'Late',
    expectCopied: /Late edition/,
  },
  {
    name: '2-col line: full first visible line with alpha',
    kind: 'line',
    build: () => {
      const { doc, page, section } = plainDoc(
        'SelLine2',
        'alpha bravo charlie delta echo foxtrot golf hotel',
        { columns: 2, width: 260, height: 140 },
      )
      return { doc, pageId: page.id, sectionId: section.id }
    },
    needle: 'alpha',
    word: 'alpha',
    expectCopied: /alpha/,
  },
]

describe('WYSIWYG selection regression (20 cases across layouts)', () => {
  let mounted: MountedEdit | null = null

  afterEach(() => {
    mounted?.wrapper.unmount()
    mounted = null
  })

  it.each(cases)('$name', async (c) => {
    const { doc, pageId, sectionId } = c.build()
    mounted = await mountEditing(doc, pageId, sectionId)
    const copied =
      c.kind === 'word'
        ? await selectWordAt(mounted, c.needle, c.word)
        : await selectLineAt(mounted, c.needle, c.word)
    if (typeof c.expectCopied === 'string') {
      expect(copied).toBe(c.expectCopied)
    } else {
      expect(copied).toMatch(c.expectCopied)
    }
  })
})
