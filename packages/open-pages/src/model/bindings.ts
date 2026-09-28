import { createDocument, type OpenPagesDocument } from './document'
import { addHeadlineSection, addImageSection, addTextSection } from './section'

export type DocumentData = Record<string, string>

export function resolveTemplate(template: string, data: DocumentData): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => data[key] ?? '')
}

export interface DataBoundDefaults {
  imageUrl?: string
  bodyText?: string
  snippet?: string
}

/** Sample layout whose section fields reference {{imageUrl}}, {{bodyText}}, {{snippet}}. */
export function createDataBoundDocument(defaults: DataBoundDefaults = {}): OpenPagesDocument {
  const doc = createDocument({ title: 'Data Bound' })
  doc.data = {
    imageUrl: defaults.imageUrl ?? 'https://picsum.photos/seed/openpages-bind/480/320',
    bodyText: defaults.bodyText ?? 'Body copy comes from the model variable bodyText.',
    snippet: defaults.snippet ?? 'snippet',
  }

  const page = doc.pages[0]
  if (!page) {
    throw new Error('expected a page')
  }

  addHeadlineSection(page, {
    x: 48,
    y: 48,
    width: 500,
    height: 56,
    content: 'Data-bound layout',
  })

  addImageSection(page, {
    x: 48,
    y: 120,
    width: 280,
    height: 180,
    src: '{{imageUrl}}',
    alt: 'Bound image',
    fit: 'cover',
  })

  addTextSection(page, {
    x: 360,
    y: 120,
    width: 360,
    height: 120,
    content: '{{bodyText}}',
  })

  addTextSection(page, {
    x: 360,
    y: 260,
    width: 360,
    height: 80,
    content: 'This sentence includes a {{snippet}} from the model.',
  })

  return doc
}
