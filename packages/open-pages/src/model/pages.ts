import type { OpenPagesDocument, Page } from './document'
import { createDefaultPageGeometry } from './page'
import type { Section } from './section'

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

function pageName(doc: OpenPagesDocument): string {
  return `Page ${doc.pages.length + 1}`
}

function clonePage(source: Page, name: string): Page {
  const copy = JSON.parse(JSON.stringify(source)) as Page
  const groups = new Map<string, string>()
  copy.id = newId('page')
  copy.name = name
  copy.guides = copy.guides.map((guide) => ({ ...guide, id: newId('guide') }))
  copy.sections = copy.sections.map((section) => remapSection(section, groups))
  return copy
}

function remapSection(section: Section, groups: Map<string, string>): Section {
  const next = { ...section, id: newId('sec') }
  if (next.groupId) {
    const mapped = groups.get(next.groupId) ?? newId('group')
    groups.set(next.groupId, mapped)
    next.groupId = mapped
  }
  return next
}

export function addBlankPage(doc: OpenPagesDocument, afterIndex: number): Page {
  const source = doc.pages[afterIndex]
  const geometry = source
    ? {
        width: source.width,
        height: source.height,
        margins: { ...source.margins },
        orientation: source.orientation,
        preset: source.preset,
      }
    : createDefaultPageGeometry('a4')
  const page: Page = {
    id: newId('page'),
    name: pageName(doc),
    guides: [],
    sections: [],
    ...geometry,
  }
  doc.pages.splice(source ? afterIndex + 1 : doc.pages.length, 0, page)
  return page
}

export function duplicatePage(doc: OpenPagesDocument, index: number): Page | undefined {
  const source = doc.pages[index]
  if (!source) return undefined
  const copy = clonePage(source, pageName(doc))
  doc.pages.splice(index + 1, 0, copy)
  return copy
}

export function deletePage(doc: OpenPagesDocument, index: number): boolean {
  if (doc.pages.length <= 1) return false
  if (index < 0 || index >= doc.pages.length) return false
  doc.pages.splice(index, 1)
  return true
}

export function movePage(doc: OpenPagesDocument, fromIndex: number, toIndex: number): boolean {
  if (fromIndex === toIndex) return false
  if (fromIndex < 0 || fromIndex >= doc.pages.length) return false
  if (toIndex < 0 || toIndex >= doc.pages.length) return false
  const [page] = doc.pages.splice(fromIndex, 1)
  if (!page) return false
  doc.pages.splice(toIndex, 0, page)
  return true
}
