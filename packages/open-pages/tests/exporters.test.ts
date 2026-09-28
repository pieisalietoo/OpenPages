import { describe, expect, it, vi } from 'vitest'
import { createExporter } from '../src/export/exporters'

describe('exporters', () => {
  it('print delegates to injected print adapter with page element', async () => {
    const el = document.createElement('div')
    const print = vi.fn()
    const exporter = createExporter({ print })
    await exporter.export('print', { element: el })
    expect(print).toHaveBeenCalledWith(el)
  })

  it('png and pdf call adapters with page element', async () => {
    const el = document.createElement('div')
    const toPng = vi.fn().mockResolvedValue('data:image/png;base64,xx')
    const toPdf = vi.fn().mockResolvedValue(undefined)
    const exporter = createExporter({ toPng, toPdf })

    const png = await exporter.export('png', { element: el })
    expect(toPng).toHaveBeenCalledWith(el)
    expect(png).toBe('data:image/png;base64,xx')

    await exporter.export('pdf', { element: el })
    expect(toPdf).toHaveBeenCalledWith(el)
  })

  it('emits export events', async () => {
    const onExport = vi.fn()
    const el = document.createElement('div')
    const exporter = createExporter({
      print: vi.fn(),
    })
    exporter.on('export', onExport)
    await exporter.export('print', { element: el })
    expect(onExport).toHaveBeenCalledWith({ format: 'print', result: undefined })
  })
})
