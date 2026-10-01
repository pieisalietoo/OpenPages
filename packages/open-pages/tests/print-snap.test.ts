import { describe, expect, it, vi } from 'vitest'
import { createBrowserExportAdapters, createExporter } from '../src/export/exporters'
import { snapSectionPosition, snapSectionSize } from '../src/model/snap'

describe('workspace print', () => {
  it('print requires a page element and passes it to the adapter', async () => {
    const el = document.createElement('div')
    const print = vi.fn()
    const exporter = createExporter({ print })

    await expect(exporter.export('print')).rejects.toThrow(/element/)
    await exporter.export('print', { element: el })
    expect(print).toHaveBeenCalledWith(el)
  })

  it('browser print uses capture of the page element, not window.print on the host', async () => {
    const hostPrint = vi.fn()
    vi.stubGlobal('print', hostPrint)

    const el = document.createElement('div')
    const capturePng = vi.fn().mockResolvedValue('data:image/png;base64,aaa')
    const printPage = vi.fn()
    const adapters = createBrowserExportAdapters({ capturePng, printPage })

    await adapters.print?.(el)

    expect(capturePng).toHaveBeenCalledWith(el)
    expect(printPage).toHaveBeenCalled()
    expect(hostPrint).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})

describe('magnet snap', () => {
  const page = {
    width: 200,
    height: 200,
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
  }

  it('snaps to page edge, margin, and center within threshold', () => {
    const moving = { x: 0, y: 0, width: 40, height: 30 }

    const toLeft = snapSectionPosition(moving, { x: 3, y: 50 }, [], page, {
      enabled: true,
      shiftKey: false,
      threshold: 6,
    })
    expect(toLeft.x).toBe(0)
    expect(toLeft.guides.some((g) => g.kind === 'align' && g.orientation === 'vertical')).toBe(true)

    const toMargin = snapSectionPosition(moving, { x: 18, y: 50 }, [], page, {
      enabled: true,
      shiftKey: false,
      threshold: 6,
    })
    expect(toMargin.x).toBe(20)

    const toCenter = snapSectionPosition(moving, { x: 78, y: 50 }, [], page, {
      enabled: true,
      shiftKey: false,
      threshold: 6,
    })
    // page center 100 → moving center snaps → x = 100 - 20 = 80
    expect(toCenter.x).toBe(80)
  })

  it('snaps to another section edge and center', () => {
    const moving = { x: 0, y: 0, width: 40, height: 30 }
    const other = { id: 'other-1', x: 100, y: 40, width: 50, height: 40 }

    const toEdge = snapSectionPosition(moving, { x: 58, y: 40 }, [other], page, {
      enabled: true,
      shiftKey: false,
      threshold: 6,
    })
    // right of moving (x+40) → left of other (100) → x = 60
    expect(toEdge.x).toBe(60)
    expect(toEdge.guides[0]).toMatchObject({
      kind: 'align',
      targetIds: ['other-1'],
    })

    const toMid = snapSectionPosition(moving, { x: 103, y: 10 }, [other], page, {
      enabled: true,
      shiftKey: false,
      threshold: 6,
    })
    // center of other = 125; moving center → x = 125 - 20 = 105
    expect(toMid.x).toBe(105)
    expect(toMid.guides.some((g) => g.targetIds?.includes('other-1'))).toBe(true)
  })

  it('does not snap when disabled or Shift is held', () => {
    const moving = { x: 0, y: 0, width: 40, height: 30 }
    const off = snapSectionPosition(moving, { x: 3, y: 3 }, [], page, {
      enabled: false,
      shiftKey: false,
    })
    expect(off).toEqual({ x: 3, y: 3, guides: [] })

    const shift = snapSectionPosition(moving, { x: 3, y: 3 }, [], page, {
      enabled: true,
      shiftKey: true,
    })
    expect(shift).toEqual({ x: 3, y: 3, guides: [] })
  })

  it('snaps to equal gaps between neighboring sections and emits gap guides', () => {
    const a = { x: 10, y: 40, width: 30, height: 20 }
    const b = { x: 60, y: 40, width: 30, height: 20 } // gap a→b = 20
    const moving = { x: 0, y: 40, width: 30, height: 20 }

    const result = snapSectionPosition(moving, { x: 108, y: 40 }, [a, b], page, {
      enabled: true,
      shiftKey: false,
      threshold: 6,
    })
    // after b (90) + gap 20 → x = 110
    expect(result.x).toBe(110)
    expect(result.guides.some((g) => g.kind === 'gap')).toBe(true)
  })

  it('snaps a resize to another section edge and shows an alignment guide', () => {
    const other = { id: 'panel-b', x: 200, y: 40, width: 50, height: 40 }
    const options = { enabled: true, shiftKey: false, threshold: 6 }

    const widthSnap = snapSectionSize(
      { x: 10, y: 40 },
      { width: 188, height: 40 },
      [other],
      page,
      options,
    )
    expect(widthSnap.width).toBe(190)
    expect(widthSnap.height).toBe(40)
    expect(widthSnap.guides).toContainEqual(
      expect.objectContaining({
        kind: 'align',
        orientation: 'vertical',
        position: 200,
        targetIds: ['panel-b'],
      }),
    )

    const heightSnap = snapSectionSize(
      { x: 10, y: 10 },
      { width: 40, height: 68 },
      [other],
      page,
      options,
    )
    expect(heightSnap.height).toBe(70)
    expect(heightSnap.guides).toContainEqual(
      expect.objectContaining({
        kind: 'align',
        orientation: 'horizontal',
        position: 80,
        targetIds: ['panel-b'],
      }),
    )
  })

  it('does not snap a resize when magnet is off or Shift is held', () => {
    const proposed = { width: 186, height: 36 }
    const off = snapSectionSize({ x: 10, y: 40 }, proposed, [], page, {
      enabled: false,
      shiftKey: false,
    })
    expect(off).toEqual({ ...proposed, guides: [] })

    const shift = snapSectionSize({ x: 10, y: 40 }, proposed, [], page, {
      enabled: true,
      shiftKey: true,
    })
    expect(shift).toEqual({ ...proposed, guides: [] })
  })
})
