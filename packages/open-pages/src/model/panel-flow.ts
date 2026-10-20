import type { Page } from './document'
import { addPanelSection, type PanelSection } from './section'

export type PanelFlowOptions = {
  gutter?: number
}

type PageLike = Pick<Page, 'width' | 'height' | 'margins' | 'sections'> & {
  panelFlowGutter?: number
}

function resolveGutter(page: PageLike, options?: PanelFlowOptions): number {
  if (typeof options?.gutter === 'number' && Number.isFinite(options.gutter)) {
    return Math.max(0, options.gutter)
  }
  if (typeof page.panelFlowGutter === 'number' && Number.isFinite(page.panelFlowGutter)) {
    return Math.max(0, page.panelFlowGutter)
  }
  return 12
}

function contentBox(page: PageLike) {
  return {
    x: page.margins.left,
    y: page.margins.top,
    width: page.width - page.margins.left - page.margins.right,
    height: page.height - page.margins.top - page.margins.bottom,
  }
}

function panelsOf(page: PageLike): PanelSection[] {
  return page.sections.filter((s): s is PanelSection => s.type === 'panel')
}

function reindex(panels: PanelSection[]): void {
  const ordered = [...panels].sort((a, b) => a.readingIndex - b.readingIndex)
  ordered.forEach((panel, index) => {
    panel.readingIndex = index
  })
}

/** Lay out panels in reading order into an approximate grid filling the content box. */
export function reflowPagePanels(page: PageLike, options?: PanelFlowOptions): PanelSection[] {
  const gutter = resolveGutter(page, options)
  page.panelFlowGutter = gutter
  const panels = panelsOf(page)
  reindex(panels)
  const ordered = [...panels].sort((a, b) => a.readingIndex - b.readingIndex)
  const n = ordered.length
  if (n === 0) return ordered

  const cols = Math.max(1, Math.ceil(Math.sqrt(n)))
  const rows = Math.max(1, Math.ceil(n / cols))
  const box = contentBox(page)
  const cellW = (box.width - gutter * (cols - 1)) / cols
  const cellH = (box.height - gutter * (rows - 1)) / rows

  ordered.forEach((panel, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    panel.x = box.x + col * (cellW + gutter)
    panel.y = box.y + row * (cellH + gutter)
    panel.width = cellW
    panel.height = cellH
  })
  return ordered
}

export function setPagePanelFlow(page: PageLike, panelIdsInReadingOrder: string[]): void {
  const byId = new Map(panelsOf(page).map((p) => [p.id, p]))
  panelIdsInReadingOrder.forEach((id, index) => {
    const panel = byId.get(id)
    if (panel) panel.readingIndex = index
  })
  reflowPagePanels(page)
}

export function mergePanels(
  page: PageLike,
  panelIds: string[],
  options?: PanelFlowOptions,
): PanelSection {
  if (panelIds.length < 2) throw new Error('mergePanels requires at least 2 ids')
  const panels = panelsOf(page)
  const selected = panelIds
    .map((id) => panels.find((p) => p.id === id))
    .filter((p): p is PanelSection => Boolean(p))
  if (selected.length < 2) throw new Error('mergePanels: panels not found')

  selected.sort((a, b) => a.readingIndex - b.readingIndex)
  const primary = selected[0]
  if (!primary) throw new Error('mergePanels: empty selection')
  const minX = Math.min(...selected.map((p) => p.x))
  const minY = Math.min(...selected.map((p) => p.y))
  const maxR = Math.max(...selected.map((p) => p.x + p.width))
  const maxB = Math.max(...selected.map((p) => p.y + p.height))
  primary.x = minX
  primary.y = minY
  primary.width = maxR - minX
  primary.height = maxB - minY

  for (const panel of selected.slice(1)) {
    const idx = page.sections.findIndex((s) => s.id === panel.id)
    if (idx >= 0) page.sections.splice(idx, 1)
  }
  reflowPagePanels(page, options)
  return primary
}

export function splitPanel(
  page: PageLike,
  panelId: string,
  parts: number,
  options?: PanelFlowOptions,
): PanelSection[] {
  if (parts < 2) throw new Error('splitPanel requires parts >= 2')
  const panel = panelsOf(page).find((p) => p.id === panelId)
  if (!panel) throw new Error(`unknown panel: ${panelId}`)

  const startIndex = panel.readingIndex
  const created: PanelSection[] = [panel]
  for (const other of panelsOf(page)) {
    if (other.id !== panel.id && other.readingIndex > startIndex) {
      other.readingIndex += parts - 1
    }
  }
  panel.readingIndex = startIndex
  for (let i = 1; i < parts; i += 1) {
    created.push(
      addPanelSection(page, {
        x: panel.x,
        y: panel.y,
        width: panel.width,
        height: panel.height,
        borderStyle: panel.borderStyle,
        readingIndex: startIndex + i,
      }),
    )
  }
  reflowPagePanels(page, options)
  return created
}

export function addPanelInFlow(
  page: PageLike,
  atIndex?: number,
  options?: PanelFlowOptions,
): PanelSection {
  const panels = panelsOf(page)
  const index =
    typeof atIndex === 'number' && Number.isFinite(atIndex)
      ? Math.max(0, Math.min(panels.length, Math.floor(atIndex)))
      : panels.length
  for (const panel of panels) {
    if (panel.readingIndex >= index) panel.readingIndex += 1
  }
  const created = addPanelSection(page, {
    x: page.margins.left,
    y: page.margins.top,
    width: 100,
    height: 100,
    borderStyle: 'ink',
    readingIndex: index,
  })
  reflowPagePanels(page, options)
  return created
}

export function removePanelFromFlow(
  page: PageLike,
  panelId: string,
  options?: PanelFlowOptions,
): boolean {
  const idx = page.sections.findIndex((s) => s.id === panelId && s.type === 'panel')
  if (idx < 0) return false
  page.sections.splice(idx, 1)
  reflowPagePanels(page, options)
  return true
}
