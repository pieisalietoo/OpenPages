import { plainLengthFromLines } from './caret'
import type { LaidOutLine } from './layout'
import { type MeasureFn, measurePlainPrefix, type TextMeasureStyle } from './measure'

export interface SelectionRect {
  x: number
  y: number
  width: number
  height: number
}

function lineMeasureStyle(line: LaidOutLine, base: TextMeasureStyle): TextMeasureStyle {
  const scale = line.fontScale ?? 1
  return {
    fontFamily: base.fontFamily,
    fontSize: base.fontSize * scale,
    fontBold: line.fontBold ?? base.fontBold,
    fontItalic: line.fontItalic ?? base.fontItalic,
  }
}

/** Highlight rectangles for a half-open plain-offset range [start, end). */
export function selectionRects(
  lines: LaidOutLine[],
  start: number,
  end: number,
  measure: MeasureFn,
  baseStyle: TextMeasureStyle,
): SelectionRect[] {
  const a = Math.max(0, Math.min(start, end))
  const b = Math.max(0, Math.max(start, end))
  if (b <= a || !lines.length) return []

  const total = plainLengthFromLines(lines)
  const from = Math.min(a, total)
  const to = Math.min(b, total)
  if (to <= from) return []

  const rects: SelectionRect[] = []
  for (const line of lines) {
    const lineStart = line.modelStart
    const lineEnd = line.modelEnd
    const segStart = Math.max(from, lineStart)
    const segEnd = Math.min(to, lineEnd)
    if (segEnd <= segStart) continue
    // Measure on this line — do not use caretRectForOffset for segEnd, which
    // prefers the start of the next line at a soft-wrap boundary and collapses
    // a full first-line selection to a 1px stub.
    const style = lineMeasureStyle(line, baseStyle)
    const leftX =
      line.x + measurePlainPrefix(line.text, segStart - lineStart, measure, style, line.runs)
    const rightX =
      line.x + measurePlainPrefix(line.text, segEnd - lineStart, measure, style, line.runs)
    rects.push({
      x: leftX,
      y: line.y,
      width: Math.max(1, rightX - leftX),
      height: line.height,
    })
  }
  return rects
}
