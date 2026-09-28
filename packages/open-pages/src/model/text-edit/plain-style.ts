import type { InlineTextStyle } from '../text-inline'

function parseHtml(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html || ''
  return root
}

interface TextPoint {
  node: Text
  offset: number
}

function textPointAt(root: HTMLElement, plainOffset: number): TextPoint {
  const clamped = Math.max(0, plainOffset)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = clamped
  let node = walker.nextNode() as Text | null
  let last: TextPoint | null = null
  while (node) {
    const len = node.data.length
    last = { node, offset: len }
    if (remaining <= len) return { node, offset: remaining }
    remaining -= len
    node = walker.nextNode() as Text | null
  }
  if (last) return last
  const text = document.createTextNode('')
  root.appendChild(text)
  return { node: text, offset: 0 }
}

function rangeFromPlainOffsets(root: HTMLElement, start: number, end: number): Range {
  const a = textPointAt(root, Math.min(start, end))
  const b = textPointAt(root, Math.max(start, end))
  const range = document.createRange()
  range.setStart(a.node, a.offset)
  range.setEnd(b.node, b.offset)
  return range
}

function applyStyleToSpan(span: HTMLElement, style: InlineTextStyle) {
  if (style.fontFamily !== undefined) span.style.fontFamily = style.fontFamily
  if (style.fontSize !== undefined) span.style.fontSize = `${Math.max(1, style.fontSize)}px`
  if (style.lineHeight !== undefined) {
    span.style.lineHeight = String(Math.max(0.5, style.lineHeight))
  }
  if (style.color !== undefined) span.style.color = style.color
}

/** Wrap a plain-text offset range in a styled `<span>`. */
export function applyInlineStyleToPlainRange(
  html: string,
  start: number,
  end: number,
  style: InlineTextStyle,
): string {
  if (end === start) return html
  const root = parseHtml(html)
  const range = rangeFromPlainOffsets(root, start, end)
  if (range.collapsed) return html

  // Prefer mutating a span that already covers the range exactly — nesting a new
  // font-size outside an inner font-size leaves paint stuck on the inner value.
  const ancestor = range.commonAncestorContainer
  const existing =
    ancestor.nodeType === Node.ELEMENT_NODE ? (ancestor as HTMLElement) : ancestor.parentElement
  if (
    existing &&
    existing !== root &&
    root.contains(existing) &&
    existing.tagName === 'SPAN' &&
    range.toString() === existing.textContent
  ) {
    applyStyleToSpan(existing, style)
    return root.innerHTML
  }

  const span = document.createElement('span')
  applyStyleToSpan(span, style)
  try {
    range.surroundContents(span)
  } catch {
    const contents = range.extractContents()
    span.appendChild(contents)
    range.insertNode(span)
  }
  // Outer metrics must win: clear conflicting descendant font-size/family.
  if (style.fontSize !== undefined || style.fontFamily !== undefined) {
    for (const node of Array.from(span.querySelectorAll('span'))) {
      if (!(node instanceof HTMLElement) || node === span) continue
      if (style.fontSize !== undefined && node.style.fontSize) node.style.fontSize = ''
      if (style.fontFamily !== undefined && node.style.fontFamily) node.style.fontFamily = ''
    }
  }
  return root.innerHTML
}

const TAG_FOR: Record<'bold' | 'italic' | 'underline' | 'strikeThrough', string> = {
  bold: 'b',
  italic: 'i',
  underline: 'u',
  strikeThrough: 's',
}

/** Wrap a plain-text offset range in a semantic tag (b/i/u/s). */
export function wrapPlainRangeWithCommand(
  html: string,
  start: number,
  end: number,
  command: keyof typeof TAG_FOR,
): string {
  if (end === start) return html
  const root = parseHtml(html)
  const range = rangeFromPlainOffsets(root, start, end)
  if (range.collapsed) return html
  const el = document.createElement(TAG_FOR[command])
  try {
    range.surroundContents(el)
  } catch {
    const contents = range.extractContents()
    el.appendChild(contents)
    range.insertNode(el)
  }
  return root.innerHTML
}

/** Bump explicit font-size on the range (wrap if needed). */
export function bumpFontSizeInPlainRange(
  html: string,
  start: number,
  end: number,
  delta: number,
  fallbackSize: number,
): string {
  if (end === start) return html
  const root = parseHtml(html)
  const range = rangeFromPlainOffsets(root, start, end)
  if (range.collapsed) return html

  const ancestor = range.commonAncestorContainer
  const el =
    ancestor.nodeType === Node.ELEMENT_NODE ? (ancestor as HTMLElement) : ancestor.parentElement
  if (
    el &&
    el !== root &&
    root.contains(el) &&
    el.tagName === 'SPAN' &&
    range.toString() === el.textContent
  ) {
    const current = Number.parseFloat(el.style.fontSize || '')
    const base = Number.isFinite(current) ? current : fallbackSize
    el.style.fontSize = `${Math.max(1, base + delta)}px`
    return root.innerHTML
  }

  const span = document.createElement('span')
  span.style.fontSize = `${Math.max(1, fallbackSize + delta)}px`
  try {
    range.surroundContents(span)
  } catch {
    const contents = range.extractContents()
    span.appendChild(contents)
    range.insertNode(span)
  }
  return root.innerHTML
}

/** Map a DOM point inside `root` to a plain-text offset. */
export function plainOffsetFromDom(root: HTMLElement, node: Node | null, offset: number): number {
  if (!node || !root.contains(node)) return 0
  const range = document.createRange()
  range.selectNodeContents(root)
  range.setEnd(node, offset)
  return range.toString().length
}
