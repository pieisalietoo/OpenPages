/**
 * Map HTML inline marks onto plain-text runs (textContent order).
 * Used to paint b/i/u/s/color on line boxes while layout stays model-first.
 */

export interface InlineRunStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  color?: string
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
}

export interface InlineRun extends InlineRunStyle {
  text: string
}

function stylesEqual(a: InlineRunStyle, b: InlineRunStyle): boolean {
  return (
    Boolean(a.bold) === Boolean(b.bold) &&
    Boolean(a.italic) === Boolean(b.italic) &&
    Boolean(a.underline) === Boolean(b.underline) &&
    Boolean(a.strike) === Boolean(b.strike) &&
    (a.color ?? '') === (b.color ?? '') &&
    (a.fontFamily ?? '') === (b.fontFamily ?? '') &&
    (a.fontSize ?? 0) === (b.fontSize ?? 0) &&
    (a.lineHeight ?? 0) === (b.lineHeight ?? 0)
  )
}

function pushRun(out: InlineRun[], text: string, style: InlineRunStyle) {
  if (!text) return
  const last = out[out.length - 1]
  if (last && stylesEqual(last, style)) {
    last.text += text
    return
  }
  out.push({
    text,
    bold: style.bold,
    italic: style.italic,
    underline: style.underline,
    strike: style.strike,
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
  })
}

function styleFromElement(el: Element, base: InlineRunStyle): InlineRunStyle {
  const tag = el.tagName.toLowerCase()
  const next: InlineRunStyle = { ...base }
  if (tag === 'b' || tag === 'strong') next.bold = true
  if (tag === 'i' || tag === 'em') next.italic = true
  if (tag === 'u') next.underline = true
  if (tag === 's' || tag === 'strike') next.strike = true
  if (tag === 'span' && el instanceof HTMLElement) {
    const weight = el.style.fontWeight
    if (weight === 'bold' || weight === '700' || Number.parseInt(weight, 10) >= 600) {
      next.bold = true
    }
    if (el.style.fontStyle === 'italic') next.italic = true
    const deco = `${el.style.textDecoration} ${el.style.textDecorationLine}`.toLowerCase()
    if (deco.includes('underline')) next.underline = true
    if (deco.includes('line-through')) next.strike = true
    if (el.style.color) next.color = el.style.color
    if (el.style.fontFamily) next.fontFamily = el.style.fontFamily
    const size = Number.parseFloat(el.style.fontSize)
    if (Number.isFinite(size) && size > 0) next.fontSize = size
    const lh = Number.parseFloat(el.style.lineHeight)
    if (Number.isFinite(lh) && lh > 0) next.lineHeight = lh
  }
  return next
}

function walk(node: Node, style: InlineRunStyle, out: InlineRun[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    pushRun(out, node.textContent ?? '', style)
    return
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return
  const el = node as Element
  const next = styleFromElement(el, style)
  for (const child of Array.from(el.childNodes)) walk(child, next, out)
}

/** Flatten HTML to styled plain runs (same character order as textContent / plainTextOf). */
export function inlineRunsFromHtml(html: string): InlineRun[] {
  if (!html) return []
  const root = document.createElement('div')
  root.innerHTML = html
  const out: InlineRun[] = []
  walk(root, {}, out)
  return out
}

/** Slice runs to the half-open plain range [start, end). */
export function sliceInlineRuns(runs: InlineRun[], start: number, end: number): InlineRun[] {
  const a = Math.max(0, Math.min(start, end))
  const b = Math.max(0, Math.max(start, end))
  if (b <= a) return []
  const out: InlineRun[] = []
  let pos = 0
  for (const run of runs) {
    const rs = pos
    const re = pos + run.text.length
    pos = re
    if (re <= a || rs >= b) continue
    const from = Math.max(a, rs) - rs
    const to = Math.min(b, re) - rs
    if (to > from) {
      pushRun(out, run.text.slice(from, to), run)
    }
  }
  return out
}
