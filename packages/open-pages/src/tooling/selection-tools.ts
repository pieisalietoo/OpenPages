import type { Section, SectionType } from '../model/section'
import type { ToolDefinition, ToolId } from './tools'

const MULTI_SHARED: ToolId[] = [
  'section.style',
  'section.lock',
  'section.hide',
  'section.delete',
  'section.zForward',
  'section.zBack',
  'section.zFront',
  'section.zBottom',
  'section.group',
]

const SINGLE_ONLY: ToolId[] = ['section.duplicate', 'section.style']

const TYPE_TOOLS: Partial<Record<SectionType, ToolId[]>> = {
  text: [
    'section.font',
    'section.columns',
    ...SINGLE_ONLY,
    ...MULTI_SHARED.filter((id) => id !== 'section.group' && id !== 'section.style'),
  ],
  headline: [
    'section.font',
    'section.columns',
    ...SINGLE_ONLY,
    ...MULTI_SHARED.filter((id) => id !== 'section.group' && id !== 'section.style'),
  ],
  image: [
    ...SINGLE_ONLY,
    ...MULTI_SHARED.filter((id) => id !== 'section.group' && id !== 'section.style'),
  ],
  panel: [
    ...SINGLE_ONLY,
    ...MULTI_SHARED.filter((id) => id !== 'section.group' && id !== 'section.style'),
  ],
  runaround: [
    ...SINGLE_ONLY,
    ...MULTI_SHARED.filter((id) => id !== 'section.group' && id !== 'section.style'),
  ],
}

function allowedForSingle(section: Section): Set<ToolId> {
  const base = TYPE_TOOLS[section.type] ?? SINGLE_ONLY
  const allowed = new Set<ToolId>(base)
  if (section.groupId) {
    allowed.add('section.ungroup')
  }
  return allowed
}

function allowedForMulti(sections: Section[]): Set<ToolId> {
  const allowed = new Set<ToolId>(MULTI_SHARED)
  const groupIds = new Set(sections.map((s) => s.groupId).filter(Boolean))
  if (groupIds.size === 1 && sections.every((s) => s.groupId && groupIds.has(s.groupId))) {
    allowed.add('section.ungroup')
  }
  return allowed
}

/** Selection-scoped tools that should appear for the current selection. Disabled tools are excluded. */
export function visibleSelectionTools(
  selectionTools: ToolDefinition[],
  selectedSections: Section[],
): ToolDefinition[] {
  if (selectedSections.length === 0) {
    return []
  }

  const first = selectedSections[0]
  if (!first) {
    return []
  }

  const allowed =
    selectedSections.length === 1 ? allowedForSingle(first) : allowedForMulti(selectedSections)

  return selectionTools.filter((tool) => tool.enabled && allowed.has(tool.id))
}
