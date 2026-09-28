import type { CaretAffinity } from './caret'
import type { LaidOutLine } from './layout'
import { type MeasureFn, measurePlainPrefix, type TextMeasureStyle } from './measure'

export interface ClientHit {
  offset: number
  affinity: CaretAffinity
}

function firstTextNode(el: HTMLElement): Text | null {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  return walker.nextNode() as Text | null
}

function textPointInLine(
  lineEl: HTMLElement,
  plainOffset: number,
): { node: Text; offset: number } | null {
  const clamped = Math.max(0, plainOffset)
  const walker = lineEl.ownerDocument.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT)
  let remaining = clamped
  let node = walker.nextNode() as Text | null
  let last: { node: Text; offset: number } | null = null
  while (node) {
    const len = node.data.length
    last = { node, offset: len }
    if (remaining <= len) return { node, offset: remaining }
    remaining -= len
    node = walker.nextNode() as Text | null
  }
  return last
}

function rangeWidth(range: Range): number {
  const rects = range.getClientRects()
  if (rects.length === 0) return range.getBoundingClientRect().width
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (!r) continue
    left = Math.min(left, r.left)
    right = Math.max(right, r.right)
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) return 0
  return Math.max(0, right - left)
}

/** Width from start of the line's text through plain `end` (across run spans). */
function prefixWidthInLine(lineEl: HTMLElement, end: number): number {
  const first = firstTextNode(lineEl)
  if (!first) return 0
  const clamped = Math.max(0, end)
  if (clamped <= 0) return 0
  const endPt = textPointInLine(lineEl, clamped)
  if (!endPt) return 0
  const range = lineEl.ownerDocument.createRange()
  range.setStart(first, 0)
  range.setEnd(endPt.node, endPt.offset)
  return rangeWidth(range)
}

function linePlainLength(lineEl: HTMLElement, layoutLine?: LaidOutLine): number {
  if (layoutLine) return layoutLine.text.length
  return lineEl.textContent?.length ?? 0
}

function domWidthsUsable(lineEl: HTMLElement, layoutLine?: LaidOutLine): boolean {
  const len = linePlainLength(lineEl, layoutLine)
  if (len === 0) return false
  const w1 = prefixWidthInLine(lineEl, Math.min(1, len))
  const wAll = prefixWidthInLine(lineEl, len)
  if (!(w1 > 0 || wAll > 0)) return false
  // Reject flat/bogus metrics (common in happy-dom without real glyph boxes).
  if (len > 2) {
    const mid = prefixWidthInLine(lineEl, Math.floor(len / 2))
    if (!(mid > w1 + 0.01 && wAll > mid + 0.01)) return false
  }
  return true
}

function offsetInLineDom(lineEl: HTMLElement, localX: number, layoutLine?: LaidOutLine): number {
  const len = linePlainLength(lineEl, layoutLine)
  if (len === 0 || localX <= 0) return 0
  let lo = 0
  let hi = len
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const w = prefixWidthInLine(lineEl, mid)
    if (w <= localX) lo = mid
    else hi = mid - 1
  }
  if (lo < len) {
    const w0 = prefixWidthInLine(lineEl, lo)
    const w1 = prefixWidthInLine(lineEl, lo + 1)
    if (localX - w0 > w1 - localX) lo += 1
  }
  return lo
}

function offsetInTextFallback(
  text: string,
  localX: number,
  measure: MeasureFn,
  style: TextMeasureStyle,
  runs?: LaidOutLine['runs'],
): number {
  if (!text.length || localX <= 0) return 0
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const w = measurePlainPrefix(text, mid, measure, style, runs)
    if (w <= localX) lo = mid
    else hi = mid - 1
  }
  if (lo < text.length) {
    const w0 = measurePlainPrefix(text, lo, measure, style, runs)
    const w1 = measurePlainPrefix(text, lo + 1, measure, style, runs)
    if (localX - w0 > w1 - localX) lo += 1
  }
  return lo
}

export interface DomHitFallback {
  measure: MeasureFn
  style: TextMeasureStyle
}

