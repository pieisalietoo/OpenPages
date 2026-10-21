import type { Section, SectionType } from './section'
import {
  bringForward,
  bringToFront,
  sendBackward,
  sendToBack,
  setSectionHidden,
  setSectionLocked,
} from './section'

export type LayerDescriptor = {
  id: string
  type: SectionType
  name: string
  hidden: boolean
  locked: boolean
  groupId?: string
}

export type PageLayers = {
  sections: Section[]
}

function layerName(section: Section): string {
  if ('content' in section && typeof section.content === 'string' && section.content.trim()) {
    const plain = section.content.replace(/<[^>]+>/g, '').trim()
    if (plain) return plain.slice(0, 40)
  }
  if (section.type === 'image' && section.alt) return section.alt.slice(0, 40)
  return section.type
}

/** Top-to-bottom paint order as listed in `page.sections` (index 0 = back). */
export function listPageLayers(page: PageLayers): LayerDescriptor[] {
  return page.sections.map((section) => ({
    id: section.id,
    type: section.type,
    name: layerName(section),
    hidden: Boolean(section.hidden),
    locked: Boolean(section.locked),
    groupId: section.groupId,
  }))
}

export function layerBringForward(page: PageLayers, sectionId: string): boolean {
  return bringForward(page, sectionId)
}

export function layerSendBackward(page: PageLayers, sectionId: string): boolean {
  return sendBackward(page, sectionId)
}

export function layerBringToFront(page: PageLayers, sectionId: string): boolean {
  return bringToFront(page, sectionId)
}

export function layerSendToBack(page: PageLayers, sectionId: string): boolean {
  return sendToBack(page, sectionId)
}

export function layerSetHidden(
  page: PageLayers,
  sectionId: string,
  hidden: boolean,
): boolean {
  return setSectionHidden(page, sectionId, hidden)
}

export function layerSetLocked(
  page: PageLayers,
  sectionId: string,
  locked: boolean,
): boolean {
  return setSectionLocked(page, sectionId, locked)
}
