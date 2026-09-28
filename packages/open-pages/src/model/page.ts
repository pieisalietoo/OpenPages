export type PageOrientation = 'portrait' | 'landscape'

export type PagePresetId = 'a4' | 'letter' | 'tabloid' | 'custom'

export interface PageMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Guide {
  id: string
  orientation: 'horizontal' | 'vertical'
  offset: number
}

export interface PageSizePreset {
  width: number
  height: number
}

export const DEFAULT_MARGINS: PageMargins = {
  top: 48,
  right: 48,
  bottom: 48,
  left: 48,
}

export const PAGE_PRESETS: Record<'a4' | 'letter' | 'tabloid', PageSizePreset> = {
  a4: { width: 794, height: 1123 },
  letter: { width: 816, height: 1056 },
  tabloid: { width: 1056, height: 1632 },
}

export interface PageGeometry {
  width: number
  height: number
  margins: PageMargins
  guides: Guide[]
  orientation: PageOrientation
  preset: PagePresetId
}

export function createDefaultPageGeometry(
  preset: 'a4' | 'letter' | 'tabloid' = 'a4',
): PageGeometry {
  const size = PAGE_PRESETS[preset]
  return {
    width: size.width,
    height: size.height,
    margins: { ...DEFAULT_MARGINS },
    guides: [],
    orientation: 'portrait',
    preset,
  }
}

export function applyPagePreset(
  page: { width: number; height: number; orientation: PageOrientation; preset: PagePresetId },
  preset: 'a4' | 'letter' | 'tabloid',
): void {
  const size = PAGE_PRESETS[preset]
  page.preset = preset
  page.orientation = 'portrait'
  page.width = size.width
  page.height = size.height
}

export function setPageMargins(
  page: { margins: PageMargins },
  margins: Partial<PageMargins>,
): void {
  page.margins = {
    top: margins.top ?? page.margins.top,
    right: margins.right ?? page.margins.right,
    bottom: margins.bottom ?? page.margins.bottom,
    left: margins.left ?? page.margins.left,
  }
}