function pickLineEl(lineEls: HTMLElement[], clientX: number, clientY: number): HTMLElement {
  const first = lineEls[0]
  if (!first) throw new Error('pickLineEl: empty')
  let best = first
  let bestDist = Number.POSITIVE_INFINITY
  for (const el of lineEls) {
    const r = el.getBoundingClientRect()
    const inY = clientY >= r.top && clientY < r.bottom
    const inX = clientX >= r.left && clientX <= r.right
    if (inY && inX) return el
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const d = Math.hypot(clientX - cx, clientY - cy)
    if (d < bestDist) {
      bestDist = d
      best = el
    }
  }
  return best
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

function styleFromLineEl(el: HTMLElement, fallback: DomHitFallback): TextMeasureStyle {
  const fs = Number.parseFloat(el.style.fontSize)
  const weight = el.style.fontWeight
  return {
    fontFamily: el.style.fontFamily || fallback.style.fontFamily,
    fontSize: Number.isFinite(fs) && fs > 0 ? fs : fallback.style.fontSize,
    fontBold: weight === '700' || weight === 'bold' ? true : fallback.style.fontBold,
    fontItalic: el.style.fontStyle === 'italic' ? true : fallback.style.fontItalic,
  }
}

function padLeftPx(el: HTMLElement): number {
  const raw = (el.style.paddingLeft || '').trim()
  if (raw) {
    const n = Number.parseFloat(raw)
    if (Number.isFinite(n) && n > 0) {
      if (raw.endsWith('em')) {
        const fs =
          Number.parseFloat(el.style.fontSize) ||
          Number.parseFloat(getComputedStyle(el).fontSize) ||
          16
        return n * fs
      }
      return n
    }
  }
  const cs = Number.parseFloat(getComputedStyle(el).paddingLeft)
  return Number.isFinite(cs) && cs > 0 ? cs : 0
}

function localOffsetInLine(
  best: HTMLElement,
  layoutLine: LaidOutLine | undefined,
  localX: number,
  text: string,
  fallback?: DomHitFallback,
): number {
  // Prefer CSS Range widths across the whole line (run spans included).
  if (domWidthsUsable(best, layoutLine)) {
    return offsetInLineDom(best, localX, layoutLine)
  }
  if (layoutLine && fallback) {
    return offsetInTextFallback(
      layoutLine.text,
      localX,
      fallback.measure,
      lineMeasureStyle(layoutLine, fallback.style),
      layoutLine.runs,
    )
  }
  if (fallback) {
    const lineStyle = styleFromLineEl(best, fallback)
    return offsetInTextFallback(text, localX, fallback.measure, lineStyle)
  }
  return offsetInLineDom(best, localX, layoutLine)
}

function affinityForLocal(local: number, textLen: number): CaretAffinity {
  if (textLen > 0 && local >= textLen) return 'upstream'
  return 'downstream'
}

/**
 * Hit-test against rendered `[data-op-line]` elements in document order.
 * Prefers CSS boxes for which line was hit (column / paint drift), then maps
 * into model plain offsets via `lines[i].modelStart` when provided.
 */
export function hitTestClientPoint(
  lineEls: HTMLElement[],
  clientX: number,
  clientY: number,
  fallback?: DomHitFallback,
  lines?: LaidOutLine[],
): ClientHit {
  if (!lineEls.length) return { offset: 0, affinity: 'downstream' }

  const best = pickLineEl(lineEls, clientX, clientY)
  const bestIndex = lineEls.indexOf(best)
  const layoutLine =
    lines && bestIndex >= 0 && bestIndex < lines.length ? lines[bestIndex] : undefined

  // List-marker gutter is padding — glyph measure is relative to the text start.
  const localX = clientX - best.getBoundingClientRect().left - padLeftPx(best)
  const textNode = firstTextNode(best)
  const text = layoutLine?.text ?? textNode?.data ?? best.textContent ?? ''
  const local = localOffsetInLine(best, layoutLine, localX, text, fallback)
  const affinity = affinityForLocal(local, text.length)

  let baseOffset = 0
  if (layoutLine) {
    baseOffset = layoutLine.modelStart
  } else {
    for (const el of lineEls) {
      if (el === best) break
      baseOffset += el.textContent?.length ?? 0
    }
  }
  return { offset: baseOffset + local, affinity }
}

export function offsetAtClientPoint(
  lineEls: HTMLElement[],
  clientX: number,
  clientY: number,
  fallback?: DomHitFallback,
  lines?: LaidOutLine[],
): number {
  return hitTestClientPoint(lineEls, clientX, clientY, fallback, lines).offset
}

/** Caret x within a line element for a local plain offset (CSS-accurate when possible). */
export function caretLeftInLineEl(
  lineEl: HTMLElement,
  localOffset: number,
  fallback?: DomHitFallback,
  layoutLine?: LaidOutLine,
): number {
  const pad = padLeftPx(lineEl)
  if (domWidthsUsable(lineEl, layoutLine)) {
    return pad + prefixWidthInLine(lineEl, localOffset)
  }
  const textNode = firstTextNode(lineEl)
  if (!textNode) return pad
  if (fallback) {
    const style = layoutLine
      ? lineMeasureStyle(layoutLine, fallback.style)
      : styleFromLineEl(lineEl, fallback)
    const src = layoutLine?.text ?? textNode.data
    return pad + measurePlainPrefix(src, localOffset, fallback.measure, style, layoutLine?.runs)
  }
  return pad + prefixWidthInLine(lineEl, localOffset)
}
