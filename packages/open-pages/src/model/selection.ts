export interface SelectionState {
  /** Primary id when exactly one section is selected; otherwise null. */
  selectedSectionId: string | null
  selectedSectionIds: string[]
  hoveredSectionId: string | null
}

export function createSelection(): SelectionState {
  return {
    selectedSectionId: null,
    selectedSectionIds: [],
    hoveredSectionId: null,
  }
}

function syncPrimary(selection: SelectionState): void {
  selection.selectedSectionId =
    selection.selectedSectionIds.length === 1 ? (selection.selectedSectionIds[0] ?? null) : null
}

/** Replace selection with a single id, or clear when null. */
export function selectSection(selection: SelectionState, sectionId: string | null): void {
  selection.selectedSectionIds = sectionId ? [sectionId] : []
  syncPrimary(selection)
}

/** Ctrl/meta toggle: add or remove id from the multi-selection. */
export function toggleSectionSelection(selection: SelectionState, sectionId: string): void {
  const index = selection.selectedSectionIds.indexOf(sectionId)
  if (index >= 0) {
    selection.selectedSectionIds.splice(index, 1)
  } else {
    selection.selectedSectionIds.push(sectionId)
  }
  syncPrimary(selection)
}

export function clearSelection(selection: SelectionState): void {
  selection.selectedSectionIds = []
  syncPrimary(selection)
}

export function isSelected(selection: SelectionState, sectionId: string): boolean {
  return selection.selectedSectionIds.includes(sectionId)
}

export function hoverSection(selection: SelectionState, sectionId: string | null): void {
  selection.hoveredSectionId = sectionId
}
