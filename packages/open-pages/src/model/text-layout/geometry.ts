import type { Rect } from '../runaround'

export interface Segment {
  x: number
  width: number
}

export interface LineSlot {
  x: number
  y: number
  width: number
  height: number
  columnIndex: number
}

export function columnRects(host: Rect, columnCount: number, columnGap: number): Rect[] {
  const count = Math.max(1, Math.round(columnCount))
  const gap = count > 1 ? Math.max(0, columnGap) : 0
  const totalGap = gap * (count - 1)
  const colWidth = (host.width - totalGap) / count
  const cols: Rect[] = []
  for (let i = 0; i < count; i++) {
    cols.push({
      x: host.x + i * (colWidth + gap),
      y: host.y,
      width: colWidth,
      height: host.height,
    })
  }
  return cols
}

/** Subtract exclusion intervals from a horizontal band (same y-span). */
export function freeSegmentsForBand(band: Rect, exclusions: Rect[]): Segment[] {
  const bandLeft = band.x
  const bandRight = band.x + band.width
  const bandTop = band.y
  const bandBottom = band.y + band.height

  const cuts: Array<{ left: number; right: number }> = []
  for (const ex of exclusions) {
    if (ex.y >= bandBottom || ex.y + ex.height <= bandTop) continue
    const left = Math.max(bandLeft, ex.x)
    const right = Math.min(bandRight, ex.x + ex.width)
    if (right > left) cuts.push({ left, right })
  }
  cuts.sort((a, b) => a.left - b.left)

  const merged: Array<{ left: number; right: number }> = []
  for (const cut of cuts) {
    const last = merged[merged.length - 1]
    if (last && cut.left <= last.right) {
      last.right = Math.max(last.right, cut.right)
    } else {
      merged.push({ ...cut })
    }
  }

  const segments: Segment[] = []
  let cursor = bandLeft
  for (const cut of merged) {
    if (cut.left > cursor) {
      segments.push({ x: cursor, width: cut.left - cursor })
    }
    cursor = Math.max(cursor, cut.right)
  }
  if (cursor < bandRight) {
    segments.push({ x: cursor, width: bandRight - cursor })
  }
  return segments.filter((s) => s.width >= 1)
}

export function iterLineSlots(options: {
  host: Rect
  columnCount: number
  columnGap: number
  lineHeightPx: number
  exclusions: Rect[]
}): LineSlot[] {
  const { host, columnCount, columnGap, lineHeightPx, exclusions } = options
  const lh = Math.max(1, lineHeightPx)
  const cols = columnRects(host, columnCount, columnGap)
  const slots: LineSlot[] = []

  for (let columnIndex = 0; columnIndex < cols.length; columnIndex++) {
    const col = cols[columnIndex]
    if (!col) continue
    for (let y = col.y; y + lh <= col.y + col.height + 0.001; y += lh) {
      const band: Rect = { x: col.x, y, width: col.width, height: lh }
      const segs = freeSegmentsForBand(band, exclusions)
      for (const seg of segs) {
        slots.push({
          x: seg.x,
          y,
          width: seg.width,
          height: lh,
          columnIndex,
        })
      }
    }
  }
  return slots
}
