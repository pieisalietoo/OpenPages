import type { LaidOutLine } from './layout'
import { type MeasureFn, measurePlainPrefix, type TextMeasureStyle } from './measure'

export interface CaretRect {
  x: number
  y: number
  height: number
}

/**
 * Soft-wrap / block boundaries share one model offset between the end of line N
 * and the start of line N+1. Upstream prefers the earlier line's EOL; downstream
 * prefers the later line's SOL (historical default).
 */
export type CaretAffinity = 'upstream' | 'downstream'

function lineMeasureStyle(line: LaidOutLine, base: TextMeasureStyle): TextMeasureStyle {
  const scale = line.fontScale ?? 1
  return {
    fontFamily: base.fontFamily,
    fontSize: base.fontSize * scale,
    fontBold: line.fontBold ?? base.fontBold,
    fontItalic: line.fontItalic ?? base.fontItalic,
  }
}

/**
 * Map a model plain-text caret offset onto laid-out line geometry.
 */
export function caretRectForOffset(
  lines: LaidOutLine[],
  offset: number,
  measure: MeasureFn,
  baseStyle: TextMeasureStyle,
  affinity: CaretAffinity = 'downstream',
): CaretRect | null {
  if (!lines.length) return null
  const clamped = Math.max(0, offset)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const style = lineMeasureStyle(line, baseStyle)
    const isLast = i === lines.length - 1
    const atEnd = clamped === line.modelEnd
    const owns = clamped < line.modelEnd || (atEnd && (isLast || affinity === 'upstream'))
    if (!owns) continue
    const local = clamped - line.modelStart
    return {
      x: line.x + measurePlainPrefix(line.text, local, measure, style, line.runs),
      y: line.y,
      height: line.height,
    }
  }
  const last = lines[lines.length - 1]
  if (!last) return null
  const style = lineMeasureStyle(last, baseStyle)
  return {
    x: last.x + measurePlainPrefix(last.text, last.text.length, measure, style, last.runs),
    y: last.y,
    height: last.height,
  }
}

export function plainLengthFromLines(lines: LaidOutLine[]): number {
  if (!lines.length) return 0
  return lines[lines.length - 1]?.modelEnd ?? 0
}
