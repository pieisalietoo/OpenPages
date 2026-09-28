import { createDocument, type OpenPagesDocument } from './document'
import { addHeadlineSection, addRunaroundSection, addTextSection } from './section'

const BODY_PARAS = [
  'City hall convened an extraordinary session as printers inked the morning edition.',
  'Reporters filled the gallery while typesetters locked the late columns for press.',
  'Merchants on Market Street reported brisk trade despite the drizzle that clung to awnings.',
  'Across the river, ferry captains timed their crossings to the factory whistle.',
  'In the theater district, a matinee crowd spilled onto the curb between acts.',
  'Editors debated the lead photograph as the wire brought word from the capital.',
  'A brass band rehearsed in the park bandstand, scattering pigeons into the oaks.',
  'Schoolchildren traced the headlines with chalk on the sidewalk before the noon bell.',
  'Dockworkers stacked crates of citrus beside a crate stamped for the inland rail.',
  'At the corner cafe, the room grew quiet when the evening paper arrived damp from the press.',
  'Clerks exchanged the midday edition for stacks still warm from the cylinder.',
  'Along the quay, gulls traced lazy circles above barges bound for the upriver mills.',
]
const BODY_COPY = [
  '<h3 data-op-keep-with-next="2">Late edition</h3>',
  `<p>${BODY_PARAS.slice(0, 3).join(' ')}</p>`,
  '<h3 data-op-keep-with-next="2">Market pulse</h3>',
  `<p>${BODY_PARAS.slice(3, 6).join(' ')}</p>`,
  '<h3 data-op-keep-with-next="2">Across the river</h3>',
  `<p>${BODY_PARAS.slice(6, 9).join(' ')}</p>`,
  '<h3 data-op-keep-with-next="2">Evening press</h3>',
  `<p>${BODY_PARAS.slice(9).join(' ')} ${BODY_PARAS.join(' ')}</p>`,
].join('')

/** Sample broadsheet-style page: masthead, 4-column body, mid-page runaround wells. */
export function createNewspaperDemoDocument(): OpenPagesDocument {
  const doc = createDocument({ title: 'Newspaper' })
  const page = doc.pages[0]
  if (!page) {
    throw new Error('expected a page')
  }

  const left = page.margins.left
  const right = page.margins.right
  const top = page.margins.top
  const bottom = page.margins.bottom
  const contentWidth = page.width - left - right
  const contentBottom = page.height - bottom

  const mastheadHeight = 96
  addHeadlineSection(page, {
    x: left,
    y: top,
    width: contentWidth,
    height: mastheadHeight,
    content: 'The OpenPages Gazette',
  })

  const bodyY = top + mastheadHeight + 16
  const body = addTextSection(page, {
    x: left,
    y: bodyY,
    width: contentWidth,
    height: contentBottom - bodyY,
    content: BODY_COPY,
  })
  body.columnCount = 4
  body.fontSize = 14
  body.lineHeight = 1.35
  body.textFit = 'fill'

  const wellW = Math.round(contentWidth * 0.28)
  const wellH = 168
  addRunaroundSection(page, {
    x: left + Math.round(contentWidth * 0.22),
    y: bodyY + 120,
    width: wellW,
    height: wellH,
  })
  addRunaroundSection(page, {
    x: left + Math.round(contentWidth * 0.58),
    y: bodyY + 340,
    width: wellW,
    height: wellH,
  })

  return doc
}
