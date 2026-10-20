import type { Page } from './document'
import { addPanelSection, type PanelSection, type Section } from './section'

export type LayoutPresetId =
  | 'blank'
  | 'comic-2x2'
  | 'comic-2x3'
  | 'comic-3x3'
  | 'comic-widescreen'
  | 'comic-splash-inset'

export type LayoutPresetInfo = {
  id: LayoutPresetId
  label: string
}

export type ApplyLayoutPresetOptions = {
  /** Gap between panels in px. Default 12. */
  gutter?: number
  /** When true (default), remove existing sections before applying. */
  clear?: boolean
}

const PRESETS: LayoutPresetInfo[] = [
  { id: 'blank', label: 'Blank' },
  { id: 'comic-2x2', label: 'Comic 2×2' },
  { id: 'comic-2x3', label: 'Comic 2×3' },
  { id: 'comic-3x3', label: 'Comic 3×3' },
  { id: 'comic-widescreen', label: 'Comic widescreen tier' },
  { id: 'comic-splash-inset', label: 'Splash + inset' },
]

export function listLayoutPresets(): LayoutPresetInfo[] {
  return [...PRESETS]
}

type PageLike = Pick<Page, 'width' | 'height' | 'margins' | 'sections'>

function contentBox(page: PageLike) {
  const x = page.margins.left
  const y = page.margins.top
  const width = page.width - page.margins.left - page.margins.right
  const height = page.height - page.margins.top - page.margins.bottom
  return { x, y, width, height }
}

function addGrid(page: PageLike, rows: number, cols: number, gutter: number): PanelSection[] {
  const box = contentBox(page)
  const cellW = (box.width - gutter * (cols - 1)) / cols
  const cellH = (box.height - gutter * (rows - 1)) / rows
  const created: PanelSection[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      created.push(
        addPanelSection(page, {
          x: box.x + col * (cellW + gutter),
          y: box.y + row * (cellH + gutter),
          width: cellW,
          height: cellH,
          borderStyle: 'ink',
        }),
      )
    }
  }
  return created
}

function addSplashInset(page: PageLike, gutter: number): PanelSection[] {
  const box = contentBox(page)
  const insetW = box.width * 0.32
  const insetH = box.height * 0.28
  const splash = addPanelSection(page, {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    borderStyle: 'ink',
  })
  const inset = addPanelSection(page, {
    x: box.x + box.width - insetW - gutter,
    y: box.y + box.height - insetH - gutter,
    width: insetW,
    height: insetH,
    borderStyle: 'double',
  })
  return [splash, inset]
}

/**
 * Apply a layout preset to a page. Comic grids fill the margin box with panel sections.
 * By default existing sections are cleared first.
 */
export function applyLayoutPreset(
  page: PageLike,
  presetId: LayoutPresetId,
  options: ApplyLayoutPresetOptions = {},
): Section[] {
  const gutter =
    typeof options.gutter === 'number' && Number.isFinite(options.gutter)
      ? Math.max(0, options.gutter)
      : 12
  const clear = options.clear !== false
  if (clear) {
    page.sections.splice(0, page.sections.length)
  }

  switch (presetId) {
    case 'blank':
      return []
    case 'comic-2x2':
      return addGrid(page, 2, 2, gutter)
    case 'comic-2x3':
      return addGrid(page, 2, 3, gutter)
    case 'comic-3x3':
      return addGrid(page, 3, 3, gutter)
    case 'comic-widescreen':
      return addGrid(page, 1, 3, gutter)
    case 'comic-splash-inset':
      return addSplashInset(page, gutter)
    default: {
      const _exhaustive: never = presetId
      throw new Error(`unknown layout preset: ${_exhaustive}`)
    }
  }
}
