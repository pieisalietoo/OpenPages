import { describe, expect, it } from 'vitest'
import { createHtmlShowcaseDocument } from '../src/model/html-showcase-demo'
import { sanitizeTextHtml } from '../src/model/sanitize-html'
import { htmlToPlainText } from '../src/model/text-layout/html-text'
import { layoutTextFrame } from '../src/model/text-layout/layout'
import { createFixedMeasurer } from '../src/model/text-layout/measure'

const STYLE_RE = /\uE010([a-z0-9]+)\uE011/

describe('rich HTML block styles in layout', () => {
  it('sanitize keeps headings, lists, and blockquote', () => {
    const cleaned = sanitizeTextHtml(
      '<h3>Title</h3><ul><li>One</li></ul><ol><li>Two</li></ol><blockquote>Quote</blockquote>',
    )
    expect(cleaned).toMatch(/<h3>Title<\/h3>/i)
    expect(cleaned).toMatch(/<ul>/i)
    expect(cleaned).toMatch(/<li>One<\/li>/i)
    expect(cleaned).toMatch(/<ol>/i)
    expect(cleaned).toMatch(/<blockquote>Quote<\/blockquote>/i)
  })

  it('htmlToPlainText embeds a style marker for h3', () => {
    const plain = htmlToPlainText('<h3>Late edition</h3><p>Body.</p>')
    expect(plain.match(STYLE_RE)?.[1]).toBe('h3')
    expect(plain).toContain('Late edition')
  })

  it('lays out h3 larger and bold versus following body', () => {
    const measure = createFixedMeasurer(0.5)
    const text = htmlToPlainText(
      '<h3>Late edition</h3><p>Reporters filled the gallery with more words for wrap.</p>',
    )
    const result = layoutTextFrame({
      text,
      host: { x: 0, y: 0, width: 280, height: 200 },
      columnCount: 1,
      columnGap: 16,
      fontSize: 12,
      lineHeight: 1.4,
      exclusions: [],
      measure,
    })
    const title = result.lines.find((l) => l.text.includes('Late edition'))
    const body = result.lines.find((l) => l.text.includes('Reporters'))
    expect(title).toBeTruthy()
    expect(body).toBeTruthy()
    if (!title || !body) return
    expect(title.fontBold).toBe(true)
    expect(title.fontScale ?? 1).toBeGreaterThan(1)
    expect(body.fontScale ?? 1).toBe(1)
    expect(title.height).toBeGreaterThan(body.height)
  })
})

describe('HTML showcase demo layout', () => {
  it('builds a document showcasing standard HTML blocks', () => {
    const doc = createHtmlShowcaseDocument()
    expect(doc.meta.title).toBe('HTML Showcase')
    const page = doc.pages[0]
    expect(page).toBeTruthy()
    const body = page?.sections.find((s) => s.type === 'text')
    expect(body?.content).toMatch(/<h1\b/i)
    expect(body?.content).toMatch(/<h3\b/i)
    expect(body?.content).toMatch(/<ul>/i)
    expect(body?.content).toMatch(/<ol>/i)
    expect(body?.content).toMatch(/<blockquote>/i)
    expect(body?.content).toMatch(/font-size:\s*22px/i)
    expect(body?.content).toMatch(/\bbravo\b/)
    expect(body?.content).toMatch(/\bcharlie\b/)
  })
})
