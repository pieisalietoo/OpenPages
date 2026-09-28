import { createDocument, type OpenPagesDocument } from './document'
import type { OpenPagesFont } from './fonts'
import { addHeadlineSection, addTextSection } from './section'

/** Sample custom face used by the demo “Custom fonts” tab (loaded via `source`). */
export const DEMO_CUSTOM_FONTS: OpenPagesFont[] = [
  {
    id: 'literata',
    label: 'Literata',
    family: "'Literata', Georgia, serif",
    faceName: 'Literata',
    source: 'https://cdn.jsdelivr.net/fontsource/fonts/literata@5.2.5/latin-400-normal.woff2',
    weight: 400,
    style: 'normal',
  },
  {
    id: 'literata-bold',
    label: 'Literata Bold',
    family: "'Literata', Georgia, serif",
    faceName: 'Literata',
    source: 'https://cdn.jsdelivr.net/fontsource/fonts/literata@5.2.5/latin-700-normal.woff2',
    weight: 700,
    style: 'normal',
  },
]

/** Page that uses a host-loaded custom family after `loadOpenPagesFonts`. */
export function createCustomFontsDemoDocument(): OpenPagesDocument {
  const doc = createDocument({ title: 'Custom fonts' })
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')

  const left = page.margins.left
  const right = page.margins.right
  const top = page.margins.top
  const contentWidth = page.width - left - right

  const headline = addHeadlineSection(page, {
    x: left,
    y: top,
    width: contentWidth,
    height: 56,
    content: 'Custom webfont sample',
  })
  headline.fontFamily = "'Literata', Georgia, serif"
  headline.fontBold = true

  const body = addTextSection(page, {
    x: left,
    y: top + 72,
    width: contentWidth,
    height: 280,
    content:
      '<p>This block uses <b>Literata</b> loaded at runtime with <code>loadOpenPagesFonts</code> and passed through the <code>fonts</code> prop on <code>OpenPagesEditor</code>.</p><p>Edit the text and open the family menu to pick Literata alongside the built-in stacks.</p>',
  })
  body.fontFamily = "'Literata', Georgia, serif"
  body.fontSize = 16
  body.lineHeight = 1.45
  body.columnCount = 2
  body.textFit = 'none'

  return doc
}
