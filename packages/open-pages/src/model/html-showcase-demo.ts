import { createDocument, type OpenPagesDocument } from './document'
import { addHeadlineSection, addTextSection } from './section'

const SHOWCASE_HTML = [
  '<h1 data-op-keep-with-next="2">Heading one</h1>',
  '<p>Lead paragraph under the page title, set in the body face.</p>',
  '<h2 data-op-keep-with-next="2">Heading two</h2>',
  '<p>Section intro with <b>bold</b>, <i>italic</i>, and <u>underline</u> inline marks.</p>',
  '<h3 data-op-keep-with-next="2">Heading three</h3>',
  '<p>Subheads stay with the next lines so they never sit alone at a column foot.</p>',
  '<h4>Heading four</h4>',
  '<h5>Heading five</h5>',
  '<h6>Heading six</h6>',
  '<blockquote>A short block quote in italic, for pull language or epigraphs.</blockquote>',
  '<ul><li>Unordered item one</li><li>Unordered item two</li></ul>',
  '<ol><li>Ordered item one</li><li>Ordered item two</li></ol>',
  '<p>Mixed sizes keep <span style="font-size: 14px">alpha</span> beside <span style="font-size: 22px">bravo</span> and <span style="font-size: 11px">charlie</span> on one line.</p>',
  '<p>Closing paragraph after lists to show body flow resumes at the base size.</p>',
].join('')

/** Demo page that exercises standard HTML blocks in the text layout engine. */
export function createHtmlShowcaseDocument(): OpenPagesDocument {
  const doc = createDocument({ title: 'HTML Showcase' })
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')

  const left = page.margins.left
  const right = page.margins.right
  const top = page.margins.top
  const bottom = page.margins.bottom
  const contentWidth = page.width - left - right

  addHeadlineSection(page, {
    x: left,
    y: top,
    width: contentWidth,
    height: 56,
    content: 'HTML element showcase',
  })

  const bodyY = top + 72
  const body = addTextSection(page, {
    x: left,
    y: bodyY,
    width: contentWidth,
    height: page.height - bottom - bodyY,
    content: SHOWCASE_HTML,
  })
  body.columnCount = 2
  body.fontSize = 14
  body.lineHeight = 1.35
  body.textFit = 'none'

  return doc
}
