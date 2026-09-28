import { type CaretAffinity, caretRectForOffset } from './caret'
import type { LaidOutLine } from './layout'
import { type MeasureFn, measurePlainPrefix, type TextMeasureStyle } from './measure'

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
 * Hit-test section-local coordinates against laid-out lines → plain caret offset
 * (concatenation of line texts, same as caretRectForOffset).
 */
export function offsetAtPoint(
  lines: LaidOutLine[],
  x: number,
  y: number,
  measure: MeasureFn,
  baseStyle: TextMeasureStyle,
): number {
  if (!lines.length) return 0

  // Prefer a line whose box contains (x,y). With multi-column layouts several
  // lines share a y band — never take the first y match without checking x.
  const first = lines[0]
  if (!first) return 0
  let best = first
  let bestDist = Number.POSITIVE_INFINITY
  for (const line of lines) {
    const inY = y >= line.y && y < line.y + line.height
    const inX = x >= line.x && x <= line.x + line.width
    if (inY && inX) {
      best = line
      bestDist = 0
      break
    }
    const cx = line.x + line.width / 2
    const cy = line.y + line.height / 2
    const d = Math.hypot(x - cx, y - cy)
    if (d < bestDist) {
      bestDist = d
      best = line
    }
  }

  const baseOffset = best.modelStart

  const style = lineMeasureStyle(best, baseStyle)
  const localX = x - best.x
  if (localX <= 0) return baseOffset
  let lo = 0
  let hi = best.text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const w = measurePlainPrefix(best.text, mid, measure, style, best.runs)
    if (w <= localX) lo = mid
    else hi = mid - 1
  }
  // Snap to nearer edge between lo and lo+1
  if (lo < best.text.length) {
    const w0 = measurePlainPrefix(best.text, lo, measure, style, best.runs)
    const w1 = measurePlainPrefix(best.text, lo + 1, measure, style, best.runs)
    if (localX - w0 > w1 - localX) lo += 1
  }
  return baseOffset + lo
}

/** Index of the laid-out line that owns `offset` (model plain offset). */
export function lineIndexForOffset(
  lines: LaidOutLine[],
  offset: number,
  affinity: CaretAffinity = 'downstream',
): number {
  if (!lines.length) return 0
  const clamped = Math.max(0, offset)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const isLast = i === lines.length - 1
    const atEnd = clamped === line.modelEnd
    if (clamped < line.modelEnd || (atEnd && (isLast || affinity === 'upstream'))) return i
  }
  return Math.max(0, lines.length - 1)
}

/** Model plain-text start/end of the laid-out line that owns `offset`. */
export function lineRangeAtOffset(
  lines: LaidOutLine[],
  offset: number,
  affinity: CaretAffinity = 'downstream',
): { start: number; end: number } {
  if (!lines.length) return { start: 0, end: 0 }
  const idx = lineIndexForOffset(lines, offset, affinity)
  const line = lines[idx]
  if (!line) return { start: 0, end: 0 }
  return { start: line.modelStart, end: line.modelEnd }
}

/**
 * After a delete/replace, the caret may sit in soft-wrap trailing spaces that
 * still belong to the previous visual line. Snap forward onto the next line
 * start so the caret stays where the user was editing.
 */
export function snapCaretAfterEdit(
  lines: LaidOutLine[],
  offset: number,
): { offset: number; affinity: CaretAffinity } {
  if (!lines.length) return { offset: Math.max(0, offset), affinity: 'downstream' }
  const last = lines[lines.length - 1]
  const max = last ? last.modelEnd : 0
  const wanted = Math.max(0, offset)
  // Layout may lag the new plain length after insert — don't clamp the caret back.
  if (max <= 0 || wanted > max) return { offset: wanted, affinity: 'downstream' }
  const idx = lineIndexForOffset(lines, wanted, 'downstream')
  const line = lines[idx]
  if (!line) return { offset: wanted, affinity: 'downstream' }
  const local = wanted - line.modelStart
  const rest = line.text.slice(local)
  if (idx < lines.length - 1 && rest.length > 0 && /^\s*$/.test(rest)) {
    const next = lines[idx + 1]
    if (next) return { offset: next.modelStart, affinity: 'downstream' }
  }
  return { offset: wanted, affinity: 'downstream' }
}

/**
 * Move the caret to the previous/next laid-out line, preserving visual x.
 * Uses line indices so taller headings (different line height) stay reachable.
 */
export function moveCaretVertically(
  lines: LaidOutLine[],
  offset: number,
  direction: 'up' | 'down',
  measure: MeasureFn,
  baseStyle: TextMeasureStyle,
): number {
  if (!lines.length) return offset
  const idx = lineIndexForOffset(lines, offset, 'downstream')
  const nextIdx = direction === 'up' ? idx - 1 : idx + 1
  if (nextIdx < 0 || nextIdx >= lines.length) return offset
  const caret = caretRectForOffset(lines, offset, measure, baseStyle, 'downstream')
  const target = lines[nextIdx]
  if (!caret || !target) return offset
  return offsetAtPoint(lines, caret.x, target.y + target.height / 2, measure, baseStyle)
}
