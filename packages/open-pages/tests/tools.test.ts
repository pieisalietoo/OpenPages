import { describe, expect, it, vi } from 'vitest'
import { BUILTIN_TOOLS, createToolController } from '../src/tooling/tools'

describe('tool controller', () => {
  it('lists builtin document and selection tools enabled by default', () => {
    const tools = createToolController()
    const ids = tools.list().map((t) => t.id)
    expect(ids).toContain('layout.select')
    expect(ids).toContain('layout.save')
    expect(ids).toContain('layout.exportJson')
    expect(ids).toContain('fonts.manage')
    expect(ids).toContain('export.print')
    expect(ids).toContain('export.png')
    expect(ids).toContain('export.pdf')
    expect(ids).toContain('section.lock')
    expect(ids).toContain('section.hide')
    expect(ids).toContain('section.duplicate')
    expect(ids).toContain('section.delete')
    expect(ids).toContain('section.zForward')
    expect(BUILTIN_TOOLS.length).toBeGreaterThanOrEqual(10)
  })

  it('filters by scope for toolbar rows', () => {
    const tools = createToolController()
    expect(tools.list('document').every((t) => t.scope === 'document')).toBe(true)
    expect(tools.list('selection').every((t) => t.scope === 'selection')).toBe(true)
  })

  it('hides disabled tools from list but keeps them in listAll', () => {
    const tools = createToolController()
    tools.setEnabled('export.pdf', false)
    expect(tools.list().some((t) => t.id === 'export.pdf')).toBe(false)
    expect(tools.listAll().find((t) => t.id === 'export.pdf')?.enabled).toBe(false)
    expect(tools.isEnabled('export.pdf')).toBe(false)
  })

  it('emits toolChange when enablement flips', () => {
    const tools = createToolController()
    const onChange = vi.fn()
    const off = tools.on('toolChange', onChange)
    tools.setEnabled('layout.save', false)
    expect(onChange).toHaveBeenCalledWith({
      id: 'layout.save',
      enabled: false,
    })
    off()
    tools.setEnabled('layout.save', true)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('activate invokes tool and emits toolActivate for external hosts', () => {
    const tools = createToolController()
    const onActivate = vi.fn()
    tools.on('toolActivate', onActivate)
    tools.activate('export.print', { pageId: 'p1' })
    expect(onActivate).toHaveBeenCalledWith({
      id: 'export.print',
      payload: { pageId: 'p1' },
    })
  })

  it('activate on disabled tool is a no-op', () => {
    const tools = createToolController()
    const onActivate = vi.fn()
    tools.on('toolActivate', onActivate)
    tools.setEnabled('export.png', false)
    tools.activate('export.png')
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('accepts initialEnabled overrides from the host', () => {
    const tools = createToolController({
      initialEnabled: { 'export.pdf': false, 'section.delete': false },
    })
    expect(tools.isEnabled('export.pdf')).toBe(false)
    expect(tools.isEnabled('section.delete')).toBe(false)
    expect(tools.isEnabled('layout.select')).toBe(true)
  })
})
