import type { ToolDefinition, ToolId } from './tools'

/** Chrome tokens allowed in toolbar order arrays (not tools). */
export type ToolbarChromeId = 'sep' | 'grow'

export type ToolbarItemId = ToolId | ToolbarChromeId

export type ToolbarEntry =
  | { kind: 'tool'; tool: ToolDefinition }
  | { kind: 'sep' }
  | { kind: 'grow' }

export function isToolbarChromeId(id: string): id is ToolbarChromeId {
  return id === 'sep' || id === 'grow'
}

/** Default document bar order (override via `documentToolbar` prop). */
export const DEFAULT_DOCUMENT_TOOLBAR: readonly ToolbarItemId[] = [
  'layout.select',
  'layout.save',
  'layout.exportJson',
  'fonts.manage',
  'sep',
  'export.print',
  'export.png',
  'export.pdf',
  'sep',
  'section.add',
  'view.magnet',
  'grow',
  'page.setup',
]

/** Default selection bar order (override via `selectionToolbar` prop). */
export const DEFAULT_SELECTION_TOOLBAR: readonly ToolbarItemId[] = [
  'section.style',
  'section.font',
  'section.columns',
  'section.lock',
  'section.hide',
  'section.duplicate',
  'section.zForward',
  'section.zBack',
  'section.zFront',
  'section.zBottom',
  'section.group',
  'section.ungroup',
  'grow',
  'section.delete',
]

/**
 * Resolve a configured order against tools that are currently available/enabled.
 * Tool ids missing from `available` are omitted. Returns null when no tools remain
 * (empty order or chrome-only), so the host can hide the bar.
 */
export function resolveToolbarEntries(
  order: readonly ToolbarItemId[],
  available: readonly ToolDefinition[],
): ToolbarEntry[] | null {
  const byId = new Map(available.map((tool) => [tool.id, tool]))
  const entries: ToolbarEntry[] = []
  let toolCount = 0
  for (const id of order) {
    if (id === 'sep') {
      entries.push({ kind: 'sep' })
      continue
    }
    if (id === 'grow') {
      entries.push({ kind: 'grow' })
      continue
    }
    const tool = byId.get(id)
    if (!tool) continue
    entries.push({ kind: 'tool', tool })
    toolCount += 1
  }
  if (toolCount === 0) return null
  return entries
}
