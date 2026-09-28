import { createDocument, type OpenPagesDocument } from './document'
import { BUILTIN_FONTS } from './fonts'
import { addHeadlineSection, addTextSection } from './section'

/** One line per built-in family so the chrome select and layout metrics are easy to compare. */
export function createFontsDemoDocument(): OpenPagesDocument {
  const doc = createDocument({ title: 'Fonts' })
  const page = doc.pages[0]
  if (!page) throw new Error('expected a page')

  const left = page.margins.left
  const right = page.margins.right
  const top = page.margins.top
  const contentWidth = page.width - left - right

  addHeadlineSection(page, {
    x: left,
    y: top,
    width: contentWidth,
    height: 48,
    content: 'Built-in font catalog',
  })

  let y = top + 64
  for (const font of BUILTIN_FONTS) {
    const row = addTextSection(page, {
      x: left,
      y,
      width: contentWidth,
      height: 40,
      content: `${font.label} — The quick brown fox jumps over the lazy dog.`,
    })
    row.fontFamily = font.family
    row.fontSize = 18
    row.lineHeight = 1.25
    row.textFit = 'none'
    y += 48
  }

  return doc
}
