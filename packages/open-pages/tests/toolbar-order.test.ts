import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DOCUMENT_TOOLBAR,
  DEFAULT_SELECTION_TOOLBAR,
  resolveToolbarEntries,
} from '../src/tooling/toolbar-order'
import { createToolController, type ToolDefinition } from '../src/tooling/tools'

function defs(...ids: string[]): ToolDefinition[] {
  return ids.map((id) => ({
    id,
    scope: 'document' as const,
    label: id,
    icon: 'plus',
    enabled: true,
  }))
}

describe('resolveToolbarEntries', () => {
  it('orders tools by config and inserts sep/grow chrome', () => {
    const entries = resolveToolbarEntries(
      ['page.setup', 'sep', 'section.add', 'grow', 'view.magnet'],
      defs('view.magnet', 'page.setup', 'section.add'),
    )
    expect(entries).toEqual([
      { kind: 'tool', tool: expect.objectContaining({ id: 'page.setup' }) },
      { kind: 'sep' },
      { kind: 'tool', tool: expect.objectContaining({ id: 'section.add' }) },
      { kind: 'grow' },
      { kind: 'tool', tool: expect.objectContaining({ id: 'view.magnet' }) },
    ])
  })

  it('skips tool ids that are not in the available list even if they exist elsewhere', () => {
    const entries = resolveToolbarEntries(
      ['layout.select', 'fonts.manage', 'page.setup'],
      defs('layout.select', 'page.setup'),
    )
    expect(entries?.map((e) => (e.kind === 'tool' ? e.tool.id : e.kind))).toEqual([
      'layout.select',
      'page.setup',
    ])
  })

  it('returns null for empty order or chrome-only order', () => {
    expect(resolveToolbarEntries([], defs('page.setup'))).toBeNull()
    expect(resolveToolbarEntries(['sep', 'grow', 'sep'], defs('page.setup'))).toBeNull()
  })

  it('returns null when no configured tool is available', () => {
    expect(resolveToolbarEntries(['fonts.manage', 'sep'], defs('page.setup'))).toBeNull()
  })
})

describe('default toolbar orders', () => {
  it('document default is an explicit id list', () => {
    expect(DEFAULT_DOCUMENT_TOOLBAR).toEqual([
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
    ])
  })

  it('selection default is an explicit id list', () => {
    expect(DEFAULT_SELECTION_TOOLBAR).toEqual([
      'section.style',
      'section.font',
      'section.columns',
      'section.runaround',
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
    ])
  })

  it('default document order resolves against enabled document tools', () => {
    const tools = createToolController().list('document')
    const entries = resolveToolbarEntries(DEFAULT_DOCUMENT_TOOLBAR, tools)
    expect(entries).not.toBeNull()
    expect(entries?.some((e) => e.kind === 'sep')).toBe(true)
    expect(entries?.filter((e) => e.kind === 'tool')).toHaveLength(tools.length)
  })
})
