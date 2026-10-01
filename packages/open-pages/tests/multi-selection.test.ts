import { describe, expect, it } from 'vitest'
import type { Section } from '../src/model/section'
import {
  clearSelection,
  createSelection,
  isSelected,
  selectSection,
  toggleSectionSelection,
} from '../src/model/selection'
import { visibleSelectionTools } from '../src/tooling/selection-tools'
import { createToolController } from '../src/tooling/tools'

describe('multi selection', () => {
  it('supports replace, ctrl-toggle, and clear', () => {
    const selection = createSelection()
    selectSection(selection, 'a')
    expect(selection.selectedSectionIds).toEqual(['a'])
    expect(selection.selectedSectionId).toBe('a')

    toggleSectionSelection(selection, 'b')
    expect(selection.selectedSectionIds).toEqual(['a', 'b'])
    expect(selection.selectedSectionId).toBeNull()

    toggleSectionSelection(selection, 'a')
    expect(selection.selectedSectionIds).toEqual(['b'])
    expect(isSelected(selection, 'b')).toBe(true)

    clearSelection(selection)
    expect(selection.selectedSectionIds).toEqual([])
  })
})

describe('visible selection tools', () => {
  function text(id: string): Section {
    return {
      id,
      type: 'text',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      content: id,
      locked: false,
      hidden: false,
      runaround: false,
      groupId: null,
      backgroundColor: 'transparent',
      color: '#1a1a1a',
      borderColor: 'transparent',
      borderWidth: 0,
      fontFamily: 'Georgia, serif',
      fontSize: 16,
      fontBold: false,
      fontItalic: false,
      fontUnderline: false,
      fontStrike: false,
      columnCount: 1,
      lineHeight: 1.4,
      textFit: 'none',
      textAlign: 'left',
      verticalAlign: 'top',
    }
  }

  function image(id: string): Section {
    return {
      id,
      type: 'image',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      src: 'x',
      alt: 'a',
      fit: 'cover',
      locked: false,
      hidden: false,
      runaround: false,
      groupId: null,
      backgroundColor: 'transparent',
      color: '#1a1a1a',
      borderColor: 'transparent',
      borderWidth: 0,
    }
  }

  it('hides all selection tools when nothing is selected', () => {
    const tools = createToolController()
    expect(visibleSelectionTools(tools.list('selection'), [])).toEqual([])
  })

  it('shows single-selection tools including duplicate for one section', () => {
    const tools = createToolController()
    const ids = visibleSelectionTools(tools.list('selection'), [text('a')]).map((t) => t.id)
    expect(ids).toContain('section.duplicate')
    expect(ids).toContain('section.lock')
    expect(ids).not.toContain('section.group')
  })

  it('for multi-select keeps shared tools and group, drops duplicate', () => {
    const tools = createToolController()
    const ids = visibleSelectionTools(tools.list('selection'), [text('a'), image('b')]).map(
      (t) => t.id,
    )
    expect(ids).toContain('section.lock')
    expect(ids).toContain('section.delete')
    expect(ids).toContain('section.group')
    expect(ids).not.toContain('section.duplicate')
  })

  it('never returns disabled tools', () => {
    const tools = createToolController()
    tools.setEnabled('section.lock', false)
    const ids = visibleSelectionTools(
      tools.listAll().filter((t) => t.scope === 'selection'),
      [text('a')],
    ).map((t) => t.id)
    expect(ids).not.toContain('section.lock')
  })
})
