import type { ImageSection, Section } from './section'

export type ContentTransform = {
  contentOffsetX: number
  contentOffsetY: number
  contentScale: number
}

export const DEFAULT_CONTENT_TRANSFORM: ContentTransform = {
  contentOffsetX: 0,
  contentOffsetY: 0,
  contentScale: 1,
}

export function readContentTransform(
  section: Pick<ImageSection, 'contentOffsetX' | 'contentOffsetY' | 'contentScale'>,
): ContentTransform {
  const scale =
    typeof section.contentScale === 'number' && Number.isFinite(section.contentScale)
      ? Math.max(0.05, section.contentScale)
      : 1
  return {
    contentOffsetX:
      typeof section.contentOffsetX === 'number' && Number.isFinite(section.contentOffsetX)
        ? section.contentOffsetX
        : 0,
    contentOffsetY:
      typeof section.contentOffsetY === 'number' && Number.isFinite(section.contentOffsetY)
        ? section.contentOffsetY
        : 0,
    contentScale: scale,
  }
}

export function setImageContentTransform(
  page: { sections: Section[] },
  sectionId: string,
  patch: Partial<ContentTransform>,
): boolean {
  const section = page.sections.find((s) => s.id === sectionId)
  if (!section || section.type !== 'image') return false
  const current = readContentTransform(section)
  if (typeof patch.contentOffsetX === 'number' && Number.isFinite(patch.contentOffsetX)) {
    section.contentOffsetX = patch.contentOffsetX
  } else {
    section.contentOffsetX = current.contentOffsetX
  }
  if (typeof patch.contentOffsetY === 'number' && Number.isFinite(patch.contentOffsetY)) {
    section.contentOffsetY = patch.contentOffsetY
  } else {
    section.contentOffsetY = current.contentOffsetY
  }
  if (typeof patch.contentScale === 'number' && Number.isFinite(patch.contentScale)) {
    section.contentScale = Math.max(0.05, patch.contentScale)
  } else {
    section.contentScale = current.contentScale
  }
  return true
}

export function contentTransformCss(section: ImageSection): string {
  const t = readContentTransform(section)
  return `translate(${t.contentOffsetX}px, ${t.contentOffsetY}px) scale(${t.contentScale})`
}

export function nudgeImageContent(
  page: { sections: Section[] },
  sectionId: string,
  dx: number,
  dy: number,
  scaleDelta = 0,
): boolean {
  const section = page.sections.find((s) => s.id === sectionId)
  if (!section || section.type !== 'image') return false
  const t = readContentTransform(section)
  return setImageContentTransform(page, sectionId, {
    contentOffsetX: t.contentOffsetX + dx,
    contentOffsetY: t.contentOffsetY + dy,
    contentScale: t.contentScale + scaleDelta,
  })
}
