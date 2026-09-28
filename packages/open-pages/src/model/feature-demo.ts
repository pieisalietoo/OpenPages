import { createDocument, type OpenPagesDocument } from './document'
import { addHeadlineSection, addImageSection, addPanelSection, addTextSection } from './section'

/** Sample document for manual QA / demo of shipped section features. */
export function createFeatureDemoDocument(): OpenPagesDocument {
  const doc = createDocument({ title: 'Feature Lab' })
  const page = doc.pages[0]
  if (!page) {
    throw new Error('expected a page')
  }

  page.guides = [
    { id: 'guide_v', orientation: 'vertical', offset: 397 },
    { id: 'guide_h', orientation: 'horizontal', offset: 280 },
  ]

  addPanelSection(page, {
    x: 56,
    y: 56,
    width: 280,
    height: 200,
    borderStyle: 'ink',
  })

  addImageSection(page, {
    x: 72,
    y: 72,
    width: 248,
    height: 168,
    src: 'https://picsum.photos/seed/openpages/496/336',
    alt: 'Sample newspaper photograph',
    fit: 'cover',
  })

  addHeadlineSection(page, {
    x: 360,
    y: 56,
    width: 380,
    height: 72,
    content: 'OpenPages Feature Lab',
  })

  addTextSection(page, {
    x: 360,
    y: 148,
    width: 380,
    height: 160,
    content:
      'Click to select. Drag to move. Corner handle to resize. Arrow keys nudge 1px; Shift+Arrow nudges 10px.',
  })

  const locked = addTextSection(page, {
    x: 56,
    y: 290,
    width: 300,
    height: 64,
    content: 'This box is locked — select it, but it will not move.',
  })
  locked.locked = true

  const hidden = addTextSection(page, {
    x: 380,
    y: 340,
    width: 280,
    height: 48,
    content: 'This box is hidden (see inspector toggle).',
  })
  hidden.hidden = true

  return doc
}
